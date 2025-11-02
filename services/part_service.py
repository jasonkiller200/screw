import pandas as pd
from io import BytesIO
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation
from extensions import db
from models.order import Order
from models.inventory import CurrentInventory
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import or_, func

class PartService:

    @staticmethod
    def create_part_from_form(form_data):
        # ... (existing method) ...
        pass

    @staticmethod
    def update_part_from_form(part_id, form_data):
        # ... (existing method) ...
        pass

    @staticmethod
    def add_warehouse_location(form_data):
        warehouse_id_str = form_data.get('warehouse_id', '')
        location_code = form_data.get('location_code', '')
        description = form_data.get('description', '')
        
        if not warehouse_id_str or not location_code:
            return {'success': False, 'message': '倉庫和位置代碼為必填項目'}
        
        try:
            warehouse_id_int = int(warehouse_id_str)
            
            existing = WarehouseLocation.query.filter_by(
                warehouse_id=warehouse_id_int,
                location_code=location_code
            ).first()
            
            if existing:
                return {'success': False, 'message': '該倉位已存在'}
            
            new_location = WarehouseLocation(
                warehouse_id_int,
                location_code,
                description=description
            )
            db.session.add(new_location)
            db.session.commit()
            
            return {'success': True, 'message': '倉位新增成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'倉位新增失敗: {str(e)}'}

    @staticmethod
    def edit_warehouse_location(location_id, form_data):
        location_code = form_data.get('location_code')
        description = form_data.get('description', '')
        
        if not location_code:
            return {'success': False, 'message': '位置代碼為必填項目'}
        
        try:
            location = WarehouseLocation.query.get(location_id)
            if not location:
                return {'success': False, 'message': '找不到該倉位'}
            
            existing = WarehouseLocation.query.filter(
                WarehouseLocation.warehouse_id == location.warehouse_id,
                WarehouseLocation.location_code == location_code,
                WarehouseLocation.id != location_id
            ).first()
            
            if existing:
                return {'success': False, 'message': '該倉位代碼已存在於此倉庫'}
            
            location.location_code = location_code
            location.description = description
            db.session.commit()
            
            return {'success': True, 'message': '倉位更新成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'倉位更新失敗: {str(e)}'}

    @staticmethod
    def delete_warehouse_location(location_id):
        try:
            location = WarehouseLocation.query.get(location_id)
            if not location:
                return {'success': False, 'message': '找不到該倉位'}
            
            parts_using_assoc = PartWarehouseLocation.query.filter_by(
                warehouse_location_id=location_id
            ).all()
            
            if parts_using_assoc:
                part_list = []
                for assoc in parts_using_assoc:
                    part = Part.query.get(assoc.part_id)
                    if part:
                        part_list.append(f"{part.part_number} - {part.name}")
                
                if len(part_list) <= 5:
                    parts_info = '、'.join(part_list)
                else:
                    parts_info = '、'.join(part_list[:5]) + f' 等 {len(part_list)} 個零件'
                
                return {'success': False, 'message': f'無法刪除：此倉位被以下零件使用中：{parts_info}'}
            
            db.session.delete(location)
            db.session.commit()
            
            return {'success': True, 'message': '倉位刪除成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'倉位刪除失敗: {str(e)}'}

    @staticmethod
    def get_full_part_details(part_number):
        import logging
        logging.basicConfig(level=logging.INFO)
        logging.info(f"Fetching details for part_number: {part_number}")

        try:
            part = Part.get_by_part_number(part_number)
            if part is None:
                logging.warning(f"Part with part_number {part_number} not found.")
                return {'success': False, 'error': '找不到零件'}
            logging.info(f"Found part: {part.id}")

            order_history = Order.get_history_by_part_number(part_number)
            logging.info(f"Found {len(order_history)} order history records.")

            inventories = CurrentInventory.query.filter_by(part_id=part.id).all()
            logging.info(f"Found {len(inventories)} inventory records.")

            # Serialize data with individual error handling
            try:
                part_info = part.to_dict(include_locations=True)
            except Exception as e:
                logging.error(f"Error serializing part_info for part {part.id}: {e}", exc_info=True)
                raise

            try:
                order_history_data = [order.to_dict() for order in order_history]
            except Exception as e:
                logging.error(f"Error serializing order_history for part {part.id}: {e}", exc_info=True)
                raise

            try:
                inventory_data = [inv.to_dict() for inv in inventories]
            except Exception as e:
                logging.error(f"Error serializing inventory_data for part {part.id}: {e}", exc_info=True)
                raise

            result = {
                'part_info': part_info,
                'order_history': order_history_data,
                'inventories': inventory_data
            }
            
            logging.info(f"Successfully fetched all details for part {part.id}")
            return {'success': True, 'data': result}

        except Exception as e:
            logging.error(f"Unhandled exception in get_full_part_details for part_number {part_number}: {e}", exc_info=True)
            # Re-raise the exception to let Flask handle it and produce a 500 error
            raise

    @staticmethod
    def export_parts_excel(search='', sort_by='part_number', sort_order='asc'):
        """匯出零件清單為 Excel 檔案"""
        query = Part.query
        if sort_by == 'storage_location':
            query = query.outerjoin(PartWarehouseLocation).outerjoin(WarehouseLocation).outerjoin(Warehouse)

        if search:
            query = query.filter(or_(
                Part.name.ilike(f'%{search}%'),
                Part.part_number.ilike(f'%{search}%')
            ))
        
        valid_columns = ['part_number', 'name', 'type', 'description', 'unit', 'quantity_per_box', 'lead_time', 'storage_location']
        if sort_by not in valid_columns:
            sort_by = 'part_number'
        
        if sort_by == 'storage_location':
            if sort_order.lower() == 'desc':
                query = query.order_by(db.desc(func.coalesce(Warehouse.name, '')), db.desc(func.coalesce(WarehouseLocation.location_code, '')))
            else:
                query = query.order_by(func.coalesce(Warehouse.name, ''), func.coalesce(WarehouseLocation.location_code, ''))
        else:
            if sort_order.lower() == 'desc':
                query = query.order_by(db.desc(getattr(Part, sort_by)))
            else:
                query = query.order_by(getattr(Part, sort_by))

        parts = query.all()

        wb = Workbook()
        ws = wb.active
        ws.title = "零件清單"

        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

        headers = ['零件編號', '名稱', '類型', '備註', '單位', '每盒數量', '採購前置期 (天)', '儲存位置']
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num)
            cell.value = header
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = border

        for row_num, part in enumerate(parts, 2):
            locations = ", ".join([f"{assoc.warehouse_location.warehouse.name}-{assoc.warehouse_location.location_code}" for assoc in part.location_associations]) if part.location_associations else "無"
            
            ws.cell(row=row_num, column=1, value=part.part_number).border = border
            ws.cell(row=row_num, column=2, value=part.name).border = border
            ws.cell(row=row_num, column=3, value=part.type).border = border
            ws.cell(row=row_num, column=4, value=part.description).border = border
            ws.cell(row=row_num, column=5, value=part.unit).border = border
            ws.cell(row=row_num, column=6, value=part.quantity_per_box).border = border
            ws.cell(row=row_num, column=7, value=part.lead_time).border = border
            ws.cell(row=row_num, column=8, value=locations).border = border

        for col_num, column_cells in enumerate(ws.columns, 1):
            max_length = 0
            column_letter = get_column_letter(col_num)
            max_length = len(str(ws.cell(row=1, column=col_num).value))
            for cell in column_cells:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2)
            ws.column_dimensions[column_letter].width = adjusted_width

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        from datetime import datetime
        filename = f"零件清單_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx"

        return output.getvalue(), filename

    @staticmethod
    def get_part_autocomplete_suggestions(query):
        """Provides autocomplete suggestions for part numbers and names."""
        if not query or len(query) < 1:
            return []

        parts = Part.query.filter(
            or_(
                Part.part_number.ilike(f'%{query}%'),
                Part.name.ilike(f'%{query}%')
            )
        ).limit(10).all()

        results = [{'part_number': part.part_number, 'name': part.name} for part in parts]
        return results

    @staticmethod
    def add_warehouse(form_data):
        code = form_data.get('code', '')
        name = form_data.get('name', '')
        description = form_data.get('description', '')
        
        if not code or not name:
            return {'success': False, 'message': '倉庫編號和名稱為必填項目'}
        
        try:
            existing = Warehouse.query.filter_by(code=code).first()
            if existing:
                return {'success': False, 'message': '倉庫編號已存在'}
            
            new_warehouse = Warehouse(
                code,
                name,
                description=description,
                is_active=True
            )
            db.session.add(new_warehouse)
            db.session.commit()
            
            return {'success': True, 'message': '倉庫新增成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'倉庫新增失敗: {str(e)}'}

    @staticmethod
    def edit_warehouse(warehouse_id, form_data):
        name = form_data.get('name')
        description = form_data.get('description', '')
        
        if not name:
            return {'success': False, 'message': '倉庫名稱為必填項目'}
        
        try:
            warehouse = Warehouse.query.get(warehouse_id)
            if not warehouse:
                return {'success': False, 'message': '找不到該倉庫'}
            
            warehouse.name = name
            warehouse.description = description
            db.session.commit()
            
            return {'success': True, 'message': '倉庫更新成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'倉庫更新失敗: {str(e)}'}

    @staticmethod
    def delete_warehouse(warehouse_id):
        try:
            warehouse = Warehouse.query.get(warehouse_id)
            if not warehouse:
                return {'success': False, 'message': '找不到該倉庫'}
            
            locations_count = WarehouseLocation.query.filter_by(
                warehouse_id=warehouse_id
            ).count()
            
            if locations_count > 0:
                return {'success': False, 'message': f'無法刪除：此倉庫有 {locations_count} 個倉位，請先刪除所有倉位'}
            
            db.session.delete(warehouse)
            db.session.commit()
            
            return {'success': True, 'message': '倉庫刪除成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'倉庫刪除失敗: {str(e)}'}

    @staticmethod
    def import_parts_from_excel(file_stream):
        # ... (existing method) ...
        pass