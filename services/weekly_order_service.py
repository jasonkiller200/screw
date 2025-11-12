from extensions import db
from models.weekly_order import OrderRegistration
from models.part import Part
import pandas as pd
from io import BytesIO
from datetime import datetime

class WeeklyOrderService:
    """
    Service layer for handling weekly order related business logic.
    """

    @staticmethod
    def export_weekly_order_excel(cycle_id):
        from models.weekly_order import WeeklyOrderCycle, OrderRegistration, OrderReviewLog
        from models.part import WarehouseLocation
        from sqlalchemy.orm import joinedload
        from openpyxl import Workbook
        from openpyxl.utils import get_column_letter
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

        try:
            cycle = WeeklyOrderCycle.query.get(cycle_id)
            if not cycle:
                return {'success': False, 'message': '找不到指定的週期'}

            registrations = OrderRegistration.query.options(
                joinedload(OrderRegistration.warehouse_location).joinedload(WarehouseLocation.warehouse)
            ).filter(
                OrderRegistration.cycle_id == cycle_id, 
                OrderRegistration.status == 'approved'
            ).order_by(OrderRegistration.item_sequence).all()
            
            if not registrations:
                return {'success': False, 'message': '沒有已核准的項目可生成申請單'}
            
            # 獲取審查記錄
            review_logs = OrderReviewLog.query.filter_by(
                cycle_id=cycle_id,
                action='approve'
            ).order_by(OrderReviewLog.created_at.desc()).all()
            
            reviewers = set()
            for log in review_logs:
                if log.reviewer_name:
                    reviewers.add(log.reviewer_name)
            reviewers_str = '、'.join(reviewers) if reviewers else '系統'
            
            # Helper function to get current time in UTC+8
            def get_taipei_time():
                from datetime import timezone, timedelta
                tz_taipei = timezone(timedelta(hours=8))
                return datetime.now(tz_taipei)
            
            # 建立 Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = '採購申請單'
            
            # 定義樣式
            title_font = Font(name='微軟正黑體', size=16, bold=True)
            header_font = Font(name='微軟正黑體', size=11, bold=True, color='FFFFFF')
            normal_font = Font(name='微軟正黑體', size=10)
            
            header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
            
            center_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            left_alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
            
            thin_border = Border(
                left=Side(style='thin', color='000000'),
                right=Side(style='thin', color='000000'),
                top=Side(style='thin', color='000000'),
                bottom=Side(style='thin', color='000000')
            )
            
            # 標題區（第1-3行）
            ws.merge_cells('A1:L1')
            ws['A1'] = '週期訂單採購申請單'
            ws['A1'].font = title_font
            ws['A1'].alignment = center_alignment
            ws.row_dimensions[1].height = 30
            
            # 週期資訊（第2行）
            ws.merge_cells('A2:F2')
            ws['A2'] = f'週期名稱：{cycle.cycle_name}'
            ws['A2'].font = Font(name='微軟正黑體', size=11)
            ws['A2'].alignment = left_alignment
            
            ws.merge_cells('G2:L2')
            ws['G2'] = f'申請日期：{get_taipei_time().strftime("%Y-%m-%d")}'
            ws['G2'].font = Font(name='微軟正黑體', size=11)
            ws['G2'].alignment = left_alignment
            
            # 審查資訊（第3行）
            ws.merge_cells('A3:F3')
            ws['A3'] = f'審查人員：{reviewers_str}'
            ws['A3'].font = Font(name='微軟正黑體', size=11)
            ws['A3'].alignment = left_alignment
            
            ws.merge_cells('G3:L3')
            ws['G3'] = f'核准項目數：{len(registrations)} 項'
            ws['G3'].font = Font(name='微軟正黑體', size=11)
            ws['G3'].alignment = left_alignment
            
            # 空白行
            ws.row_dimensions[4].height = 5
            
            # 表頭（第5行）
            headers = ['項次', '品號', '品名', '儲位', '種類', '數量', '單位', 
                      '申請人', '申請單位', '緊急程度', '需用日期', '台份用/備註']
            
            for col_idx, header in enumerate(headers, start=1):
                cell = ws.cell(row=5, column=col_idx)
                cell.value = header
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = center_alignment
                cell.border = thin_border
            
            ws.row_dimensions[5].height = 25
            
            # 資料列（從第6行開始）
            for idx, reg in enumerate(registrations, start=1):
                row_num = 5 + idx
                
                location_str = ''
                if reg.warehouse_location and reg.warehouse_location.warehouse:
                    location_str = f"{reg.warehouse_location.warehouse.name} - {reg.warehouse_location.location_code}"
                elif reg.warehouse_location:
                    location_str = reg.warehouse_location.location_code
                
                priority_str = '緊急' if reg.priority == 'urgent' else '一般'
                
                row_data = [
                    idx,
                    reg.part_number,
                    reg.part_name,
                    location_str,
                    reg.category or '',
                    reg.quantity,
                    reg.unit,
                    reg.applicant_name,
                    reg.department or '',
                    priority_str,
                    reg.required_date.strftime('%Y-%m-%d') if reg.required_date else '',
                    reg.purpose_notes or ''
                ]
                
                for col_idx, value in enumerate(row_data, start=1):
                    cell = ws.cell(row=row_num, column=col_idx)
                    cell.value = value
                    cell.font = normal_font
                    cell.border = thin_border
                    
                    # 對齊方式
                    if col_idx in [1, 6]:  # 項次、數量
                        cell.alignment = center_alignment
                    else:
                        cell.alignment = left_alignment
                
                ws.row_dimensions[row_num].height = 20
            
            # 設定欄寬
            column_widths = {
                'A': 8,   # 項次
                'B': 15,  # 品號
                'C': 25,  # 品名
                'D': 20,  # 儲位
                'E': 12,  # 種類
                'F': 10,  # 數量
                'G': 8,   # 單位
                'H': 12,  # 申請人
                'I': 15,  # 申請單位
                'J': 12,  # 緊急程度
                'K': 12,  # 需用日期
                'L': 30   # 台份用/備註
            }
            
            for col, width in column_widths.items():
                ws.column_dimensions[col].width = width
            
            # 儲存到 BytesIO
            output = BytesIO()
            wb.save(output)
            output.seek(0)

            filename = f"採購申請單_{cycle.cycle_name}_{get_taipei_time().strftime('%Y%m%d')}.xlsx"
            
            review_log = OrderReviewLog(
                cycle_id=cycle.id,
                reviewer_name='系統',
                action='export_excel',
                notes=f'匯出Excel申請單，包含{len(registrations)}個項目'
            )
            db.session.add(review_log)
            db.session.commit()
            
            return {'success': True, 'file_content': output.getvalue(), 'filename': filename}
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f"匯出失敗: {str(e)}"}

    @staticmethod
    def review_order_registration(registration_id, action, notes, reviewer_id, reviewer_name):
        from models.weekly_order import OrderRegistration, OrderReviewLog
        try:
            registration = OrderRegistration.query.get(registration_id)
            if not registration:
                return {'success': False, 'message': '找不到指定的登記項目'}
            
            old_status = registration.status
            
            if action == 'approved':
                registration.status = 'approved'
            elif action == 'rejected':
                registration.status = 'rejected'
            else:
                return {'success': False, 'message': '無效的操作'}
            
            registration.admin_notes = notes
            
            review_log = OrderReviewLog(
                cycle_id=registration.cycle_id,
                registration_id=registration.id,
                reviewer_id=reviewer_id,
                reviewer_name=reviewer_name,
                action=action,
                old_status=old_status,
                new_status=registration.status,
                notes=notes
            )
            db.session.add(review_log)
            
            db.session.commit()
            
            return {
                'success': True,
                'message': f"項目已{'通過' if action == 'approved' else '拒絕'}",
                'new_status': registration.status
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': str(e)}

    @staticmethod
    def batch_review_registrations(registration_ids, action, reviewer_id, reviewer_name):
        from models.weekly_order import OrderRegistration, OrderReviewLog
        try:
            updated_count = 0
            for reg_id in registration_ids:
                registration = OrderRegistration.query.get(reg_id)
                if registration and registration.status == 'registered':
                    old_status = registration.status
                    registration.status = action

                    review_log = OrderReviewLog(
                        cycle_id=registration.cycle_id,
                        registration_id=registration.id,
                        reviewer_id=reviewer_id,
                        reviewer_name=reviewer_name,
                        action=action,
                        old_status=old_status,
                        new_status=registration.status,
                        notes=f'批量{action}'
                    )
                    db.session.add(review_log)
                    updated_count += 1

            db.session.commit()

            return {
                'success': True,
                'message': f'已批量處理 {updated_count} 個項目'
            }

        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': str(e)}

    @staticmethod
    def register_new_order(cycle_id, form_data, user_id, user_name, user_department):
        from models.weekly_order import WeeklyOrderCycle, OrderRegistration
        try:
            current_cycle = WeeklyOrderCycle.query.get(cycle_id)
            if not current_cycle:
                return {'success': False, 'message': '目前沒有活躍的申請週期'}

            if not current_cycle.is_active:
                return {'success': False, 'message': '申請週期已截止，無法新增登記'}

            max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
            next_sequence = (max_sequence or 0) + 1
            
            warehouse_location_id = form_data.get('warehouse_location_id', type=int)

            registration = OrderRegistration(
                cycle_id=current_cycle.id,
                item_sequence=next_sequence,
                part_number=form_data.get('part_number', '').strip(),
                part_name=form_data.get('part_name', '').strip(),
                warehouse_location_id=warehouse_location_id,
                quantity=int(form_data.get('quantity', 0)),
                unit=form_data.get('unit', '').strip(),
                category=form_data.get('part_type', '').strip(),
                required_date=datetime.strptime(form_data.get('required_date'), '%Y-%m-%d') if form_data.get('required_date') else None,
                priority=form_data.get('priority', 'normal').strip(),
                purpose_notes=form_data.get('purpose_notes', '').strip(),
                applicant_id=user_id,
                applicant_name=user_name,
                department=user_department or '未設定'
            )
            
            db.session.add(registration)
            db.session.commit()
            
            return {'success': True, 'message': f'項目 #{next_sequence} 登記成功'}
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'登記失敗：{str(e)}'}

    @staticmethod
    def batch_register_orders(cycle_id, parts_data, source):
        from models.weekly_order import WeeklyOrderCycle, OrderRegistration
        try:
            current_cycle = WeeklyOrderCycle.query.get(cycle_id)
            if not current_cycle:
                return {'success': False, 'message': '目前沒有活躍的申請週期'}
            
            if not current_cycle.is_active:
                return {'success': False, 'message': '申請週期已截止，無法新增登記'}
            
            if not parts_data:
                return {'success': False, 'message': '沒有提供要登記的零件資料'}
            
            added_count = 0
            
            for part_data in parts_data:
                max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
                next_sequence = (max_sequence or 0) + 1
                
                warehouse_location_id = part_data.get('warehouse_location_id', type=int)

                registration = OrderRegistration()
                registration.cycle_id = current_cycle.id
                registration.item_sequence = next_sequence
                registration.part_number = part_data.get('part_number', '').strip()
                registration.part_name = part_data.get('part_name', '').strip()
                registration.warehouse_location_id = warehouse_location_id
                registration.quantity = int(part_data.get('quantity', 1))
                registration.unit = part_data.get('unit', '個').strip()
                registration.category = part_data.get('category', '').strip()
                registration.priority = part_data.get('priority', 'normal').strip()
                registration.purpose_notes = f'自動匯入自{source}'
                registration.applicant_name = '系統自動'
                registration.department = '自動申請'
                
                db.session.add(registration)
                added_count += 1
            
            db.session.commit()
            
            return {
                'success': True,
                'message': f'成功登記 {added_count} 個項目',
                'added_count': added_count
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'批量登記失敗：{str(e)}'}

    @staticmethod
    def batch_inbound_weekly_orders(items):
        from models.weekly_order import OrderRegistration
        from services.inventory_service import InventoryService

        if not items or not isinstance(items, list):
            return {'success': False, 'error': '請求格式錯誤，需要一個項目列表'}

        success_count = 0
        error_count = 0
        errors = []

        for item in items:
            registration_id = item.get('registration_id')
            quantity = item.get('quantity')

            if not all([registration_id, quantity]):
                error_count += 1
                errors.append({'item': item, 'error': '缺少 registration_id 或 quantity'})
                continue
            
            try:
                inbound_quantity = int(quantity)
                if inbound_quantity <= 0:
                    error_count += 1
                    errors.append({'item': item, 'error': '入庫數量必須為正整數'})
                    continue
            except (ValueError, TypeError):
                error_count += 1
                errors.append({'item': item, 'error': '數量格式錯誤'})
                continue

            result = InventoryService.receive_stock(
                registration_id=registration_id, 
                inbound_quantity=inbound_quantity, 
                notes='批量入庫'
            )

            if result.get('success'):
                success_count += 1
            else:
                error_count += 1
                reg = OrderRegistration.query.get(registration_id)
                error_item_info = f"品號 {reg.part_number}" if reg else f"ID {registration_id}"
                errors.append({'item': error_item_info, 'error': result.get('error', '未知錯誤')})

        response = {
            'success': error_count == 0,
            'message': f'批量入庫完成。成功: {success_count} 項, 失敗: {error_count} 項。',
            'success_count': success_count,
            'error_count': error_count,
            'errors': errors
        }
        return response