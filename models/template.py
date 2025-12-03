from extensions import db
from datetime import datetime

class StockOutTemplate(db.Model):
    """常用出庫模板"""
    __tablename__ = 'stock_out_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, comment='模板名稱')
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouses.id'), nullable=False, comment='倉庫ID')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, comment='建立者')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, comment='建立時間')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment='更新時間')
    is_active = db.Column(db.Boolean, default=True, comment='是否啟用')
    
    # 關聯
    warehouse = db.relationship('Warehouse', backref='stock_out_templates')
    creator = db.relationship('User', backref='created_templates')
    items = db.relationship('StockOutTemplateItem', backref='template', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'warehouse_id': self.warehouse_id,
            'warehouse_name': self.warehouse.name if self.warehouse else '',
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active,
            'items_count': len(self.items)
        }

class StockOutTemplateItem(db.Model):
    """出庫模板項目明細"""
    __tablename__ = 'stock_out_template_items'
    
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('stock_out_templates.id'), nullable=False, comment='模板ID')
    part_id = db.Column(db.Integer, db.ForeignKey('parts.id'), nullable=False, comment='零件ID')
    warehouse_location_id = db.Column(db.Integer, db.ForeignKey('warehouse_locations.id'), nullable=True, comment='優先儲位')
    default_quantity = db.Column(db.Integer, nullable=False, default=1, comment='預設出庫數量')
    sort_order = db.Column(db.Integer, default=0, comment='排序順序')
    
    # 關聯
    part = db.relationship('Part', backref='template_items')
    location = db.relationship('WarehouseLocation', backref='template_items')
    
    def to_dict(self):
        return {
            'id': self.id,
            'template_id': self.template_id,
            'part_id': self.part_id,
            'part_number': self.part.part_number if self.part else '',
            'part_name': self.part.name if self.part else '',
            'warehouse_location_id': self.warehouse_location_id,
            'location_code': self.location.location_code if self.location else '',
            'default_quantity': self.default_quantity,
            'sort_order': self.sort_order
        }