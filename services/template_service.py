from extensions import db
from models.template import StockOutTemplate, StockOutTemplateItem
from models.part import Part, WarehouseLocation
from sqlalchemy.exc import IntegrityError
from sqlalchemy import and_

class TemplateService:
    """出庫模板服務"""
    
    @staticmethod
    def get_templates_by_warehouse(warehouse_id):
        """根據倉庫ID獲取所有可用模板"""
        templates = StockOutTemplate.query.filter(
            and_(
                StockOutTemplate.warehouse_id == warehouse_id,
                StockOutTemplate.is_active == True
            )
        ).order_by(StockOutTemplate.name).all()
        
        return [template.to_dict() for template in templates]
    
    @staticmethod
    def get_template_with_items(template_id):
        """獲取模板及其項目詳情"""
        template = StockOutTemplate.query.get_or_404(template_id)
        
        # 使用 joinedload 來確保相關數據被正確載入
        from sqlalchemy.orm import joinedload
        items = StockOutTemplateItem.query.options(
            joinedload(StockOutTemplateItem.part),
            joinedload(StockOutTemplateItem.location)
        ).filter_by(
            template_id=template_id
        ).order_by(StockOutTemplateItem.sort_order).all()
        
        template_data = template.to_dict()
        template_data['items'] = [item.to_dict() for item in items]
        
        return template_data
    
    @staticmethod
    def create_template(name, warehouse_id, created_by, items_data):
        """建立新模板"""
        try:
            # 檢查模板名稱是否在該倉庫中已存在
            existing = StockOutTemplate.query.filter_by(
                name=name, 
                warehouse_id=warehouse_id,
                is_active=True
            ).first()
            
            if existing:
                return {"success": False, "message": "該倉庫中已存在相同名稱的模板"}
            
            # 建立模板
            template = StockOutTemplate(
                name=name,
                warehouse_id=warehouse_id,
                created_by=created_by
            )
            db.session.add(template)
            db.session.flush()  # 獲取模板ID
            
            # 建立模板項目
            for i, item_data in enumerate(items_data):
                item = StockOutTemplateItem(
                    template_id=template.id,
                    part_id=item_data['part_id'],
                    warehouse_location_id=item_data.get('warehouse_location_id'),
                    default_quantity=item_data['default_quantity'],
                    sort_order=i
                )
                db.session.add(item)
            
            db.session.commit()
            return {"success": True, "template_id": template.id}
            
        except IntegrityError as e:
            db.session.rollback()
            return {"success": False, "message": "資料庫約束錯誤"}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": f"建立模板失敗: {str(e)}"}
    
    @staticmethod
    def update_template(template_id, name, items_data):
        """更新模板"""
        try:
            template = StockOutTemplate.query.get_or_404(template_id)
            
            # 檢查名稱是否與其他模板衝突
            existing = StockOutTemplate.query.filter(
                and_(
                    StockOutTemplate.name == name,
                    StockOutTemplate.warehouse_id == template.warehouse_id,
                    StockOutTemplate.id != template_id,
                    StockOutTemplate.is_active == True
                )
            ).first()
            
            if existing:
                return {"success": False, "message": "該倉庫中已存在相同名稱的模板"}
            
            # 更新模板基本信息
            template.name = name
            
            # 刪除舊的項目
            StockOutTemplateItem.query.filter_by(template_id=template_id).delete()
            
            # 建立新的項目
            for i, item_data in enumerate(items_data):
                item = StockOutTemplateItem(
                    template_id=template_id,
                    part_id=item_data['part_id'],
                    warehouse_location_id=item_data.get('warehouse_location_id'),
                    default_quantity=item_data['default_quantity'],
                    sort_order=i
                )
                db.session.add(item)
            
            db.session.commit()
            return {"success": True}
            
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": f"更新模板失敗: {str(e)}"}
    
    @staticmethod
    def delete_template(template_id):
        """刪除模板（軟刪除）"""
        try:
            template = StockOutTemplate.query.get_or_404(template_id)
            template.is_active = False
            db.session.commit()
            return {"success": True}
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": f"刪除模板失敗: {str(e)}"}
    
    @staticmethod
    def validate_template_items(items_data):
        """驗證模板項目數據"""
        if not items_data:
            return {"valid": False, "message": "模板必須至少包含一個零件"}
        
        part_ids = [item['part_id'] for item in items_data]
        existing_parts = Part.query.filter(Part.id.in_(part_ids)).all()
        existing_part_ids = {part.id for part in existing_parts}
        
        invalid_parts = [pid for pid in part_ids if pid not in existing_part_ids]
        if invalid_parts:
            return {"valid": False, "message": f"無效的零件ID: {invalid_parts}"}
        
        # 檢查數量是否有效
        for item in items_data:
            if item['default_quantity'] <= 0:
                return {"valid": False, "message": "出庫數量必須大於0"}
        
        return {"valid": True}