from extensions import db # Import the SQLAlchemy db instance
from sqlalchemy.orm import relationship
from sqlalchemy import event
from datetime import datetime

# Helper function to get current time in UTC+8
def get_taipei_time():
    from datetime import timezone, timedelta
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

# Association table for Part and WarehouseLocation
class PartWarehouseLocation(db.Model):
    __tablename__ = 'part_locations'
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), primary_key=True)
    warehouse_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), primary_key=True)

    # Relationships
    warehouse_location = relationship("WarehouseLocation", back_populates="part_associations")
    part = relationship("Part", back_populates="location_associations")

    def __init__(self, part_id, warehouse_location_id):
        self.part_id = part_id
        self.warehouse_location_id = warehouse_location_id

class Warehouse(db.Model):
    __tablename__ = 'warehouses'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=get_taipei_time)

    # Relationship to WarehouseLocation
    locations = relationship("WarehouseLocation", back_populates="warehouse")

    def __init__(self, code, name, description=None, is_active=True, created_at=None):
        self.code = code
        self.name = name
        self.description = description
        self.is_active = is_active
        self.created_at = created_at if created_at is not None else get_taipei_time()

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def get_all(cls):
        """取得所有倉庫"""
        warehouses = cls.query.filter_by(is_active=True).all()
        return [warehouse.to_dict() for warehouse in warehouses]
    
    @classmethod
    def get_by_id(cls, warehouse_id):
        """根據ID取得倉庫"""
        return cls.query.get(warehouse_id)

class WarehouseLocation(db.Model):
    __tablename__ = 'warehouse_locations'
    id = db.Column(db.Integer, primary_key=True)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False)
    location_code = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(255))

    # Unique constraint
    __table_args__ = (db.UniqueConstraint('warehouse_id', 'location_code', name='_warehouse_location_uc'),)

    # Relationships
    warehouse = relationship("Warehouse", back_populates="locations")
    part_associations = relationship("PartWarehouseLocation", back_populates="warehouse_location")

    def __init__(self, warehouse_id, location_code, description=None):
        self.warehouse_id = warehouse_id
        self.location_code = location_code
        self.description = description

    def to_dict(self):
        return {
            'id': self.id,
            'warehouse_id': self.warehouse_id,
            'location_code': self.location_code,
            'description': self.description,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'warehouse_code': self.warehouse.code if self.warehouse else None
        }

class Part(db.Model):
    __tablename__ = 'parts'
    id = db.Column(db.Integer, primary_key=True)
    part_number = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    unit = db.Column(db.String(50), nullable=False, default='個')
    quantity_per_box = db.Column(db.Integer, nullable=False)
    safety_stock = db.Column(db.Integer, default=0)
    reorder_point = db.Column(db.Integer, default=0)
    standard_cost = db.Column(db.Numeric(10, 2), default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=get_taipei_time)

    # Relationship to PartWarehouseLocation
    location_associations = relationship("PartWarehouseLocation", back_populates="part", cascade="all, delete-orphan")

    def __init__(self, part_number, name, description=None, unit='個', quantity_per_box=1,
                 safety_stock=0, reorder_point=0, standard_cost=0, is_active=True, created_at=None):
        self.part_number = part_number
        self.name = name
        self.description = description
        self.unit = unit
        self.quantity_per_box = quantity_per_box
        self.safety_stock = safety_stock
        self.reorder_point = reorder_point
        self.standard_cost = standard_cost
        self.is_active = is_active
        self.created_at = created_at if created_at is not None else get_taipei_time()

    def to_dict(self, include_locations=False):
        data = {
            'id': self.id,
            'part_number': self.part_number,
            'name': self.name,
            'description': self.description,
            'unit': self.unit,
            'quantity_per_box': self.quantity_per_box,
            'safety_stock': self.safety_stock,
            'reorder_point': self.reorder_point,
            'standard_cost': float(self.standard_cost),
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_locations:
            data['locations'] = [assoc.warehouse_location.to_dict() for assoc in self.location_associations]
        return data

    @classmethod
    def get_by_part_number(cls, part_number):
        return cls.query.filter_by(part_number=part_number).first()

    @classmethod
    def get_by_id(cls, part_id):
        return cls.query.get(part_id)
    
    @classmethod
    def get_all(cls, search_term=None, sort_by='part_number', sort_order='asc', page=1, per_page=50):
        from sqlalchemy import or_
        query = cls.query

        if search_term:
            query = query.filter(or_(
                cls.name.ilike(f'%{search_term}%'),
                cls.part_number.ilike(f'%{search_term}%')
            ))
        
        # Basic validation for sort_by
        valid_columns = ['part_number', 'name', 'description', 'unit', 'quantity_per_box', 
                         'safety_stock', 'reorder_point', 'standard_cost', 'created_at']
        if sort_by not in valid_columns:
            sort_by = 'part_number'
            
        if sort_order.lower() == 'desc':
            query = query.order_by(db.desc(getattr(cls, sort_by)))
        else:
            query = query.order_by(getattr(cls, sort_by))
        
        return query.paginate(page=page, per_page=per_page, error_out=False)

    @classmethod
    def create(cls, part_number, name, description, unit, quantity_per_box, locations_data, 
               safety_stock=0, reorder_point=0, standard_cost=0, is_active=True):
        
        if cls.query.filter_by(part_number=part_number).first():
            return {'success': False, 'error': '零件編號已存在'}
        
        # 檢查倉位衝突
        location_conflicts = []
        if locations_data:
            for loc_data in locations_data:
                warehouse_id = loc_data.get('warehouse_id')
                location_code = loc_data.get('location_code')
                if warehouse_id and location_code:
                    # 查找倉位
                    wh_loc = WarehouseLocation.query.filter_by(
                        warehouse_id=warehouse_id, location_code=location_code
                    ).first()
                    
                    if wh_loc:
                        # 檢查是否有其他零件使用此倉位
                        other_parts = PartWarehouseLocation.query.filter_by(
                            warehouse_location_id=wh_loc.id
                        ).all()
                        
                        if other_parts:
                            # 獲取使用此倉位的零件資訊
                            conflict_parts = []
                            for assoc in other_parts:
                                part = cls.query.get(assoc.part_id)
                                if part:
                                    conflict_parts.append(f"{part.part_number} - {part.name}")
                            
                            warehouse = Warehouse.query.get(warehouse_id)
                            warehouse_name = warehouse.name if warehouse else f"倉庫ID:{warehouse_id}"
                            
                            location_conflicts.append({
                                'warehouse': warehouse_name,
                                'location': location_code,
                                'parts': conflict_parts
                            })
        
        # 如果有衝突，返回錯誤信息
        if location_conflicts:
            return {
                'success': False, 
                'error': 'location_conflict',
                'conflicts': location_conflicts
            }

        new_part = cls(
            part_number=part_number,
            name=name,
            description=description,
            unit=unit,
            quantity_per_box=quantity_per_box,
            safety_stock=safety_stock,
            reorder_point=reorder_point,
            standard_cost=standard_cost,
            is_active=is_active
        )
        db.session.add(new_part)
        db.session.flush() # Flush to get new_part.id

        if locations_data:
            for loc_data in locations_data:
                warehouse_id = loc_data.get('warehouse_id')
                location_code = loc_data.get('location_code')
                if warehouse_id and location_code:
                    wh_loc = WarehouseLocation.query.filter_by(
                        warehouse_id=warehouse_id, location_code=location_code
                    ).first()
                    if not wh_loc:
                        wh_loc = WarehouseLocation(warehouse_id=warehouse_id, location_code=location_code)
                        db.session.add(wh_loc)
                        db.session.flush() # Flush to get wh_loc.id
                    
                    # Check if association already exists
                    existing_assoc = PartWarehouseLocation.query.filter_by(
                        part_id=new_part.id, warehouse_location_id=wh_loc.id
                    ).first()
                    if not existing_assoc:
                        assoc = PartWarehouseLocation(new_part.id, wh_loc.id) # Use positional arguments for __init__
                        db.session.add(assoc)
        
        db.session.commit()
        return {'success': True}

    @classmethod
    def update(cls, part_id, part_number, name, description, unit, quantity_per_box, locations_data,
               safety_stock=0, reorder_point=0, standard_cost=0, is_active=True):
        
        part = cls.query.get(part_id)
        if not part:
            return {'success': False, 'error': '找不到零件'}

        # Check for duplicate part number if changed
        if part.part_number != part_number and cls.query.filter_by(part_number=part_number).first():
            return {'success': False, 'error': '零件編號已存在'}
        
        # 檢查倉位衝突（排除自己目前使用的倉位）
        location_conflicts = []
        if locations_data:
            for loc_data in locations_data:
                warehouse_id = loc_data.get('warehouse_id')
                location_code = loc_data.get('location_code')
                if warehouse_id and location_code:
                    # 查找倉位
                    wh_loc = WarehouseLocation.query.filter_by(
                        warehouse_id=warehouse_id, location_code=location_code
                    ).first()
                    
                    if wh_loc:
                        # 檢查是否有其他零件使用此倉位（排除當前零件）
                        other_parts = PartWarehouseLocation.query.filter(
                            PartWarehouseLocation.warehouse_location_id == wh_loc.id,
                            PartWarehouseLocation.part_id != part_id
                        ).all()
                        
                        if other_parts:
                            # 獲取使用此倉位的零件資訊
                            conflict_parts = []
                            for assoc in other_parts:
                                conflict_part = cls.query.get(assoc.part_id)
                                if conflict_part:
                                    conflict_parts.append(f"{conflict_part.part_number} - {conflict_part.name}")
                            
                            warehouse = Warehouse.query.get(warehouse_id)
                            warehouse_name = warehouse.name if warehouse else f"倉庫ID:{warehouse_id}"
                            
                            location_conflicts.append({
                                'warehouse': warehouse_name,
                                'location': location_code,
                                'parts': conflict_parts
                            })
        
        # 如果有衝突，返回錯誤信息
        if location_conflicts:
            return {
                'success': False, 
                'error': 'location_conflict',
                'conflicts': location_conflicts
            }

        part.part_number = part_number
        part.name = name
        part.description = description
        part.unit = unit
        part.quantity_per_box = quantity_per_box
        part.safety_stock = safety_stock
        part.reorder_point = reorder_point
        part.standard_cost = standard_cost
        part.is_active = is_active

        # Update locations: delete all existing and insert new ones
        # Clear existing associations
        part.location_associations = []
        db.session.flush() # Flush to ensure deletions are processed

        if locations_data:
            for loc_data in locations_data:
                warehouse_id = loc_data.get('warehouse_id')
                location_code = loc_data.get('location_code')
                if warehouse_id and location_code:
                    wh_loc = WarehouseLocation.query.filter_by(
                        warehouse_id=warehouse_id, location_code=location_code
                    ).first()
                    if not wh_loc:
                        wh_loc = WarehouseLocation(warehouse_id=warehouse_id, location_code=location_code)
                        db.session.add(wh_loc)
                        db.session.flush()
                    
                    # Check if association already exists (shouldn't if cleared above, but good practice)
                    existing_assoc = PartWarehouseLocation.query.filter_by(
                        part_id=part.id, warehouse_location_id=wh_loc.id
                    ).first()
                    if not existing_assoc:
                        assoc = PartWarehouseLocation(part.id, wh_loc.id) # Use positional arguments for __init__
                        db.session.add(assoc)
        
        db.session.commit()
        return {'success': True}

    @classmethod
    def delete(cls, part_id):
        part = cls.query.get(part_id)
        if part:
            db.session.delete(part)
            db.session.commit()
            return True
        return False
    
    @classmethod
    def exists(cls, part_number):
        return cls.query.filter_by(part_number=part_number).first() is not None

    @classmethod
    def get_all_warehouses(cls):
        return Warehouse.query.order_by(Warehouse.name).all()

    @classmethod
    def get_warehouse_by_code(cls, code):
        return Warehouse.query.filter_by(code=code).first()
