from extensions import db
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from .part import Part, Warehouse # Import Part and Warehouse models
import random

# Helper function to get current time in UTC+8
def get_taipei_time():
    from datetime import timezone
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

class CurrentInventory(db.Model):
    __tablename__ = 'current_inventory'
    id = db.Column(db.Integer, primary_key=True)
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    quantity_on_hand = db.Column(db.Integer, default=0)
    reserved_quantity = db.Column(db.Integer, default=0)
    available_quantity = db.Column(db.Integer, default=0)
    last_updated = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)

    # Relationships
    part = relationship("Part", backref="inventory_records")
    warehouse = relationship("Warehouse", backref="inventory_records")

    __table_args__ = (db.UniqueConstraint('part_id', 'warehouse_id', name='_part_warehouse_uc'),)

    def to_dict(self):
        return {
            'id': self.id,
            'part_id': self.part_id,
            'warehouse_id': self.warehouse_id,
            'quantity_on_hand': self.quantity_on_hand,
            'reserved_quantity': self.reserved_quantity,
            'available_quantity': self.available_quantity,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'part_number': self.part.part_number if self.part else None,
            'part_name': self.part.name if self.part else None,
            'unit': self.part.unit if self.part else None,
            'safety_stock': self.part.safety_stock if self.part else None,
            'reorder_point': self.part.reorder_point if self.part else None,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'warehouse_code': self.warehouse.code if self.warehouse else None,
        }

    @classmethod
    def get_current_stock(cls, part_id, warehouse_id=None):
        query = cls.query.filter_by(part_id=part_id)
        if warehouse_id:
            stock = query.filter_by(warehouse_id=warehouse_id).first()
            return stock.to_dict() if stock else None
        stocks = query.all()
        return [stock.to_dict() for stock in stocks]

    @classmethod
    def get_all_inventory(cls, warehouse_id=None):
        query = cls.query.join(Part).join(Warehouse)
        if warehouse_id:
            query = query.filter(cls.warehouse_id == warehouse_id)
        inventories = query.order_by(Warehouse.code, Part.part_number).all()
        return [inv.to_dict() for inv in inventories]

    @classmethod
    def get_low_stock_items(cls, warehouse_id=None):
        query = cls.query.join(Part).join(Warehouse)
        if warehouse_id:
            query = query.filter(cls.warehouse_id == warehouse_id)
        query = query.filter(cls.available_quantity <= Part.reorder_point)
        items = query.order_by(cls.available_quantity - Part.reorder_point).all()
        return [item.to_dict() for item in items]

    @classmethod
    def update_stock(cls, part_id, warehouse_id, quantity_change, transaction_type, reference_type=None, reference_id=None, notes=None):
        current_stock = cls.query.filter_by(part_id=part_id, warehouse_id=warehouse_id).first()
        
        if not current_stock:
            # If inventory record doesn't exist, create a new one
            new_quantity = max(0, quantity_change)
            new_available = new_quantity
            current_stock = cls(
                part_id=part_id,
                warehouse_id=warehouse_id,
                quantity_on_hand=new_quantity,
                available_quantity=new_available
            )
            db.session.add(current_stock)
        else:
            # Update existing inventory
            current_stock.quantity_on_hand += quantity_change
            current_stock.available_quantity = current_stock.quantity_on_hand # Simplified, not considering reserved
            current_stock.quantity_on_hand = max(0, current_stock.quantity_on_hand)
            current_stock.available_quantity = max(0, current_stock.available_quantity)
        
        # Record transaction
        transaction = InventoryTransaction(
            part_id=part_id,
            warehouse_id=warehouse_id,
            transaction_type=transaction_type,
            quantity=quantity_change,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            transaction_date=get_taipei_time()
        )
        db.session.add(transaction)
        
        try:
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"更新庫存失敗: {e}")
            return False

class InventoryTransaction(db.Model):
    __tablename__ = 'inventory_transactions'
    id = db.Column(db.Integer, primary_key=True)
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    transaction_type = db.Column(db.String(50), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_cost = db.Column(db.Numeric(10, 2), default=0)
    reference_type = db.Column(db.String(50))
    reference_id = db.Column(db.Integer)
    notes = db.Column(db.Text)
    transaction_date = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.String(100), default='system')
    created_at = db.Column(db.DateTime, default=get_taipei_time)

    # Relationships
    part = relationship("Part", backref="transactions")
    warehouse = relationship("Warehouse", backref="transactions")

    def to_dict(self):
        return {
            'id': self.id,
            'part_id': self.part_id,
            'warehouse_id': self.warehouse_id,
            'transaction_type': self.transaction_type,
            'quantity': self.quantity,
            'unit_cost': float(self.unit_cost),
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'notes': self.notes,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'part_number': self.part.part_number if self.part else None,
            'part_name': self.part.name if self.part else None,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
        }

    @classmethod
    def get_transactions(cls, part_id=None, warehouse_id=None, limit=100):
        query = cls.query.join(Part).join(Warehouse)
        if part_id:
            query = query.filter(cls.part_id == part_id)
        if warehouse_id:
            query = query.filter(cls.warehouse_id == warehouse_id)
        return query.order_by(db.desc(cls.transaction_date), db.desc(cls.id)).limit(limit).all()

    @classmethod
    def get_transaction_summary(cls, part_id, warehouse_id=None, days=30):
        from sqlalchemy import func, case
        query = db.session.query(
            func.sum(case((cls.quantity > 0, cls.quantity), else_=0)).label('total_in'),
            func.sum(case((cls.quantity < 0, db.func.abs(cls.quantity)), else_=0)).label('total_out'),
            func.count(cls.id).label('transaction_count')
        ).filter(cls.part_id == part_id)

        if warehouse_id:
            query = query.filter(cls.warehouse_id == warehouse_id)
        
        # Filter by date
        thirty_days_ago = get_taipei_time() - timedelta(days=days)
        query = query.filter(cls.transaction_date >= thirty_days_ago)

        summary = query.first()
        return {
            'total_in': summary.total_in or 0,
            'total_out': summary.total_out or 0,
            'transaction_count': summary.transaction_count or 0
        }

class StockCount(db.Model):
    __tablename__ = 'stock_counts'
    id = db.Column(db.Integer, primary_key=True)
    count_number = db.Column(db.String(100), unique=True, nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    count_date = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='planning')
    count_type = db.Column(db.String(50), nullable=False, default='full')
    description = db.Column(db.Text)
    counted_by = db.Column(db.String(100))
    verified_by = db.Column(db.String(100))
    total_items = db.Column(db.Integer, default=0)
    variance_items = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    completed_at = db.Column(db.DateTime)

    # Relationships
    warehouse = relationship("Warehouse", backref="stock_counts")
    details = relationship("StockCountDetail", back_populates="stock_count", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'count_number': self.count_number,
            'warehouse_id': self.warehouse_id,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'count_date': self.count_date.isoformat() if self.count_date else None,
            'status': self.status,
            'count_type': self.count_type,
            'description': self.description,
            'counted_by': self.counted_by,
            'verified_by': self.verified_by,
            'total_items': self.total_items,
            'variance_items': self.variance_items,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def get_all_counts(cls):
        counts = cls.query.order_by(db.desc(cls.created_at)).all()
        return [count.to_dict() for count in counts]

    @classmethod
    def get_count_by_id(cls, count_id):
        count = cls.query.get(count_id)
        return count.to_dict() if count else None

    @classmethod
    def create_count(cls, warehouse_id, count_type='full', description='', counted_by=''):
        count_number = f"SC-{get_taipei_time().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
        
        new_count = cls(
            count_number=count_number,
            warehouse_id=warehouse_id,
            count_date=get_taipei_time(),
            count_type=count_type,
            description=description,
            counted_by=counted_by
        )
        db.session.add(new_count)
        db.session.flush() # Flush to get new_count.id

        # Auto-add stock count details (all items in current inventory for that warehouse)
        inventory_items = CurrentInventory.query.filter_by(warehouse_id=warehouse_id).filter(CurrentInventory.quantity_on_hand > 0).all()
        for item in inventory_items:
            detail = StockCountDetail(
                stock_count_id=new_count.id,
                part_id=item.part_id,
                system_quantity=item.quantity_on_hand
            )
            db.session.add(detail)
        
        db.session.commit()
        return new_count.id

    @classmethod
    def update_count(cls, count_id, count_type, count_date, counted_by, notes):
        count = cls.query.get(count_id)
        if not count:
            return False
        
        try:
            count.count_type = count_type
            count.count_date = count_date
            count.counted_by = counted_by
            count.notes = notes
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"更新盤點失敗: {e}")
            return False

    @classmethod
    def start_count(cls, count_id):
        count = cls.query.get(count_id)
        if count and count.status == 'planning':
            count.status = 'counting'
            db.session.commit()
            return True
        return False

    @classmethod
    def add_count_item(cls, count_id, part_id, actual_quantity, notes=''):
        detail = StockCountDetail.query.filter_by(stock_count_id=count_id, part_id=part_id).first()
        
        if detail:
            return cls.update_count_item(count_id, part_id, actual_quantity, notes)
        
        # Get system quantity
        stock_count = cls.query.get(count_id)
        if not stock_count:
            return False
        
        current_inventory = CurrentInventory.query.filter_by(
            part_id=part_id, warehouse_id=stock_count.warehouse_id
        ).first()
        system_quantity = current_inventory.quantity_on_hand if current_inventory else 0
        variance = actual_quantity - system_quantity

        new_detail = StockCountDetail(
            stock_count_id=count_id,
            part_id=part_id,
            system_quantity=system_quantity,
            counted_quantity=actual_quantity,
            variance_quantity=variance,
            notes=notes,
            counted_at=get_taipei_time()
        )
        db.session.add(new_detail)
        db.session.commit()
        return True

    @classmethod
    def update_count_item(cls, count_id, part_id, actual_quantity, notes=''):
        detail = StockCountDetail.query.filter_by(stock_count_id=count_id, part_id=part_id).first()
        if detail:
            detail.counted_quantity = actual_quantity
            detail.variance_quantity = actual_quantity - detail.system_quantity
            detail.notes = notes
            detail.counted_at = get_taipei_time()
            db.session.commit()
            return True
        return False

    @classmethod
    def get_count_details(cls, count_id):
        details = StockCountDetail.query.join(Part).filter(
            StockCountDetail.stock_count_id == count_id
        ).order_by(Part.part_number).all()
        return [detail.to_dict() for detail in details]

    @classmethod
    def update_count_detail(cls, detail_id, counted_quantity, notes=''):
        detail = StockCountDetail.query.get(detail_id)
        if detail:
            detail.counted_quantity = counted_quantity
            detail.variance_quantity = counted_quantity - detail.system_quantity
            detail.notes = notes
            detail.counted_at = get_taipei_time()
            db.session.commit()
            return True
        return False

    @classmethod
    def complete_count(cls, count_id, verified_by='', apply_adjustments=False):
        count = cls.query.get(count_id)
        if not count:
            return False
        
        count.status = 'completed'
        count.verified_by = verified_by
        count.completed_at = get_taipei_time()
        
        if apply_adjustments:
            for detail in count.details:
                if detail.variance_quantity != 0:
                    CurrentInventory.update_stock(
                        detail.part_id, count.warehouse_id, detail.variance_quantity, 'ADJUST',
                        'COUNT', count.id, f'盤點調整 (差異: {detail.variance_quantity})'
                    )
        
        db.session.commit()
        return True

    @classmethod
    def import_count_data(cls, count_id, count_data):
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
                
                part = Part.query.filter_by(part_number=part_number).first()
                if not part:
                    error_list.append(f"第{row_num}行: 找不到零件編號 {part_number}")
                    continue
                
                detail = StockCountDetail.query.filter_by(stock_count_id=count_id, part_id=part.id).first()
                if not detail:
                    error_list.append(f"第{row_num}行: 在盤點中找不到零件 {part_number}")
                    continue
                
                try:
                    counted_qty = int(counted_qty)
                except (ValueError, TypeError):
                    error_list.append(f"第{row_num}行: 盤點數量必須是數字")
                    continue
                
                detail.counted_quantity = counted_qty
                detail.variance_quantity = counted_qty - detail.system_quantity
                detail.notes = notes
                detail.counted_at = get_taipei_time()
                
                success_count += 1
                
            except Exception as e:
                error_list.append(f"第{row_num}行: 處理錯誤 - {str(e)}")
        
        db.session.commit()
        return success_count, error_list

class StockCountDetail(db.Model):
    __tablename__ = 'stock_count_details'
    id = db.Column(db.Integer, primary_key=True)
    stock_count_id = db.Column(db.Integer, db.ForeignKey('stock_counts.id'), nullable=False)
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), nullable=False)
    system_quantity = db.Column(db.Integer, nullable=False)
    counted_quantity = db.Column(db.Integer)
    variance_quantity = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    counted_at = db.Column(db.DateTime)

    # Relationships
    stock_count = relationship("StockCount", back_populates="details")
    part = relationship("Part", backref="stock_count_details")

    __table_args__ = (db.UniqueConstraint('stock_count_id', 'part_id', name='_stock_count_part_uc'),)

    def to_dict(self):
        return {
            'id': self.id,
            'stock_count_id': self.stock_count_id,
            'part_id': self.part_id,
            'part_number': self.part.part_number if self.part else None,
            'part_name': self.part.name if self.part else None,
            'unit': self.part.unit if self.part else None,  # 使用 unit 而不是 part_unit
            'system_quantity': self.system_quantity,
            'counted_quantity': self.counted_quantity,
            'variance_quantity': self.variance_quantity,
            'notes': self.notes,
            'counted_at': self.counted_at.isoformat() if self.counted_at else None,
        }
