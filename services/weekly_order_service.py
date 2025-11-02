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
            
            data = []
            for reg in registrations:
                location_str = ''
                if reg.warehouse_location and reg.warehouse_location.warehouse:
                    location_str = f"{reg.warehouse_location.warehouse.name} - {reg.warehouse_location.location_code}"
                elif reg.warehouse_location:
                    location_str = reg.warehouse_location.location_code

                priority_str = '緊急' if reg.priority == 'urgent' else '一般'

                data.append({
                    '項次': reg.item_sequence,
                    '品號': reg.part_number,
                    '品名': reg.part_name,
                    '儲位': location_str,
                    '種類': reg.category or '',
                    '數量': reg.quantity,
                    '單位': reg.unit,
                    '申請人': reg.applicant_name,
                    '申請單位': reg.department or '',
                    '緊急程度': priority_str,
                    '需用日期': reg.required_date.strftime('%Y-%m-%d') if reg.required_date else '',
                    '台份用/備註': reg.purpose_notes or ''
                })
            
            df = pd.DataFrame(data)
            
            output = BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='申請單', index=False)
                
                worksheet = writer.sheets['申請單']
                for idx, col in enumerate(df.columns, 1):
                    max_len = 0
                    max_len = max(max_len, len(str(col)))
                    if not df[col].empty:
                        max_len = max(max_len, df[col].astype(str).map(len).max())
                    
                    adjusted_width = (max_len + 4) * 1.2 
                    worksheet.column_dimensions[chr(64 + idx)].width = adjusted_width

            output.seek(0)
            
            # Helper function to get current time in UTC+8
            def get_taipei_time():
                from datetime import timezone, timedelta
                tz_taipei = timezone(timedelta(hours=8))
                return datetime.now(tz_taipei)

            filename = f"採購申請單_{cycle.cycle_name}_{get_taipei_time().strftime('%Y%m%d')}.xlsx"
            
            review_log = OrderReviewLog(
                cycle_id=cycle.id,
                reviewer_name='系統', # Or current user
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
    def review_order_registration(registration_id, action, notes, reviewer_name):
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
    def batch_review_registrations(registration_ids, action, reviewer_name):
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
    def register_new_order(cycle_id, form_data):
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
                applicant_name=form_data.get('applicant_name', '').strip(),
                department=form_data.get('department', '').strip()
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