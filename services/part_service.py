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
        """Create a new part from submitted form data.

        Returns a dict with keys: success (bool), error (str) or data (form values)
        """
        try:
            part_number = form_data.get('part_number', '').strip()
            name = form_data.get('name', '').strip()
            type_ = form_data.get('type', '').strip()
            description = form_data.get('description', '').strip()
            unit = form_data.get('unit', '').strip() or '個'
            quantity_per_box = int(form_data.get('quantity_per_box') or 1)
            lead_time = int(form_data.get('lead_time') or 5)
            standard_cost = float(form_data.get('standard_cost') or 0)

            # Basic validation
            if not part_number:
                return {'success': False, 'error': '零件編號為必填項目', 'data': form_data}
            if not name:
                return {'success': False, 'error': '零件名稱為必填項目', 'data': form_data}

            # Parse locations submitted as parallel arrays
            locations_data = []
            warehouse_ids = form_data.getlist('location_warehouse_id[]') if hasattr(form_data, 'getlist') else form_data.get('location_warehouse_id[]', [])
            location_codes = form_data.getlist('location_code[]') if hasattr(form_data, 'getlist') else form_data.get('location_code[]', [])

            # Normalize types when getlist returns str
            try:
                len_warehouses = len(warehouse_ids)
            except Exception:
                warehouse_ids = []
                location_codes = []

            for i in range(min(len(warehouse_ids), len(location_codes))):
                wid = warehouse_ids[i]
                code = location_codes[i].strip()
                if not wid or not code:
                    continue
                try:
                    wid_int = int(wid)
                except Exception:
                    continue
                locations_data.append({'warehouse_id': wid_int, 'location_code': code})

            # Use Part.create to perform creation and location conflict checks
            result = Part.create(
                part_number=part_number,
                name=name,
                type=type_,
                description=description,
                unit=unit,
                quantity_per_box=quantity_per_box,
                locations_data=locations_data,
                lead_time=lead_time,
                standard_cost=standard_cost,
                is_active=True
            )

            # Part.create already returns a dict with success or error
            if not isinstance(result, dict):
                return {'success': False, 'error': '建立零件時發生錯誤', 'data': form_data}

            return result

        except Exception as e:
            db.session.rollback()
            print(f"Error in create_part_from_form: {e}")
            return {'success': False, 'error': f'建立零件時發生錯誤: {str(e)}', 'data': form_data}

    @staticmethod
    def update_part_from_form(part_id, form_data):
        """Updates a part from form data."""
        try:
            part = Part.query.get(part_id)
            if not part:
                return {'success': False, 'error': '找不到要更新的零件'}

            # 驗證零件編號是否重複
            new_part_number = form_data.get('part_number', '').strip()
            if part.part_number != new_part_number:
                existing_part = Part.query.filter_by(part_number=new_part_number).first()
                if existing_part:
                    return {'success': False, 'error': f'零件編號 {new_part_number} 已存在'}
            
            # 更新零件屬性
            part.part_number = new_part_number
            part.name = form_data.get('name', '').strip()
            part.type = form_data.get('type', '').strip()
            part.description = form_data.get('description', '').strip()
            part.unit = form_data.get('unit', '').strip()
            part.quantity_per_box = int(form_data.get('quantity_per_box') or 1)
            part.lead_time = int(form_data.get('lead_time') or 0)

            # --- 開始修正儲位邏輯 ---
            
            # 獲取前端提交的倉庫ID和位置代碼列表
            warehouse_ids = form_data.getlist('location_warehouse_id[]')
            location_codes = form_data.getlist('location_code[]')

            new_location_ids = set()
            
            # 遍歷提交的儲位
            for i in range(len(warehouse_ids)):
                warehouse_id_str = warehouse_ids[i]
                location_code = location_codes[i].strip()

                if not warehouse_id_str or not location_code:
                    continue

                try:
                    warehouse_id = int(warehouse_id_str)
                    
                    # 查找或創建 WarehouseLocation
                    warehouse_location = WarehouseLocation.query.filter_by(
                        warehouse_id=warehouse_id,
                        location_code=location_code
                    ).first()

                    # 如果儲位不存在，則創建它
                    if not warehouse_location:
                        warehouse_location = WarehouseLocation(
                            warehouse_id=warehouse_id,
                            location_code=location_code
                        )
                        db.session.add(warehouse_location)
                        db.session.flush() # 立即獲取新儲位的 ID

                    new_location_ids.add(warehouse_location.id)

                except (ValueError, TypeError):
                    continue

            # 更新零件與儲位的關聯
            
            # 1. 找出需要刪除的關聯
            current_location_ids = {assoc.warehouse_location_id for assoc in part.location_associations}
            ids_to_delete = current_location_ids - new_location_ids
            
            if ids_to_delete:
                PartWarehouseLocation.query.filter(
                    PartWarehouseLocation.part_id == part_id,
                    PartWarehouseLocation.warehouse_location_id.in_(ids_to_delete)
                ).delete(synchronize_session=False)

            # 2. 找出需要新增的關聯
            ids_to_add = new_location_ids - current_location_ids
            
            for loc_id in ids_to_add:
                assoc = PartWarehouseLocation(part_id=part_id, warehouse_location_id=loc_id)
                db.session.add(assoc)

            # --- 結束修正儲位邏輯 ---

            db.session.commit()
            return {'success': True}

        except Exception as e:
            db.session.rollback()
            print(f"Error in update_part_from_form: {e}")
            return {'success': False, 'error': f'更新零件時發生錯誤: {str(e)}'}

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