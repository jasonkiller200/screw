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
        """從 Excel 資料創建或更新工單需求記錄"""
        existing = cls.query.filter_by(
            order_id=data['order_id'],
            part_number=data['part_number']
        ).first()
        
        if existing:
            # 更新現有記錄
            existing.required_quantity = data['required_quantity']
            existing.material_description = data.get('material_description', '')
            existing.operation_description = data.get('operation_description', '')
            existing.parent_material_description = data.get('parent_material_description', '')
            existing.required_date = data['required_date']
            existing.bulk_material = data.get('bulk_material', '')
            return existing
        else:
            # 創建新記錄
            new_demand = cls()
            new_demand.order_id = data['order_id']
            new_demand.part_number = data['part_number']
            new_demand.required_quantity = data['required_quantity']
            new_demand.material_description = data.get('material_description', '')
            new_demand.operation_description = data.get('operation_description', '')
            new_demand.parent_material_description = data.get('parent_material_description', '')
            new_demand.required_date = data['required_date']
            new_demand.bulk_material = data.get('bulk_material', '')
            return new_demand
    
    @classmethod
    def get_by_order(cls, order_id):
        """依訂單編號查詢工單需求"""
        return cls.query.filter_by(order_id=order_id).all()
    
    @classmethod
    def get_all_orders(cls):
        """獲取所有不重複的訂單編號"""
        return db.session.query(cls.order_id).distinct().all()
    
    @classmethod
    def search_by_part(cls, part_number):
        """依物料編號查詢工單需求"""
        return cls.query.filter(cls.part_number.like(f'%{part_number}%')).all()
    
    @classmethod
    def get_pending_requirements(cls):
        """獲取待處理的工單需求（這裡暫時返回所有，未來可加入已領料數量判斷）"""
        from datetime import datetime
        return cls.query.filter(cls.required_date >= datetime.now()).all()
    
    def __repr__(self):
        return f'<WorkOrderDemand {self.order_id}-{self.part_number}>'
