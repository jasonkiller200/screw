from extensions import db
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from .part import Part, Warehouse # Import Part and Warehouse models
import random
import sqlalchemy as sa

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
    warehouse_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=False)
    quantity_on_hand = db.Column(db.Integer, default=0)
    reserved_quantity = db.Column(db.Integer, default=0)
    available_quantity = db.Column(db.Integer, default=0)
    safety_stock = db.Column(db.Integer, default=0, nullable=False)
    reorder_point = db.Column(db.Integer, default=0, nullable=False)
    last_updated = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)

    # Relationships
    part = relationship("Part", backref="inventory_records")
    warehouse = relationship("Warehouse", backref="inventory_records")
    warehouse_location = relationship("WarehouseLocation", backref="current_inventory_records")

    __table_args__ = (db.UniqueConstraint('part_id', 'warehouse_location_id', name='_part_warehouse_location_uc'),)

    def to_dict(self):
        return {
            'id': self.id,
            'part_id': self.part_id,
            'warehouse_id': self.warehouse_id,
            'warehouse_location_id': self.warehouse_location_id,
            'location_code': self.warehouse_location.location_code if self.warehouse_location else None,
            'quantity_on_hand': self.quantity_on_hand,
            'reserved_quantity': self.reserved_quantity,
            'available_quantity': self.available_quantity,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'part_number': self.part.part_number if self.part else None,
            'part_name': self.part.name if self.part else None,
            'unit': self.part.unit if self.part else None,
            'safety_stock': self.safety_stock,
            'reorder_point': self.reorder_point,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'warehouse_code': self.warehouse.code if self.warehouse else None,
        }

    @classmethod
    def get_current_stock(cls, part_id, warehouse_location_id=None):
        query = cls.query.filter_by(part_id=part_id)
        if warehouse_location_id:
            stock = query.filter_by(warehouse_location_id=warehouse_location_id).first()
            return stock.to_dict() if stock else None
        stocks = query.all()
        return [stock.to_dict() for stock in stocks]

    @classmethod
    def get_detailed_inventory_view(cls, warehouse_id=None):
        from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation

        # Start with all part-location associations
        query = (db.session.query(
            Part.id.label('part_id'),
            Part.part_number,
            Part.name.label('part_name'),
            Part.type.label('part_type'),
            Part.unit,
            Warehouse.id.label('warehouse_id'),
            Warehouse.name.label('warehouse_name'),
            Warehouse.code.label('warehouse_code'),
            WarehouseLocation.id.label('location_id'),
            WarehouseLocation.location_code,
            cls.quantity_on_hand,
            cls.reserved_quantity,
            cls.available_quantity,
            cls.safety_stock,
            cls.reorder_point
        )
        .select_from(Part)
        .join(PartWarehouseLocation, Part.id == PartWarehouseLocation.part_id)
        .join(WarehouseLocation, PartWarehouseLocation.warehouse_location_id == WarehouseLocation.id)
        .join(Warehouse, WarehouseLocation.warehouse_id == Warehouse.id)
        .outerjoin(cls, sa.and_(
            Part.id == cls.part_id,
            WarehouseLocation.id == cls.warehouse_location_id
        )))

        if warehouse_id:
            query = query.filter(Warehouse.id == warehouse_id)

        # Order by warehouse code, part number, and location code for consistent display
        query = query.order_by(Warehouse.code, Part.part_number, WarehouseLocation.location_code)

        results = query.all()

        detailed_inventory = []
        for row in results:
            detailed_inventory.append({
                'part_id': row.part_id,
                'part_number': row.part_number,
                'part_name': row.part_name,
                'part_type': row.part_type,
                'unit': row.unit,
                'warehouse_id': row.warehouse_id,
                'warehouse_name': row.warehouse_name,
                'warehouse_code': row.warehouse_code,
                'location_id': row.location_id,
                'location_code': row.location_code,
                'quantity_on_hand': row.quantity_on_hand if row.quantity_on_hand is not None else 0,
                'reserved_quantity': row.reserved_quantity if row.reserved_quantity is not None else 0,
                'available_quantity': row.available_quantity if row.available_quantity is not None else 0,
                'safety_stock': row.safety_stock if row.safety_stock is not None else 0,
                'reorder_point': row.reorder_point if row.reorder_point is not None else 0,
            })
        return detailed_inventory

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
        query = query.filter(sa.and_(cls.reorder_point > 0, cls.available_quantity <= cls.reorder_point))
        items = query.order_by(cls.available_quantity - cls.reorder_point).all()
        return [item.to_dict() for item in items]

    @classmethod
    def update_stock(cls, part_id, warehouse_location_id, quantity_change, transaction_type, reference_type=None, reference_id=None, notes=None, user_id=None, commit=True):
        from .part import WarehouseLocation
        
        # Find the specific inventory record for the part at the given location
        current_stock = cls.query.filter_by(
            part_id=part_id, 
            warehouse_location_id=warehouse_location_id
        ).first()
        
        # Get the warehouse_id from the location
        location = WarehouseLocation.query.get(warehouse_location_id)
        if not location:
            print(f"Error: WarehouseLocation with ID {warehouse_location_id} not found.")
            return False
        warehouse_id = location.warehouse_id

        if not current_stock:
            # If inventory record doesn't exist for this location, create a new one
            new_quantity = max(0, quantity_change)
            current_stock = cls(
                part_id=part_id,
                warehouse_id=warehouse_id,
                warehouse_location_id=warehouse_location_id,
                quantity_on_hand=new_quantity,
                available_quantity=new_quantity # Simplified, not considering reserved
            )
            db.session.add(current_stock)
        else:
            # Update existing inventory
            current_stock.quantity_on_hand += quantity_change
            current_stock.available_quantity = current_stock.quantity_on_hand - current_stock.reserved_quantity
            current_stock.quantity_on_hand = max(0, current_stock.quantity_on_hand)
            current_stock.available_quantity = max(0, current_stock.available_quantity)
        
        # Record transaction with location information and user
        transaction = InventoryTransaction(
            part_id=part_id,
            warehouse_id=warehouse_id,
            warehouse_location_id=warehouse_location_id,
            transaction_type=transaction_type,
            quantity=quantity_change,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            user_id=user_id,
            transaction_date=get_taipei_time()
        )
        db.session.add(transaction)
        
        if not commit:
            return True

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
    warehouse_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True) # Nullable for warehouse-level transactions
    transaction_type = db.Column(db.String(50), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_cost = db.Column(db.Numeric(10, 2), default=0)
    reference_type = db.Column(db.String(50))
    reference_id = db.Column(db.Integer)
    notes = db.Column(db.Text)
    transaction_date = db.Column(db.DateTime, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, comment='操作人員ID')
    created_by = db.Column(db.String(100), default='system', comment='建立者（系統/遷移用）')
    created_at = db.Column(db.DateTime, default=get_taipei_time)

    # Relationships
    part = relationship("Part", backref="transactions")
    warehouse = relationship("Warehouse", backref="transactions")
    warehouse_location = relationship("WarehouseLocation", backref="transactions")
    user = relationship("User", foreign_keys=[user_id], backref="inventory_transactions")

    def to_dict(self):
        return {
            'id': self.id,
            'part_id': self.part_id,
            'warehouse_id': self.warehouse_id,
            'warehouse_location_id': self.warehouse_location_id,
            'location_code': self.warehouse_location.location_code if self.warehouse_location else None,
            'transaction_type': self.transaction_type,
            'quantity': self.quantity,
            'unit_cost': float(self.unit_cost),
            'reference_type': self.reference_type,
            'reference_id': self.reference_id,
            'notes': self.notes,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
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
        from .part import PartWarehouseLocation, WarehouseLocation

        count_number = f"SC-{get_taipei_time().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
        
        new_count = cls(
            count_number=count_number,
            warehouse_id=warehouse_id,
            count_date=get_taipei_time(),
            count_type=count_type,
            description=description,
            counted_by=counted_by,
            status='planning' # Explicitly set status
        )
        db.session.add(new_count)
        db.session.flush() # Flush to get new_count.id

        # Get all part-location combinations for the given warehouse
        part_locations_query = db.session.query(
            PartWarehouseLocation.part_id,
            PartWarehouseLocation.warehouse_location_id
        ).join(WarehouseLocation).filter(WarehouseLocation.warehouse_id == warehouse_id)

        # For 'spot' counts, we might only want locations with stock.
        # For now, we'll include all assigned locations as per the plan's main goal.
        # This can be refined later if needed.
        
        part_locations = part_locations_query.all()

        for part_id, location_id in part_locations:
            # Get system quantity for this specific part and location
            current_stock = CurrentInventory.query.filter_by(
                part_id=part_id,
                warehouse_location_id=location_id
            ).first()
            
            system_quantity = current_stock.quantity_on_hand if current_stock else 0

            detail = StockCountDetail(
                stock_count_id=new_count.id,
                part_id=part_id,
                warehouse_location_id=location_id,
                system_quantity=system_quantity,
                counted_quantity=None # Explicitly start as null
            )
            db.session.add(detail)
        
        try:
            db.session.commit()
            return new_count.id
        except Exception as e:
            db.session.rollback()
            print(f"Error creating stock count: {e}")
            return None

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
    def add_count_item(cls, count_id, part_id, warehouse_location_id, actual_quantity, notes=''):
        detail = StockCountDetail.query.filter_by(
            stock_count_id=count_id, 
            part_id=part_id,
            warehouse_location_id=warehouse_location_id
        ).first()
        
        if detail:
            # Item already exists, so update it
            return cls.update_count_item(count_id, part_id, warehouse_location_id, actual_quantity, notes)
        
        # If item does not exist, create a new one (for items added manually during count)
        stock_count = cls.query.get(count_id)
        if not stock_count:
            return False
        
        # Get system quantity for the new item/location
        current_inventory = CurrentInventory.query.filter_by(
            part_id=part_id, warehouse_location_id=warehouse_location_id
        ).first()
        system_quantity = current_inventory.quantity_on_hand if current_inventory else 0
        variance = actual_quantity - system_quantity

        new_detail = StockCountDetail(
            stock_count_id=count_id,
            part_id=part_id,
            warehouse_location_id=warehouse_location_id,
            system_quantity=system_quantity,
            counted_quantity=actual_quantity,
            variance_quantity=variance,
            notes=notes,
            counted_at=get_taipei_time()
        )
        db.session.add(new_detail)
        try:
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error adding count item: {e}")
            return False

    @classmethod
    def update_count_item(cls, count_id, part_id, warehouse_location_id, actual_quantity, notes=''):
        detail = StockCountDetail.query.filter_by(
            stock_count_id=count_id, 
            part_id=part_id,
            warehouse_location_id=warehouse_location_id
        ).first()

        if detail:
            try:
                detail.counted_quantity = actual_quantity
                detail.variance_quantity = actual_quantity - detail.system_quantity
                detail.notes = notes
                detail.counted_at = get_taipei_time()
                db.session.commit()
                return True
            except Exception as e:
                db.session.rollback()
                print(f"Error updating count item: {e}")
                return False
        return False

    @classmethod
    def get_count_details(cls, count_id, sort_by='part_number', sort_order='asc'):
        from .part import Part, WarehouseLocation # Simplified import

        query = StockCountDetail.query.filter(StockCountDetail.stock_count_id == count_id)

        # Join Part for sorting by part fields
        query = query.join(Part, StockCountDetail.part_id == Part.id)

        # Determine the sorting column and direction
        order_column = None
        if sort_by == 'storage_location':
            # Join WarehouseLocation for sorting by location_code
            query = query.outerjoin(WarehouseLocation, StockCountDetail.warehouse_location_id == WarehouseLocation.id)
            order_column = db.func.coalesce(WarehouseLocation.location_code, '')
        elif sort_by == 'part_name':
            order_column = Part.name
        elif sort_by == 'system_quantity':
            order_column = StockCountDetail.system_quantity
        elif sort_by == 'counted_quantity':
            # Handle nulls by treating them as a low value
            order_column = db.func.coalesce(StockCountDetail.counted_quantity, -1)
        elif sort_by == 'variance_quantity':
            order_column = StockCountDetail.variance_quantity
        else:  # Default to part_number
            order_column = Part.part_number

        # Apply sorting direction
        if sort_order == 'desc':
            query = query.order_by(db.desc(order_column))
        else:
            query = query.order_by(order_column)

        details = query.all()
        return [detail.to_dict() for detail in details]

    @classmethod
    def update_count_detail(cls, detail_id, counted_quantity, notes=''):
        detail = StockCountDetail.query.get(detail_id)
        if detail:
            try:
                detail.counted_quantity = counted_quantity
                detail.variance_quantity = counted_quantity - detail.system_quantity
                detail.notes = notes
                detail.counted_at = get_taipei_time()
                db.session.commit()
                return True, detail.to_dict()
            except Exception as e:
                db.session.rollback()
                print(f"Error updating count detail: {e}")
                return False, None
        return False, None

    @classmethod
    def complete_count(cls, count_id, verified_by='', apply_adjustments=False, user_id=None):
        count = cls.query.get(count_id)
        if not count:
            return False
        
        count.status = 'completed'
        count.verified_by = verified_by
        count.completed_at = get_taipei_time()
        
        if apply_adjustments:
            for detail in count.details:
                # Ensure there is a variance and a location to adjust
                if detail.variance_quantity != 0 and detail.warehouse_location_id is not None:
                    CurrentInventory.update_stock(
                        part_id=detail.part_id, 
                        warehouse_location_id=detail.warehouse_location_id,
                        quantity_change=detail.variance_quantity, 
                        transaction_type='ADJUST',
                        reference_type='COUNT', 
                        reference_id=count.id, 
                        notes=f'盤點調整 (差異: {detail.variance_quantity})',
                        user_id=user_id
                    )
        
        try:
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            print(f"Error completing count: {e}")
            return False

    @classmethod
    def import_count_data(cls, count_id, count_data):
        from .part import WarehouseLocation
        success_count = 0
        error_list = []
        
        stock_count = cls.query.get(count_id)
        if not stock_count:
            error_list.append("致命錯誤：找不到對應的盤點單。")
            return 0, error_list

        for row_num, row_data in enumerate(count_data, 1):
            try:
                part_number = row_data.get('part_number', row_data.get('零件編號', '')).strip()
                location_code = row_data.get('location_code', row_data.get('儲位', '')).strip()
                counted_qty_str = row_data.get('counted_quantity', row_data.get('實盤數量', ''))
                notes = row_data.get('notes', row_data.get('備註', '')).strip()
                
                if not part_number:
                    error_list.append(f"第 {row_num} 行: 零件編號不能為空")
                    continue
                
                if counted_qty_str is None or str(counted_qty_str).strip() == '':
                    # Skip rows where counted quantity is not filled
                    continue

                part = Part.query.filter_by(part_number=part_number).first()
                if not part:
                    error_list.append(f"第 {row_num} 行: 找不到零件編號 {part_number}")
                    continue
                
                # Find WarehouseLocation ID
                location = WarehouseLocation.query.filter_by(
                    location_code=location_code,
                    warehouse_id=stock_count.warehouse_id
                ).first()

                if not location:
                    error_list.append(f"第 {row_num} 行: 在此倉庫中找不到儲位 {location_code} (零件: {part_number})")
                    continue
                
                detail = StockCountDetail.query.filter_by(
                    stock_count_id=count_id, 
                    part_id=part.id,
                    warehouse_location_id=location.id
                ).first()

                if not detail:
                    error_list.append(f"第 {row_num} 行: 在盤點單中找不到零件 {part_number} 與儲位 {location_code} 的組合")
                    continue
                
                try:
                    counted_qty = int(float(counted_qty_str))
                except (ValueError, TypeError):
                    error_list.append(f"第 {row_num} 行: 盤點數量 '{counted_qty_str}' 必須是數字")
                    continue
                
                detail.counted_quantity = counted_qty
                detail.variance_quantity = counted_qty - detail.system_quantity
                detail.notes = notes
                detail.counted_at = get_taipei_time()
                
                success_count += 1
                
            except Exception as e:
                db.session.rollback() # Rollback on inner exception
                error_list.append(f"第 {row_num} 行: 處理時發生未預期錯誤 - {str(e)}")
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            error_list.append(f"最終提交時發生錯誤: {str(e)}")

        return success_count, error_list

class StockCountDetail(db.Model):
    __tablename__ = 'stock_count_details'
    id = db.Column(db.Integer, primary_key=True)
    stock_count_id = db.Column(db.Integer, db.ForeignKey('stock_counts.id'), nullable=False)
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), nullable=False)
    warehouse_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True) # Allow null for parts without specific location
    system_quantity = db.Column(db.Integer, nullable=False)
    counted_quantity = db.Column(db.Integer)
    variance_quantity = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    counted_at = db.Column(db.DateTime)

    # Relationships
    stock_count = relationship("StockCount", back_populates="details")
    part = relationship("Part", backref="stock_count_details")
    warehouse_location = relationship("WarehouseLocation", backref="stock_count_details")

    __table_args__ = (db.UniqueConstraint('stock_count_id', 'part_id', 'warehouse_location_id', name='_stock_count_part_location_uc'),)

    def to_dict(self):
        location_code = self.warehouse_location.location_code if self.warehouse_location else '無儲位'
        
        return {
            'id': self.id,
            'stock_count_id': self.stock_count_id,
            'part_id': self.part_id,
            'part_number': self.part.part_number if self.part else None,
            'part_name': self.part.name if self.part else None,
            'unit': self.part.unit if self.part else None,
            'warehouse_location_id': self.warehouse_location_id,
            'location_code': location_code,
            'storage_location_display': location_code, # Keep for compatibility for now
            'system_quantity': self.system_quantity,
            'counted_quantity': self.counted_quantity,
            'variance_quantity': self.variance_quantity,
            'notes': self.notes,
            'counted_at': self.counted_at.isoformat() if self.counted_at else None,
        }
