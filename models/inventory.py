import sqlite3
import random
from .base import BaseModel

class Warehouse(BaseModel):
    """倉庫管理模型"""
    
    @classmethod
    def get_all(cls):
        """取得所有倉庫"""
        conn = cls.get_connection()
        try:
            warehouses = conn.execute(
                'SELECT * FROM warehouses WHERE is_active = 1 ORDER BY code'
            ).fetchall()
            return [dict(warehouse) for warehouse in warehouses]
        finally:
            conn.close()
    
    @classmethod
    def get_by_id(cls, warehouse_id):
        """根據ID取得倉庫"""
        conn = cls.get_connection()
        try:
            warehouse = conn.execute(
                'SELECT * FROM warehouses WHERE id = ?', 
                (warehouse_id,)
            ).fetchone()
            return dict(warehouse) if warehouse else None
        finally:
            conn.close()


class Inventory(BaseModel):
    """庫存管理模型"""
    
    @classmethod
    def get_current_stock(cls, part_id, warehouse_id=None):
        """取得當前庫存"""
        conn = cls.get_connection()
        try:
            if warehouse_id:
                stock = conn.execute(
                    '''SELECT ci.*, p.part_number, p.name as part_name, w.name as warehouse_name
                       FROM current_inventory ci
                       JOIN parts p ON ci.part_id = p.id
                       JOIN warehouses w ON ci.warehouse_id = w.id
                       WHERE ci.part_id = ? AND ci.warehouse_id = ?''',
                    (part_id, warehouse_id)
                ).fetchone()
                return dict(stock) if stock else None
            else:
                stocks = conn.execute(
                    '''SELECT ci.*, p.part_number, p.name as part_name, w.name as warehouse_name
                       FROM current_inventory ci
                       JOIN parts p ON ci.part_id = p.id
                       JOIN warehouses w ON ci.warehouse_id = w.id
                       WHERE ci.part_id = ?
                       ORDER BY w.code''',
                    (part_id,)
                ).fetchall()
                return [dict(stock) for stock in stocks]
        finally:
            conn.close()
    
    @classmethod
    def get_all_inventory(cls, warehouse_id=None):
        """取得所有庫存清單"""
        conn = cls.get_connection()
        try:
            where_clause = 'WHERE ci.warehouse_id = ?' if warehouse_id else ''
            params = (warehouse_id,) if warehouse_id else ()
            
            inventories = conn.execute(f'''
                SELECT ci.*, p.part_number, p.name as part_name, p.unit, p.safety_stock, p.reorder_point,
                       w.name as warehouse_name, w.code as warehouse_code
                FROM current_inventory ci
                JOIN parts p ON ci.part_id = p.id
                JOIN warehouses w ON ci.warehouse_id = w.id
                {where_clause}
                ORDER BY w.code, p.part_number
            ''', params).fetchall()
            return [dict(inventory) for inventory in inventories]
        finally:
            conn.close()
    
    @classmethod
    def get_low_stock_items(cls, warehouse_id=None):
        """取得低庫存項目"""
        conn = cls.get_connection()
        try:
            where_clause = 'AND ci.warehouse_id = ?' if warehouse_id else ''
            params = (warehouse_id,) if warehouse_id else ()
            
            low_stock = conn.execute(f'''
                SELECT ci.*, p.part_number, p.name as part_name, p.unit, p.safety_stock, p.reorder_point,
                       w.name as warehouse_name
                FROM current_inventory ci
                JOIN parts p ON ci.part_id = p.id
                JOIN warehouses w ON ci.warehouse_id = w.id
                WHERE ci.available_quantity <= p.reorder_point {where_clause}
                ORDER BY (ci.available_quantity - p.reorder_point)
            ''', params).fetchall()
            return [dict(item) for item in low_stock]
        finally:
            conn.close()
    
    @classmethod
    def update_stock(cls, part_id, warehouse_id, quantity_change, transaction_type, reference_type=None, reference_id=None, notes=None):
        """更新庫存並記錄交易"""
        conn = cls.get_connection()
        try:
            # 取得當前庫存
            current = conn.execute(
                'SELECT quantity_on_hand FROM current_inventory WHERE part_id = ? AND warehouse_id = ?',
                (part_id, warehouse_id)
            ).fetchone()
            
            if not current:
                # 如果庫存記錄不存在，創建新記錄
                conn.execute(
                    '''INSERT INTO current_inventory (part_id, warehouse_id, quantity_on_hand, available_quantity)
                       VALUES (?, ?, ?, ?)''',
                    (part_id, warehouse_id, max(0, quantity_change), max(0, quantity_change))
                )
            else:
                # 更新現有庫存
                new_quantity = current[0] + quantity_change
                new_available = new_quantity  # 簡化版本，不考慮預留
                
                conn.execute(
                    '''UPDATE current_inventory 
                       SET quantity_on_hand = ?, available_quantity = ?, last_updated = CURRENT_TIMESTAMP
                       WHERE part_id = ? AND warehouse_id = ?''',
                    (max(0, new_quantity), max(0, new_available), part_id, warehouse_id)
                )
            
            # 記錄交易
            transaction_date = cls.get_taipei_time()
            conn.execute(
                '''INSERT INTO inventory_transactions 
                   (part_id, warehouse_id, transaction_type, quantity, reference_type, reference_id, notes, transaction_date)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
                (part_id, warehouse_id, transaction_type, quantity_change, reference_type, reference_id, notes, transaction_date)
            )
            
            conn.commit()
            return True
        except Exception as e:
            print(f"更新庫存失敗: {e}")
            return False
        finally:
            conn.close()


class Transaction(BaseModel):
    """交易記錄模型"""
    
    @classmethod
    def get_transactions(cls, part_id=None, warehouse_id=None, limit=100):
        """取得交易記錄"""
        conn = cls.get_connection()
        try:
            where_conditions = []
            params = []
            
            if part_id:
                where_conditions.append('it.part_id = ?')
                params.append(part_id)
            
            if warehouse_id:
                where_conditions.append('it.warehouse_id = ?')
                params.append(warehouse_id)
            
            where_clause = 'WHERE ' + ' AND '.join(where_conditions) if where_conditions else ''
            params.append(limit)
            
            transactions = conn.execute(f'''
                SELECT it.*, p.part_number, p.name as part_name, w.name as warehouse_name
                FROM inventory_transactions it
                JOIN parts p ON it.part_id = p.id
                JOIN warehouses w ON it.warehouse_id = w.id
                {where_clause}
                ORDER BY it.transaction_date DESC, it.id DESC
                LIMIT ?
            ''', params).fetchall()
            return [dict(transaction) for transaction in transactions]
        finally:
            conn.close()
    
    @classmethod
    def get_transaction_summary(cls, part_id, warehouse_id=None, days=30):
        """取得交易摘要"""
        conn = cls.get_connection()
        try:
            where_clause = 'WHERE it.part_id = ?'
            params = [part_id]
            
            if warehouse_id:
                where_clause += ' AND it.warehouse_id = ?'
                params.append(warehouse_id)
            
            where_clause += " AND it.transaction_date >= datetime('now', '-{} days')".format(days)
            
            summary = conn.execute(f'''
                SELECT 
                    SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as total_in,
                    SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as total_out,
                    COUNT(*) as transaction_count
                FROM inventory_transactions it
                {where_clause}
            ''', params).fetchone()
            
            return dict(summary) if summary else {'total_in': 0, 'total_out': 0, 'transaction_count': 0}
        finally:
            conn.close()


class StockCount(BaseModel):
    """盤點管理模型"""
    
    @classmethod
    def get_all_counts(cls):
        """取得所有盤點記錄"""
        conn = cls.get_connection()
        try:
            counts = conn.execute('''
                SELECT sc.*, w.name as warehouse_name
                FROM stock_counts sc
                JOIN warehouses w ON sc.warehouse_id = w.id
                ORDER BY sc.created_at DESC
            ''').fetchall()
            return [dict(count) for count in counts]
        finally:
            conn.close()
    
    @classmethod
    def get_count_by_id(cls, count_id):
        """根據ID取得盤點記錄"""
        conn = cls.get_connection()
        try:
            count = conn.execute('''
                SELECT sc.*, w.name as warehouse_name
                FROM stock_counts sc
                JOIN warehouses w ON sc.warehouse_id = w.id
                WHERE sc.id = ?
            ''', (count_id,)).fetchone()
            return dict(count) if count else None
        finally:
            conn.close()
    
    @classmethod
    def create_count(cls, warehouse_id, count_type='full', description='', counted_by=''):
        """建立新的盤點"""
        conn = cls.get_connection()
        try:
            # 生成盤點編號
            current_date = cls.get_taipei_time()[:10].replace('-', '')
            count_number = f"SC-{current_date}-{random.randint(1000, 9999)}"
            
            cursor = conn.execute('''
                INSERT INTO stock_counts (count_number, warehouse_id, count_date, count_type, description, counted_by)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (count_number, warehouse_id, cls.get_taipei_time(), count_type, description, counted_by))
            
            count_id = cursor.lastrowid
            
            # 自動新增盤點明細（當前庫存中的所有項目）
            conn.execute('''
                INSERT INTO stock_count_details (stock_count_id, part_id, system_quantity)
                SELECT ?, ci.part_id, ci.quantity_on_hand
                FROM current_inventory ci
                WHERE ci.warehouse_id = ? AND ci.quantity_on_hand > 0
            ''', (count_id, warehouse_id))
            
            conn.commit()
            return count_id
        except Exception as e:
            print(f"建立盤點失敗: {e}")
            return None
        finally:
            conn.close()
    
    @classmethod
    def start_count(cls, count_id):
        """開始盤點"""
        conn = cls.get_connection()
        try:
            conn.execute('''
                UPDATE stock_counts 
                SET status = 'counting'
                WHERE id = ? AND status = 'planning'
            ''', (count_id,))
            
            conn.commit()
            return conn.total_changes > 0
        except Exception as e:
            print(f"開始盤點失敗: {e}")
            return False
        finally:
            conn.close()
    
    @classmethod
    def add_count_item(cls, count_id, part_id, actual_quantity, notes=''):
        """新增盤點項目"""
        conn = cls.get_connection()
        try:
            # 檢查是否已存在
            existing = conn.execute('''
                SELECT id FROM stock_count_details 
                WHERE stock_count_id = ? AND part_id = ?
            ''', (count_id, part_id)).fetchone()
            
            if existing:
                # 更新現有項目
                return cls.update_count_item(count_id, part_id, actual_quantity, notes)
            
            # 取得系統庫存數量
            count_info = conn.execute('''
                SELECT warehouse_id FROM stock_counts WHERE id = ?
            ''', (count_id,)).fetchone()
            
            if not count_info:
                return False
            
            warehouse_id = count_info[0]
            
            system_qty = conn.execute('''
                SELECT quantity_on_hand FROM current_inventory 
                WHERE part_id = ? AND warehouse_id = ?
            ''', (part_id, warehouse_id)).fetchone()
            
            system_quantity = system_qty[0] if system_qty else 0
            variance = actual_quantity - system_quantity
            
            # 新增盤點項目
            conn.execute('''
                INSERT INTO stock_count_details 
                (stock_count_id, part_id, system_quantity, counted_quantity, variance_quantity, notes, counted_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (count_id, part_id, system_quantity, actual_quantity, variance, notes))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"新增盤點項目失敗: {e}")
            return False
        finally:
            conn.close()
    
    @classmethod
    def update_count_item(cls, count_id, part_id, actual_quantity, notes=''):
        """更新盤點項目"""
        conn = cls.get_connection()
        try:
            # 取得系統數量
            detail = conn.execute('''
                SELECT id, system_quantity FROM stock_count_details 
                WHERE stock_count_id = ? AND part_id = ?
            ''', (count_id, part_id)).fetchone()
            
            if not detail:
                return False
            
            detail_id, system_qty = detail
            variance = actual_quantity - system_qty
            
            conn.execute('''
                UPDATE stock_count_details 
                SET counted_quantity = ?, variance_quantity = ?, notes = ?, counted_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (actual_quantity, variance, notes, detail_id))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"更新盤點項目失敗: {e}")
            return False
        finally:
            conn.close()
    
    @classmethod
    def get_count_details(cls, count_id):
        """取得盤點明細"""
        conn = cls.get_connection()
        try:
            details = conn.execute('''
                SELECT scd.*, p.part_number, p.name as part_name, p.unit
                FROM stock_count_details scd
                JOIN parts p ON scd.part_id = p.id
                WHERE scd.stock_count_id = ?
                ORDER BY p.part_number
            ''', (count_id,)).fetchall()
            return [dict(detail) for detail in details]
        finally:
            conn.close()
    
    @classmethod
    def update_count_detail(cls, detail_id, counted_quantity, notes=''):
        """更新盤點明細"""
        conn = cls.get_connection()
        try:
            # 取得系統數量
            detail = conn.execute(
                'SELECT system_quantity FROM stock_count_details WHERE id = ?',
                (detail_id,)
            ).fetchone()
            
            if detail:
                system_qty = detail[0]
                variance = counted_quantity - system_qty
                
                conn.execute('''
                    UPDATE stock_count_details 
                    SET counted_quantity = ?, variance_quantity = ?, notes = ?, counted_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (counted_quantity, variance, notes, detail_id))
                
                conn.commit()
                return True
            return False
        except Exception as e:
            print(f"更新盤點明細失敗: {e}")
            return False
        finally:
            conn.close()
    
    @classmethod
    def complete_count(cls, count_id, verified_by='', apply_adjustments=False):
        """完成盤點"""
        conn = cls.get_connection()
        try:
            # 更新盤點狀態
            conn.execute('''
                UPDATE stock_counts 
                SET status = 'completed', verified_by = ?, completed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (verified_by, count_id))
            
            if apply_adjustments:
                # 應用盤點差異調整
                variances = conn.execute('''
                    SELECT scd.part_id, sc.warehouse_id, scd.variance_quantity
                    FROM stock_count_details scd
                    JOIN stock_counts sc ON scd.stock_count_id = sc.id
                    WHERE sc.id = ? AND scd.variance_quantity != 0
                ''', (count_id,)).fetchall()
                
                for part_id, warehouse_id, variance in variances:
                    if variance != 0:
                        # 記錄調整交易
                        Inventory.update_stock(
                            part_id, warehouse_id, variance, 'ADJUST',
                            'COUNT', count_id, f'盤點調整 (差異: {variance})'
                        )
            
            conn.commit()
            return True
        except Exception as e:
            print(f"完成盤點失敗: {e}")
            return False
        finally:
            conn.close()
    
    @classmethod
    def import_count_data(cls, count_id, count_data):
        """批量匯入盤點資料"""
        conn = cls.get_connection()
        try:
            success_count = 0
            error_list = []
            
            for row_num, row_data in enumerate(count_data, 1):
                try:
                    part_number = row_data.get('part_number', '').strip()
                    counted_qty = row_data.get('counted_quantity', 0)
                    notes = row_data.get('notes', '').strip()
                    
                    if not part_number:
                        error_list.append(f"第{row_num}行: 零件編號不能為空")
                        continue
                    
                    # 查找零件ID
                    part = conn.execute(
                        'SELECT id FROM parts WHERE part_number = ?',
                        (part_number,)
                    ).fetchone()
                    
                    if not part:
                        error_list.append(f"第{row_num}行: 找不到零件編號 {part_number}")
                        continue
                    
                    part_id = part[0]
                    
                    # 查找盤點明細
                    detail = conn.execute(
                        'SELECT id, system_quantity FROM stock_count_details WHERE stock_count_id = ? AND part_id = ?',
                        (count_id, part_id)
                    ).fetchone()
                    
                    if not detail:
                        error_list.append(f"第{row_num}行: 在盤點中找不到零件 {part_number}")
                        continue
                    
                    detail_id, system_qty = detail
                    
                    try:
                        counted_qty = int(counted_qty)
                    except (ValueError, TypeError):
                        error_list.append(f"第{row_num}行: 盤點數量必須是數字")
                        continue
                    
                    # 更新盤點明細
                    variance = counted_qty - system_qty
                    conn.execute('''
                        UPDATE stock_count_details 
                        SET counted_quantity = ?, variance_quantity = ?, notes = ?, counted_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (counted_qty, variance, notes, detail_id))
                    
                    success_count += 1
                    
                except Exception as e:
                    error_list.append(f"第{row_num}行: 處理錯誤 - {str(e)}")
            
            conn.commit()
            return success_count, error_list
            
        except Exception as e:
            return 0, [f"匯入失敗: {str(e)}"]
        finally:
            conn.close()