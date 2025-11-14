from models.inventory import CurrentInventory, InventoryTransaction
from models.weekly_order import OrderRegistration
from models.part import Part, WarehouseLocation
from extensions import db
from sqlalchemy.exc import SQLAlchemyError
import pandas as pd # Added import
from io import BytesIO # Added import
from datetime import datetime # Added import

class InventoryService:
    @staticmethod
    def export_low_stock_items_excel(warehouse_id=None):
        """匯出低庫存項目為 Excel 檔案"""
        low_stock_items = CurrentInventory.get_low_stock_items(warehouse_id)
        
        export_data = []
        for item in low_stock_items:
            export_data.append({
                '零件編號': item['part_number'],
                '零件名稱': item['part_name'],
                '儲位': f"{item['warehouse_name']} - {item['location_code']}",
                '現有庫存': item['quantity_on_hand'],
                '可用庫存': item['available_quantity'],
                '安全庫存': item['safety_stock'],
                '補貨點': item['reorder_point'],
                '單位': item['unit'],
            })
        
        df = pd.DataFrame(export_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='低庫存項目', index=False)
            
            worksheet = writer.sheets['低庫存項目']
            for column in worksheet.columns:
                max_length = 0
                column_name = column[0].value
                if column_name:
                    max_length = max(max_length, len(str(column_name)))
                
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2)
                worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
        output.seek(0)
        
        filename = f"低庫存項目_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return output.getvalue(), filename

    @staticmethod
    def export_inventory_stock_excel(warehouse_id=None):
        """匯出庫存數據為 Excel 檔案"""
        inventories = CurrentInventory.get_detailed_inventory_view(warehouse_id)
        
        export_data = []
        for item in inventories:
            export_data.append({
                '零件編號': item['part_number'],
                '零件名稱': item['part_name'],
                '儲位': f"{item['warehouse_name']} - {item['location_code']}",
                '現有庫存': item['quantity_on_hand'],
                '可用庫存': item['available_quantity'],
                '安全庫存': item['safety_stock'],
                '補貨點': item['reorder_point'],
                '單位': item['unit'],
            })
        
        df = pd.DataFrame(export_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='庫存數據', index=False)
            
            worksheet = writer.sheets['庫存數據']
            for column in worksheet.columns:
                max_length = 0
                column_name = column[0].value
                if column_name:
                    max_length = max(max_length, len(str(column_name)))
                
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = max(max_length, len(str(cell.value)))
                    except:
                        pass
                adjusted_width = (max_length + 2)
                worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
        output.seek(0)
        
        filename = f"庫存數據_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return output.getvalue(), filename

    @staticmethod
    def perform_stock_out_from_api(data, user_id=None):
        """Handles the business logic for stocking out from an API request."""
        part_number = data.get('part_number')
        warehouse_location_id = data.get('warehouse_location_id')
        warehouse_id = data.get('warehouse_id')  # 向下兼容舊API
        quantity = data.get('quantity')
        transaction_type = data.get('transaction_type')
        reference_type = data.get('reference_type', 'MANUAL')
        reference_id = data.get('reference_id')
        notes = data.get('notes', '')

        # 檢查必要欄位
        if not part_number or not quantity or not transaction_type:
            return {'success': False, 'error': 'Missing required field: part_number, quantity, or transaction_type'}
        
        if not warehouse_location_id and not warehouse_id:
            return {'success': False, 'error': 'Missing required field: warehouse_location_id or warehouse_id'}

        part = Part.get_by_part_number(part_number)
        if not part:
            return {'success': False, 'error': 'Part not found'}

        try:
            quantity = int(quantity)
            if quantity <= 0:
                raise ValueError("Quantity must be positive")
        except (ValueError, TypeError):
            return {'success': False, 'error': 'Invalid quantity'}

        valid_out_types = ['OUT_WORK_ORDER', 'OUT_TRANSFER', 'OUT_SCRAP', 'OUT_AFTER_SALES']
        if transaction_type not in valid_out_types:
            return {'success': False, 'error': 'Invalid transaction type for stock out'}

        # 如果提供了 warehouse_location_id，直接使用；否則從 warehouse_id 查找
        if warehouse_location_id:
            from models.part import WarehouseLocation
            location = WarehouseLocation.query.get(warehouse_location_id)
            if not location:
                return {'success': False, 'error': '選擇的儲位不存在'}
            
            # 檢查零件是否關聯此儲位
            has_location = any(
                assoc.warehouse_location_id == warehouse_location_id 
                for assoc in part.location_associations
            )
            if not has_location:
                return {'success': False, 'error': f'零件 {part.part_number} 未關聯到所選儲位'}
        else:
            # 向下兼容：從 warehouse_id 查找第一個儲位
            target_location = None
            if part.location_associations:
                for assoc in part.location_associations:
                    if assoc.warehouse_location.warehouse_id == warehouse_id:
                        target_location = assoc.warehouse_location
                        break
            
            if not target_location:
                return {'success': False, 'error': f'零件 {part.part_number} 在所選倉庫中沒有指定的儲位，無法出庫。'}
            
            warehouse_location_id = target_location.id
            location = target_location

        current_stock = CurrentInventory.get_current_stock(part.id, warehouse_location_id)
        if not current_stock or current_stock['available_quantity'] < quantity:
            available = current_stock["available_quantity"] if current_stock else 0
            return {'success': False, 'error': f'Insufficient stock. Available: {available}'}

        success = CurrentInventory.update_stock(
            part.id, warehouse_location_id, -quantity, transaction_type,
            reference_type, reference_id, notes, user_id=user_id
        )
        
        if success:
            return {'success': True, 'message': f'{part_number} 出庫 {quantity} {part.unit} 成功'}
        else:
            return {'success': False, 'error': 'Stock out operation failed'}

    @staticmethod
    def perform_stock_in_from_api(data, user_id=None):
        """Handles the business logic for stocking in from an API request."""
        part_number = data.get('part_number')
        warehouse_location_id = data.get('warehouse_location_id')
        warehouse_id = data.get('warehouse_id')  # 向下兼容舊API
        quantity = data.get('quantity')
        transaction_type = data.get('transaction_type')
        reference_type = data.get('reference_type', 'MANUAL')
        reference_id = data.get('reference_id')
        notes = data.get('notes', '')

        # 檢查必要欄位
        if not part_number or not quantity or not transaction_type:
            return {'success': False, 'error': 'Missing required field: part_number, quantity, or transaction_type'}
        
        if not warehouse_location_id and not warehouse_id:
            return {'success': False, 'error': 'Missing required field: warehouse_location_id or warehouse_id'}

        part = Part.get_by_part_number(part_number)
        if not part:
            return {'success': False, 'error': 'Part not found'}

        try:
            quantity = int(quantity)
            if quantity <= 0:
                raise ValueError("Quantity must be positive")
        except (ValueError, TypeError):
            return {'success': False, 'error': 'Invalid quantity'}

        valid_in_types = ['IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN']
        if transaction_type not in valid_in_types:
            return {'success': False, 'error': 'Invalid transaction type for stock in'}

        # 如果提供了 warehouse_location_id，直接使用；否則從 warehouse_id 查找
        if warehouse_location_id:
            from models.part import WarehouseLocation
            location = WarehouseLocation.query.get(warehouse_location_id)
            if not location:
                return {'success': False, 'error': '選擇的儲位不存在'}
            
            # 檢查零件是否關聯此儲位
            has_location = any(
                assoc.warehouse_location_id == warehouse_location_id 
                for assoc in part.location_associations
            )
            if not has_location:
                return {'success': False, 'error': f'零件 {part.part_number} 未關聯到所選儲位'}
        else:
            # 向下兼容：從 warehouse_id 查找第一個儲位
            target_location = None
            if part.location_associations:
                for assoc in part.location_associations:
                    if assoc.warehouse_location.warehouse_id == warehouse_id:
                        target_location = assoc.warehouse_location
                        break
            
            if not target_location:
                return {'success': False, 'error': f'零件 {part.part_number} 在所選倉庫中沒有指定的儲位，無法入庫。'}
            
            warehouse_location_id = target_location.id
            location = target_location

        success = CurrentInventory.update_stock(
            part.id, warehouse_location_id, quantity, transaction_type,
            reference_type, reference_id, notes, user_id=user_id
        )
        
        if success:
            return {'success': True, 'message': f'{part_number} 入庫 {quantity} {part.unit} 成功'}
        else:
            return {'success': False, 'error': 'Stock in operation failed'}

    @staticmethod
    def perform_stock_out_from_form(form_data, user_id=None):
        """Handles the business logic for stocking out from a web form."""
        part_number = form_data.get('part_number')
        warehouse_location_id_str = form_data.get('warehouse_location_id')
        quantity_str = form_data.get('quantity')
        transaction_type = form_data.get('transaction_type')
        work_order_id = form_data.get('work_order_id')
        notes = form_data.get('notes', '')

        if not all([part_number, warehouse_location_id_str, quantity_str, transaction_type]):
            return {'success': False, 'message': '所有欄位都是必填的'}

        valid_out_types = ['OUT_WORK_ORDER', 'OUT_TRANSFER', 'OUT_SCRAP', 'OUT_AFTER_SALES']
        if transaction_type not in valid_out_types:
            return {'success': False, 'message': '無效的出庫類型'}

        if transaction_type == 'OUT_WORK_ORDER' and not work_order_id:
            return {'success': False, 'message': '工單領用必須選擇工單編號'}

        part = Part.get_by_part_number(part_number)
        if not part:
            return {'success': False, 'message': f'找不到零件編號: {part_number}'}

        try:
            warehouse_location_id = int(warehouse_location_id_str)
            quantity = int(quantity_str)
            if quantity <= 0:
                raise ValueError("數量必須大於0")
        except (ValueError, TypeError):
            return {'success': False, 'message': '請輸入有效的數量'}

        # 驗證該零件是否有此儲位的關聯
        from models.part import WarehouseLocation
        location = WarehouseLocation.query.get(warehouse_location_id)
        if not location:
            return {'success': False, 'message': '選擇的儲位不存在'}
        
        # 檢查零件是否關聯此儲位
        has_location = any(
            assoc.warehouse_location_id == warehouse_location_id 
            for assoc in part.location_associations
        )
        if not has_location:
            return {'success': False, 'message': f'零件 {part.part_number} 未關聯到所選儲位'}

        current_stock = CurrentInventory.get_current_stock(part.id, warehouse_location_id)
        if not current_stock or current_stock.get('available_quantity', 0) < quantity:
            available = current_stock.get('available_quantity', 0) if current_stock else 0
            return {'success': False, 'message': f'庫存不足。可用數量: {available} (儲位: {location.location_code})'}

        final_notes = notes
        if transaction_type == 'OUT_WORK_ORDER' and work_order_id:
            final_notes = f"工單領用 - 工單編號: {work_order_id}"
            if notes:
                final_notes += f"\n備註: {notes}"

        success = CurrentInventory.update_stock(
            part.id, warehouse_location_id, -quantity, transaction_type,
            'MANUAL', None, final_notes, user_id=user_id
        )

        if success:
            success_msg = f'{part_number} 出庫 {quantity} {part.unit} 成功 ({location.warehouse.name} - {location.location_code})'
            if transaction_type == 'OUT_WORK_ORDER':
                success_msg += f' [工單: {work_order_id}]'
            return {'success': True, 'message': success_msg}
        else:
            return {'success': False, 'message': '出庫作業失敗'}

    @staticmethod
    def perform_stock_in_from_form(form_data, user_id=None):
        """Handles the business logic for stocking in from a web form."""
        part_number = form_data.get('part_number')
        warehouse_location_id_str = form_data.get('warehouse_location_id')
        quantity_str = form_data.get('quantity')
        transaction_type = form_data.get('transaction_type')
        notes = form_data.get('notes', '')

        if not all([part_number, warehouse_location_id_str, quantity_str, transaction_type]):
            return {'success': False, 'message': '所有欄位都是必填的'}

        part = Part.get_by_part_number(part_number)
        if not part:
            return {'success': False, 'message': f'找不到零件編號: {part_number}'}

        try:
            warehouse_location_id = int(warehouse_location_id_str)
            quantity = int(quantity_str)
            if quantity <= 0:
                raise ValueError("數量必須大於0")
        except (ValueError, TypeError) as e:
            return {'success': False, 'message': f'請輸入有效的數量'}

        # 驗證該零件是否有此儲位的關聯
        from models.part import WarehouseLocation
        location = WarehouseLocation.query.get(warehouse_location_id)
        if not location:
            return {'success': False, 'message': '選擇的儲位不存在'}
        
        # 檢查零件是否關聯此儲位
        has_location = any(
            assoc.warehouse_location_id == warehouse_location_id 
            for assoc in part.location_associations
        )
        if not has_location:
            return {'success': False, 'message': f'零件 {part.part_number} 未關聯到所選儲位'}

        success = CurrentInventory.update_stock(
            part.id, warehouse_location_id, quantity, transaction_type,
            'MANUAL', None, notes, user_id=user_id
        )

        if success:
            return {'success': True, 'message': f'{part_number} 入庫 {quantity} {part.unit} 成功 ({location.warehouse.name} - {location.location_code})'}
        else:
            return {'success': False, 'message': '入庫作業失敗'}

    @staticmethod
    def receive_stock(registration_id, inbound_quantity, notes='', user_id=None):
        """
        Processes the receipt of stock for a weekly order registration.
        Updates inventory and the order registration status.
        """
        try:
            # Get the registration and lock it for update
            registration = OrderRegistration.query.filter_by(id=registration_id).with_for_update().first()
            if not registration:
                return {'success': False, 'error': '找不到指定的申請項目'}

            if registration.status not in ['approved', 'partially_received']:
                return {'success': False, 'error': f'此項目狀態為「{registration.status}」，無法執行入庫'}

            total_needed = registration.quantity - registration.quantity_received
            if inbound_quantity > total_needed:
                return {'success': False, 'error': f'入庫數量 ({inbound_quantity}) 超過剩餘未交數量 ({total_needed})'}

            # Get Part ID
            part = Part.query.filter_by(part_number=registration.part_number).first()
            if not part:
                return {'success': False, 'error': f'找不到對應的零件資料: {registration.part_number}'}

            # Update inventory using the existing class method
            # This will also create a transaction log
            update_success = CurrentInventory.update_stock(
                part_id=part.id,
                warehouse_location_id=registration.warehouse_location_id,
                quantity_change=inbound_quantity,
                transaction_type='INBOUND',
                reference_type='OrderRegistration',
                reference_id=registration.id,
                notes=f'週期訂單入庫: {notes}',
                user_id=user_id
            )

            if not update_success:
                db.session.rollback() # Rollback if update_stock failed
                return {'success': False, 'error': '更新庫存時發生錯誤'}

            # Update the registration record
            registration.quantity_received += inbound_quantity
            
            # Update status
            if registration.quantity_received >= registration.quantity:
                registration.status = 'completed'
            else:
                registration.status = 'partially_received'

            db.session.commit()
            return {'success': True, 'message': '入庫成功', 'new_status': registration.status}

        except SQLAlchemyError as e:
            db.session.rollback()
            return {'success': False, 'error': f'資料庫操作失敗: {str(e)}'}

    @staticmethod
    def perform_batch_stock_out(data, user_id=None):
        """
        Handles the business logic for batch stocking out from an API request.
        This entire operation is a single database transaction.
        """
        transaction_type = data.get('transaction_type')
        notes = data.get('notes', '')
        work_order_id = data.get('work_order_id')
        items = data.get('items', [])

        # --- Basic Validation ---
        if not transaction_type or not items:
            return {'success': False, 'error': '缺少交易類型或出庫品項'}

        valid_out_types = ['OUT_WORK_ORDER', 'OUT_TRANSFER', 'OUT_SCRAP', 'OUT_AFTER_SALES']
        if transaction_type not in valid_out_types:
            return {'success': False, 'error': '無效的出庫類型'}

        if transaction_type == 'OUT_WORK_ORDER' and not work_order_id:
            return {'success': False, 'error': '工單領用必須提供工單編號'}

        try:
            processed_parts = []
            
            # 處理所有品項，但不提交事務
            for item in items:
                part_id = item.get('part_id')
                warehouse_location_id = item.get('warehouse_location_id')
                quantity = item.get('quantity')

                if not all([part_id, warehouse_location_id, quantity]):
                    raise ValueError("出庫品項缺少 part_id, warehouse_location_id, 或 quantity")

                try:
                    quantity = int(quantity)
                    if quantity <= 0:
                        raise ValueError("數量必須為正整數")
                except (ValueError, TypeError):
                    raise ValueError(f"零件ID {part_id} 的數量無效")

                part = Part.query.get(part_id)
                if not part:
                    raise ValueError(f"找不到零件ID: {part_id}")

                # Check stock
                current_stock = CurrentInventory.get_current_stock(part_id, warehouse_location_id)
                if not current_stock or current_stock.get('available_quantity', 0) < quantity:
                    available = current_stock.get('available_quantity', 0) if current_stock else 0
                    raise ValueError(f"零件 {part.part_number} 庫存不足 (可用: {available}, 欲出庫: {quantity})")

                # Prepare notes
                final_notes = notes
                if transaction_type == 'OUT_WORK_ORDER' and work_order_id:
                    final_notes = f"工單領用 - 工單編號: {work_order_id}"
                    if notes:
                        final_notes += f"\n備註: {notes}"
                
                # Update stock without committing (commit=False)
                success = CurrentInventory.update_stock(
                    part_id, warehouse_location_id, -quantity, transaction_type,
                    'MANUAL_BATCH', None, final_notes, user_id=user_id, commit=False
                )
                if not success:
                    raise ValueError(f"為零件 {part.part_number} 更新庫存失敗")

                processed_parts.append(f"{part.part_number} ({quantity} {part.unit})")

            # 所有品項處理成功後，統一提交
            db.session.commit()
            
            return {
                'success': True, 
                'message': f"批量出庫成功。共處理 {len(processed_parts)} 個品項: {', '.join(processed_parts)}"
            }
        except (ValueError, SQLAlchemyError) as e:
            # 發生錯誤時回滾
            db.session.rollback()
            return {'success': False, 'error': f'批量出庫失敗: {str(e)}'}

    @staticmethod
    def update_inventory_policy(part_id, warehouse_id, safety_stock, reorder_point):
        """更新零件在特定倉庫的庫存策略 (安全庫存和補貨點)。"""
        if not all([warehouse_id, safety_stock is not None, reorder_point is not None]):
            return {'success': False, 'error': 'Missing warehouse_id, safety_stock or reorder_point'}

        current_inventory = CurrentInventory.query.filter_by(part_id=part_id, warehouse_id=warehouse_id).first()

        if not current_inventory:
            # If no existing inventory record, create one with default quantities
            current_inventory = CurrentInventory(
                part_id=part_id,
                warehouse_id=warehouse_id,
                quantity_on_hand=0,
                reserved_quantity=0,
                available_quantity=0,
                safety_stock=safety_stock,
                reorder_point=reorder_point
            )
            db.session.add(current_inventory)
        else:
            current_inventory.safety_stock = safety_stock
            current_inventory.reorder_point = reorder_point
        
        try:
            db.session.commit()
            return {'success': True, 'message': 'Inventory policy updated successfully'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'error': str(e)}
