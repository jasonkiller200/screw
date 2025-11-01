"""
Service layer for handling report generation business logic.
"""
from collections import defaultdict
from extensions import db
from models.work_order import WorkOrderDemand
from models.inventory import CurrentInventory
from models.part import Part
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, Border, Side, Alignment, PatternFill
from openpyxl.utils import get_column_letter


class ReportService:

    @staticmethod
    def get_parts_comparison_data():
        """
        Generates the parts comparison report data.
        This logic was moved from web_controller._get_parts_comparison_report_data
        """
        try:
            # 1. 取得所有工單需求
            all_demands = WorkOrderDemand.query.all()
            work_order_dict = defaultdict(lambda: {
                'description': '',
                'total_required': 0,
                'order_ids': set(),
                'names': set()
            })

            for demand in all_demands:
                part_number = demand.part_number
                work_order_dict[part_number]['description'] = demand.material_description
                work_order_dict[part_number]['total_required'] += demand.required_quantity
                work_order_dict[part_number]['order_ids'].add(demand.order_id)
                part_from_db = Part.query.filter_by(part_number=part_number).first()
                if part_from_db:
                    work_order_dict[part_number]['names'].add(part_from_db.name)
                else:
                    work_order_dict[part_number]['names'].add(demand.material_description)

            # 2. 取得零件倉零件的詳細資訊
            inventory_parts = db.session.query(Part).options(db.joinedload(Part.location_associations)).all()
            inventory_dict = {part.part_number: part for part in inventory_parts}

            # 3. 取得零件庫存資訊
            stock_details = db.session.query(
                Part.part_number,
                db.func.sum(CurrentInventory.quantity_on_hand).label('total_stock'),
                db.func.sum(CurrentInventory.available_quantity).label('available_stock')
            ).join(CurrentInventory, Part.id == CurrentInventory.part_id).group_by(Part.part_number).all()
            stock_dict = {row[0]: {'total_stock': float(row[1] or 0), 'available_stock': float(row[2] or 0)} for row in stock_details}

            # 4. 分析差異
            missing_in_inventory = []
            for part_number, details in work_order_dict.items():
                if part_number not in inventory_dict:
                    missing_in_inventory.append({
                        'part_number': part_number,
                        'description': details['description'],
                        'name': list(details['names'])[0] if details['names'] else details['description'],
                        'total_required': details['total_required'],
                        'order_ids': list(details['order_ids'])
                    })

            demand_with_no_location = []
            for part_number, details in work_order_dict.items():
                if part_number in inventory_dict:
                    part_obj = inventory_dict[part_number]
                    if not part_obj.location_associations:
                        demand_with_no_location.append({
                            'part_id': part_obj.id,
                            'part_number': part_number,
                            'name': part_obj.name,
                            'total_required': details['total_required'],
                            'order_ids': list(details['order_ids'])
                        })

            inventory_with_demand = []
            for part_number, part in inventory_dict.items():
                work_order_info = work_order_dict.get(part_number, {})
                stock_info = stock_dict.get(part_number, {'total_stock': 0, 'available_stock': 0})
                required_qty = work_order_info.get('total_required', 0)
                available_qty = stock_info.get('available_stock', 0)
                shortage = max(0, required_qty - available_qty)
                inventory_with_demand.append({
                    'part_number': part_number,
                    'name': part.name,
                    'description': part.description or '',
                    'unit': part.unit or '',
                    'category': part.type or '',
                    'warehouse_location_id': part.location_associations[0].warehouse_location_id if part.location_associations else None,
                    'required_quantity': required_qty,
                    'total_stock': stock_info.get('total_stock', 0),
                    'available_quantity': available_qty,
                    'shortage': shortage,
                    'order_ids': list(work_order_info.get('order_ids', [])),
                    'has_demand': required_qty > 0,
                    'stock_status': '充足' if shortage == 0 and required_qty > 0 else ('缺料' if shortage > 0 else '無需求')
                })

            # 5. 計算統計資訊
            summary = {
                'work_order_parts_count': len(work_order_dict),
                'inventory_parts_count': len(inventory_dict),
                'missing_in_inventory_count': len(missing_in_inventory),
                'demand_with_no_location_count': len(demand_with_no_location),
                'shortage_parts_count': len([item for item in inventory_with_demand if item['shortage'] > 0]),
                'sufficient_parts_count': len([item for item in inventory_with_demand if item['stock_status'] == '充足'])
            }

            return {
                'success': True,
                'summary': summary,
                'missing_in_inventory': sorted(missing_in_inventory, key=lambda x: x['total_required'], reverse=True),
                'inventory_with_demand': sorted(inventory_with_demand, key=lambda x: x['shortage'], reverse=True),
                'demand_with_no_location': sorted(demand_with_no_location, key=lambda x: x['total_required'], reverse=True)
            }

        except Exception as e:
            db.session.rollback()
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def export_parts_comparison_excel():
        """
        Generates and exports the parts comparison report as an Excel file.
        This logic was moved from web_controller.export_parts_comparison.
        """
        report_data = ReportService.get_parts_comparison_data()

        if not report_data['success']:
            # Propagate the error to be handled by the controller
            raise Exception(report_data['error'])

        wb = Workbook()

        # Define styles
        header_font = Font(name='Arial', size=11, bold=True, color='FFFFFF')
        header_fill_missing = PatternFill(start_color='FFC000', end_color='FFC000', fill_type='solid')
        header_fill_shortage = PatternFill(start_color='FF0000', end_color='FF0000', fill_type='solid')
        header_fill_sufficient = PatternFill(start_color='00B050', end_color='00B050', fill_type='solid')
        header_fill_no_location = PatternFill(start_color='00B0F0', end_color='00B0F0', fill_type='solid')

        thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))
        
        def add_sheet_data(ws, title, headers, data, header_fill):
            ws.title = title
            ws.append(headers)
            for col_idx, cell in enumerate(ws[1]):
                cell.font = header_font
                cell.fill = header_fill
                cell.border = thin_border
                cell.alignment = Alignment(horizontal='center', vertical='center')
                ws.column_dimensions[get_column_letter(col_idx + 1)].width = 15

            for row_data in data:
                ws.append(list(row_data.values()))
                for cell in ws[ws.max_row]:
                    cell.border = thin_border
                    cell.alignment = Alignment(horizontal='left', vertical='center')
            
            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter
                for cell in col:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = (max_length + 2)
                ws.column_dimensions[column].width = adjusted_width

        # Sheet 1: Missing in Inventory
        missing_data_raw = report_data['missing_in_inventory']
        if missing_data_raw:
            missing_data_transformed = []
            for item in missing_data_raw:
                missing_data_transformed.append({
                    'part_number': item['part_number'],
                    'name': item['name'],
                    'total_required': item['total_required'],
                    'order_ids': ', '.join(item['order_ids'])
                })
            ws1 = wb.active
            add_sheet_data(ws1, '未建立零件', ['零件編號', '零件名稱', '需求數量', '工單號碼'], missing_data_transformed, header_fill_missing)
        else:
            ws1 = wb.active
            ws1.title = '未建立零件'
            ws1.append(['無數據'])

        # Sheet 2: Shortage Parts
        shortage_data = [item for item in report_data['inventory_with_demand'] if item['shortage'] > 0]
        if shortage_data:
            ws2 = wb.create_sheet('庫存不足')
            add_sheet_data(ws2, '庫存不足', ['零件編號', '零件名稱', '需求數量', '庫存數量', '缺貨數量', '單位', '工單號碼'],
                           [{ 'part_number': item['part_number'], 'name': item['name'], 'required_quantity': item['required_quantity'],
                             'total_stock': item['total_stock'], 'shortage': item['shortage'], 'unit': item['unit'],
                             'order_ids': ', '.join(item['order_ids'])} for item in shortage_data],
                           header_fill_shortage)
        else:
            ws2 = wb.create_sheet('庫存不足')
            ws2.append(['無數據'])

        # Sheet 3: Sufficient Parts
        sufficient_data = [item for item in report_data['inventory_with_demand'] if item['stock_status'] == '充足']
        if sufficient_data:
            ws3 = wb.create_sheet('庫存充足')
            add_sheet_data(ws3, '庫存充足', ['零件編號', '零件名稱', '需求數量', '庫存數量', '可用數量', '單位', '工單號碼'],
                           [{ 'part_number': item['part_number'], 'name': item['name'], 'required_quantity': item['required_quantity'],
                             'total_stock': item['total_stock'], 'available_quantity': item['available_quantity'], 'unit': item['unit'],
                             'order_ids': ', '.join(item['order_ids'])} for item in sufficient_data],
                           header_fill_sufficient)
        else:
            ws3 = wb.create_sheet('庫存充足')
            ws3.append(['無數據'])

        # Sheet 4: Demand with No Location
        no_location_data = report_data['demand_with_no_location']
        if no_location_data:
            ws4 = wb.create_sheet('待建立儲位')
            add_sheet_data(ws4, '待建立儲位', ['零件編號', '零件名稱', '總需求數量', '工單號碼'],
                           [{ 'part_number': item['part_number'], 'name': item['name'], 'total_required': item['total_required'],
                             'order_ids': ', '.join(item['order_ids'])} for item in no_location_data],
                           header_fill_no_location)
        else:
            ws4 = wb.create_sheet('待建立儲位')
            ws4.append(['無數據'])

        output = BytesIO()
        wb.save(output)
        output.seek(0)

        from datetime import datetime
        filename = f'零件差異分析報告_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        return output.getvalue(), filename
