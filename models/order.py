from extensions import db
from sqlalchemy.orm import relationship
from datetime import datetime
from .part import Part # Import Part model for relationships
from .part import Warehouse # Import Warehouse model for relationships

# Helper function to get current time in UTC+8
def get_taipei_time():
    from datetime import timezone, timedelta
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

class Order(db.Model):
    __tablename__ = 'order_history'
    id = db.Column(db.Integer, primary_key=True)
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), nullable=False)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), default=1) # Assuming default warehouse_id 1
    location_code = db.Column(db.String(100), nullable=True) # 儲位代碼
    order_date = db.Column(db.DateTime, default=get_taipei_time, nullable=False)
    quantity_ordered = db.Column(db.Integer, nullable=False)
    quantity_received = db.Column(db.Integer, default=0)
    unit_cost = db.Column(db.Numeric(10, 2), default=0)
    status = db.Column(db.String(50), nullable=False, default='pending')
    supplier = db.Column(db.String(255))
    expected_date = db.Column(db.DateTime)
    received_date = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=get_taipei_time)

    # Relationships
    part = relationship("Part", backref="order_history")
    warehouse = relationship("Warehouse", backref="orders")

    def to_dict(self):
        return {
            'id': self.id,
            'part_id': self.part_id,
            'part_number': self.part.part_number if self.part else None,
            'part_name': self.part.name if self.part else None,
            'warehouse_id': self.warehouse_id,
            'warehouse_name': self.warehouse.name if self.warehouse else None,
            'location_code': self.location_code,
            'order_date': self.order_date.isoformat() if self.order_date else None,
            'quantity_ordered': self.quantity_ordered,
            'quantity_received': self.quantity_received,
            'unit_cost': float(self.unit_cost),
            'status': self.status,
            'supplier': self.supplier,
            'expected_date': self.expected_date.isoformat() if self.expected_date else None,
            'received_date': self.received_date.isoformat() if self.received_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    @classmethod
    def create(cls, part_number, quantity_ordered, status='pending', warehouse_id=1, location_code=None,
               quantity_received=0, unit_cost=0, supplier=None, expected_date=None, received_date=None, notes=None):
        
        part = Part.query.filter_by(part_number=part_number).first()
        if not part:
            return False
        
        new_order = cls(
            part_id=part.id,
            warehouse_id=warehouse_id,
            location_code=location_code,
            quantity_ordered=quantity_ordered,
            status=status,
            quantity_received=quantity_received,
            unit_cost=unit_cost,
            supplier=supplier,
            expected_date=expected_date,
            received_date=received_date,
            notes=notes
        )
        db.session.add(new_order)
        db.session.commit()
        return True
    
    @classmethod
    def get_history_by_part_id(cls, part_id):
        return cls.query.filter_by(part_id=part_id).order_by(db.desc(cls.order_date)).all()
    
    @classmethod
    def get_history_by_part_number(cls, part_number):
        return cls.query.join(Part).filter(Part.part_number == part_number).order_by(db.desc(cls.order_date)).all()
    
    @classmethod
    def get_pending_orders(cls):
        from sqlalchemy.orm import joinedload
        return cls.query.options(joinedload(cls.part), joinedload(cls.warehouse)).filter_by(status='pending').order_by(db.desc(cls.order_date)).all()
    
    @classmethod
    def get_all_orders(cls):
        from sqlalchemy.orm import joinedload
        return cls.query.options(joinedload(cls.part), joinedload(cls.warehouse)).order_by(db.desc(cls.order_date)).all()
    
    @classmethod
    def confirm_orders(cls, order_ids):
        orders = cls.query.filter(cls.id.in_(order_ids)).all()
        if orders:
            for order in orders:
                order.status = 'confirmed'
            db.session.commit()
            return True
        return False
    
    @classmethod
    def delete_order(cls, order_id):
        order = cls.query.get(order_id)
        if order:
            db.session.delete(order)
            db.session.commit()
            return True
        return False