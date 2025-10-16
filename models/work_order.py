from extensions import db
from datetime import datetime, timedelta

def get_taipei_time():
    from datetime import timezone
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

class WorkOrderDemand(db.Model):
    __tablename__ = 'work_order_demand'
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.String(100), nullable=False) # 訂單
    part_number = db.Column(db.String(100), nullable=False) # 物料
    required_quantity = db.Column(db.Float, nullable=False) # 需求數量 (EINHEIT)
    material_description = db.Column(db.String(255)) # 物料說明
    operation_description = db.Column(db.String(255)) # 作業說明
    parent_material_description = db.Column(db.String(255)) # 上層物料說明
    required_date = db.Column(db.DateTime, nullable=False) # 需求日期
    bulk_material = db.Column(db.String(10)) # 散裝物料
    created_at = db.Column(db.DateTime, default=get_taipei_time)

    __table_args__ = (db.UniqueConstraint('order_id', 'part_number', name='_order_part_uc'),)

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'part_number': self.part_number,
            'required_quantity': self.required_quantity,
            'material_description': self.material_description,
            'operation_description': self.operation_description,
            'parent_material_description': self.parent_material_description,
            'required_date': self.required_date.isoformat() if self.required_date else None,
            'bulk_material': self.bulk_material,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @classmethod
    def create_from_excel(cls, data):
        # This method will be used by the import function
        # It will handle creating or updating demand records
        pass
