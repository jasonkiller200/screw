from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, send_file
from extensions import db
from models.weekly_order import WeeklyOrderCycle, OrderRegistration, OrderReviewLog, User
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO
import os

weekly_order_bp = Blueprint('weekly_order', __name__)

# Helper function to get current time in UTC+8
def get_taipei_time():
    from datetime import timezone, timedelta
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

@weekly_order_bp.route('/weekly-orders')
def weekly_orders():
    """週期訂單管理主頁"""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    # 如果沒有活躍的週期，自動創建一個
    if not current_cycle:
        current_cycle = WeeklyOrderCycle.create_weekly_cycle()
        flash('已自動創建新的週期申請', 'info')
    
    # 獲取歷史週期（最近10個）
    historical_cycles = WeeklyOrderCycle.query.order_by(WeeklyOrderCycle.created_at.desc()).limit(10).all()
    
    return render_template('weekly_orders/index.html', 
                         current_cycle=current_cycle,
                         historical_cycles=historical_cycles)

@weekly_order_bp.route('/weekly-orders/register', methods=['GET', 'POST'])
def register_order():
    """登記申請項目"""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    if not current_cycle:
        flash('目前沒有活躍的申請週期', 'error')
        return redirect(url_for('weekly_order.weekly_orders'))
    
    if not current_cycle.is_active:
        flash('申請週期已截止，無法新增登記', 'error')
        return redirect(url_for('weekly_order.weekly_orders'))
    
    # 檢查是否從其他頁面帶入預填資料
    prefill_data = {}
    if request.method == 'GET':
        # 從 URL 參數獲取預填資料
        prefill_data = {
            'part_number': request.args.get('part_number', ''),
            'part_name': request.args.get('part_name', ''),
            'quantity': request.args.get('quantity', ''),
            'unit': request.args.get('unit', ''),
            'category': request.args.get('category', ''),
            'source': request.args.get('source', '')  # 來源：shortage, lookup, manual
        }
    
    if request.method == 'POST':
        try:
            # 獲取下一個項次
            max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
            next_sequence = (max_sequence or 0) + 1
            
            # 創建新的登記記錄
            registration = OrderRegistration(
                cycle_id=current_cycle.id,
                item_sequence=next_sequence,
                part_number=request.form.get('part_number', '').strip(),
                part_name=request.form.get('part_name', '').strip(),
                quantity=int(request.form.get('quantity', 0)),
                unit=request.form.get('unit', '').strip(),
                category=request.form.get('category', '').strip(),
                required_date=datetime.strptime(request.form.get('required_date'), '%Y-%m-%d') if request.form.get('required_date') else None,
                priority=request.form.get('priority', 'normal').strip(),
                purpose_notes=request.form.get('purpose_notes', '').strip(),
                applicant_name=request.form.get('applicant_name', '').strip(),
                department=request.form.get('department', '').strip()
            )
            
            db.session.add(registration)
            db.session.commit()
            
            flash(f'項目 #{next_sequence} 登記成功', 'success')
            return redirect(url_for('weekly_order.weekly_orders'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'登記失敗：{str(e)}', 'error')
    
    return render_template('weekly_orders/register.html', 
                         current_cycle=current_cycle,
                         prefill_data=prefill_data)

@weekly_order_bp.route('/weekly_orders/batch_register', methods=['POST'])
def batch_register():
    """批量登記申請項目（從其他系統匯入）"""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    if not current_cycle:
        return jsonify({'success': False, 'message': '目前沒有活躍的申請週期'})
    
    if not current_cycle.is_active:
        return jsonify({'success': False, 'message': '申請週期已截止，無法新增登記'})
    
    data = request.get_json()
    parts = data.get('parts', [])
    source = data.get('source', 'unknown')
    
    if not parts:
        return jsonify({'success': False, 'message': '沒有提供要登記的零件資料'})
    
    try:
        added_count = 0
        
        for part_data in parts:
            # 獲取下一個項次
            max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
            next_sequence = (max_sequence or 0) + 1
            
            # 創建新的登記記錄
            registration = OrderRegistration()
            registration.cycle_id = current_cycle.id
            registration.item_sequence = next_sequence
            registration.part_number = part_data.get('part_number', '').strip()
            registration.part_name = part_data.get('part_name', '').strip()
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
        
        return jsonify({
            'success': True,
            'message': f'成功登記 {added_count} 個項目',
            'added_count': added_count
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'批量登記失敗：{str(e)}'})

@weekly_order_bp.route('/weekly-orders/batch-register', methods=['GET', 'POST'])
def batch_register_form():
    """批量申請表單頁面"""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    if not current_cycle:
        flash('目前沒有活躍的申請週期', 'error')
        return redirect(url_for('weekly_order.weekly_orders'))
    
    if not current_cycle.is_active:
        flash('申請週期已截止，無法新增登記', 'error')
        return redirect(url_for('weekly_order.weekly_orders'))
    
    if request.method == 'GET':
        # 檢查是否有預填資料（從庫存不足報告等來源）
        prefill_items = []
        items_param = request.args.get('items')
        if items_param:
            try:
                import json
                prefill_items = json.loads(items_param)
            except (json.JSONDecodeError, TypeError):
                flash('預填資料格式錯誤', 'warning')
                prefill_items = []
        
        return render_template('weekly_orders/batch_register.html', 
                             current_cycle=current_cycle,
                             prefill_items=prefill_items)
    
    # POST 處理表單提交
    if request.method == 'POST':
        try:
            applicant_name = request.form.get('applicant_name', '').strip()
            department = request.form.get('department', '').strip()
            
            if not applicant_name or not department:
                flash('請填寫申請人和申請單位', 'error')
                return redirect(request.url)
            
            added_count = 0
            
            # 處理批量項目
            item_index = 0
            while f'items[{item_index}][part_number]' in request.form:
                part_number = request.form.get(f'items[{item_index}][part_number]', '').strip()
                part_name = request.form.get(f'items[{item_index}][part_name]', '').strip()
                quantity_str = request.form.get(f'items[{item_index}][quantity]', '0')
                
                if not part_number or not part_name:
                    item_index += 1
                    continue
                
                try:
                    quantity = int(quantity_str)
                    if quantity <= 0:
                        item_index += 1
                        continue
                except ValueError:
                    item_index += 1
                    continue
                
                # 獲取下一個項次
                max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
                next_sequence = (max_sequence or 0) + 1
                
                # 創建新的登記記錄
                registration = OrderRegistration()
                registration.cycle_id = current_cycle.id
                registration.item_sequence = next_sequence
                registration.part_number = part_number
                registration.part_name = part_name
                registration.quantity = quantity
                registration.unit = request.form.get(f'items[{item_index}][unit]', '個').strip()
                registration.category = request.form.get(f'items[{item_index}][category]', '').strip()
                registration.priority = request.form.get(f'items[{item_index}][priority]', 'normal').strip()
                registration.purpose_notes = request.form.get(f'items[{item_index}][purpose_notes]', '').strip()
                registration.applicant_name = applicant_name
                registration.department = department
                
                # 處理需用日期
                required_date_str = request.form.get(f'items[{item_index}][required_date]', '')
                if required_date_str:
                    try:
                        registration.required_date = datetime.strptime(required_date_str, '%Y-%m-%d')
                    except ValueError:
                        pass
                
                db.session.add(registration)
                added_count += 1
                item_index += 1
            
            if added_count == 0:
                flash('沒有有效的申請項目', 'error')
                return redirect(request.url)
            
            db.session.commit()
            flash(f'成功提交 {added_count} 個申請項目', 'success')
            return redirect(url_for('weekly_order.weekly_orders'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'批量申請提交失敗：{str(e)}', 'error')
            return redirect(request.url)

@weekly_order_bp.route('/weekly-orders/cycle/<int:cycle_id>', methods=['GET', 'DELETE'])
def manage_cycle(cycle_id):
    """查看或刪除特定週期"""
    cycle = WeeklyOrderCycle.query.get_or_404(cycle_id)
    
    if request.method == 'DELETE':
        try:
            db.session.delete(cycle)
            db.session.commit()
            return jsonify({'success': True, 'message': '週期已成功刪除'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)})
    
    # GET request
    registrations = OrderRegistration.query.filter_by(cycle_id=cycle_id).order_by(OrderRegistration.item_sequence).all()
    review_logs = OrderReviewLog.query.filter_by(cycle_id=cycle_id).order_by(OrderReviewLog.created_at.desc()).all()
    
    return render_template('weekly_orders/cycle_detail.html', 
                         cycle=cycle, 
                         registrations=registrations,
                         review_logs=review_logs)

@weekly_order_bp.route('/weekly-orders/review/<int:cycle_id>')
def review_cycle(cycle_id):
    """主管審查頁面"""
    cycle = WeeklyOrderCycle.query.get_or_404(cycle_id)
    
    # 檢查是否有審查權限（暫時開放給所有人，之後會加入權限控制）
    if cycle.status not in ['active', 'reviewing']:
        flash('此週期無法進行審查', 'error')
        return redirect(url_for('weekly_order.view_cycle', cycle_id=cycle_id))
    
    registrations = OrderRegistration.query.filter_by(cycle_id=cycle_id).order_by(OrderRegistration.item_sequence).all()
    
    return render_template('weekly_orders/review.html', 
                         cycle=cycle, 
                         registrations=registrations)

# 審查相關 API 路由
@weekly_order_bp.route('/weekly_orders/review/<int:registration_id>', methods=['POST'])
def review_registration(registration_id):
    """審查單個登記項目"""
    data = request.get_json()
    action = data.get('action')  # approved, rejected
    notes = data.get('notes', '')
    reviewer_name = '主管'  # 暫時固定，之後改為登入用戶
    
    try:
        registration = OrderRegistration.query.get_or_404(registration_id)
        old_status = registration.status
        
        if action == 'approved':
            registration.status = 'approved'
        elif action == 'rejected':
            registration.status = 'rejected'
        else:
            return jsonify({'success': False, 'message': '無效的操作'})
        
        registration.admin_notes = notes
        
        # 記錄審查log
        review_log = OrderReviewLog()
        review_log.cycle_id = registration.cycle_id
        review_log.registration_id = registration.id
        review_log.reviewer_name = reviewer_name
        review_log.action = action
        review_log.old_status = old_status
        review_log.new_status = registration.status
        review_log.notes = notes
        
        db.session.add(review_log)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'項目已{"通過" if action == "approved" else "拒絕"}',
            'new_status': registration.status
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})

@weekly_order_bp.route('/weekly_orders/batch_review', methods=['POST'])
def batch_review():
    """批量審查登記項目"""
    data = request.get_json()
    registration_ids = data.get('registration_ids', [])
    action = data.get('action', 'approved')
    reviewer_name = '主管'
    
    try:
        updated_count = 0
        for reg_id in registration_ids:
            registration = OrderRegistration.query.get(reg_id)
            if registration and registration.status == 'registered':
                old_status = registration.status
                registration.status = action
                
                # 記錄審查log
                review_log = OrderReviewLog()
                review_log.cycle_id = registration.cycle_id
                review_log.registration_id = registration.id
                review_log.reviewer_name = reviewer_name
                review_log.action = action
                review_log.old_status = old_status
                review_log.new_status = registration.status
                review_log.notes = f'批量{action}'
                
                db.session.add(review_log)
                updated_count += 1
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'已批量處理 {updated_count} 個項目'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})

@weekly_order_bp.route('/weekly_orders/registration/<int:registration_id>')
def get_registration_detail(registration_id):
    """獲取登記項目詳細信息"""
    registration = OrderRegistration.query.get_or_404(registration_id)
    return jsonify(registration.to_dict())

@weekly_order_bp.route('/weekly_orders/export_excel/<int:cycle_id>')
def export_excel(cycle_id):
    """生成Excel申請單"""
    try:
        cycle = WeeklyOrderCycle.query.get_or_404(cycle_id)
        registrations = OrderRegistration.query.filter_by(
            cycle_id=cycle_id, 
            status='approved'
        ).order_by(OrderRegistration.item_sequence).all()
        
        if not registrations:
            return jsonify({'success': False, 'error': '沒有已核准的項目可生成申請單'})
        
        # 準備Excel數據
        data = []
        for reg in registrations:
            data.append({
                '項次': reg.item_sequence,
                '品號': reg.part_number,
                '品名': reg.part_name,
                '數量': reg.quantity,
                '單位': reg.unit,
                '種類': reg.category or '',
                '需用日期': reg.required_date.strftime('%Y/%m/%d') if reg.required_date else '',
                '台份用/備註': reg.purpose_notes or '',
                '申請人': reg.applicant_name,
                '申請單位': reg.department or ''
            })
        
        # 創建DataFrame
        df = pd.DataFrame(data)
        
        # 生成Excel檔案
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='申請單', index=False)
            
            # 設定欄位寬度
            worksheet = writer.sheets['申請單']
            for idx, col in enumerate(df.columns):
                max_length = max(
                    df[col].astype(str).map(len).max(),
                    len(col)
                ) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_length, 50)
        
        output.seek(0)
        
        # 儲存檔案路徑（可選）
        filename = f"申請單_{cycle.cycle_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        # Do not change cycle status here, only log the export action
        cycle.excel_generated = True
        
        # 記錄審查log
        review_log = OrderReviewLog()
        review_log.cycle_id = cycle.id
        review_log.reviewer_name = '主管'
        review_log.action = 'generate_excel'
        review_log.old_status = 'reviewing'
        review_log.new_status = 'completed'
        review_log.notes = f'生成Excel申請單，包含{len(registrations)}個項目'
        
        db.session.add(review_log)
        db.session.commit()
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})

@weekly_order_bp.route('/weekly-orders/api/cycle-summary')
def cycle_summary():
    """獲取週期摘要信息"""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    if not current_cycle:
        return jsonify({
            'has_active_cycle': False,
            'message': '目前沒有活躍的申請週期'
        })
    
    registrations = OrderRegistration.query.filter_by(cycle_id=current_cycle.id).all()
    
    summary = {
        'has_active_cycle': True,
        'cycle': current_cycle.to_dict(),
        'stats': {
            'total': len(registrations),
            'registered': len([r for r in registrations if r.status == 'registered']),
            'approved': len([r for r in registrations if r.status == 'approved']),
            'rejected': len([r for r in registrations if r.status == 'rejected'])
        },
        'time_remaining': None
    }
    
    # 計算剩餘時間
    if current_cycle.is_active:
        now = get_taipei_time()
        deadline_aware = current_cycle.deadline
        if deadline_aware.tzinfo is None:
            # 如果 deadline 沒有時區信息，假設它是台北時間
            from datetime import timezone, timedelta
            tz_taipei = timezone(timedelta(hours=8))
            deadline_aware = deadline_aware.replace(tzinfo=tz_taipei)
        
        remaining = deadline_aware - now
        if remaining.total_seconds() > 0:
            summary['time_remaining'] = {
                'days': remaining.days,
                'hours': remaining.seconds // 3600,
                'minutes': (remaining.seconds % 3600) // 60
            }
    
    return jsonify(summary)

@weekly_order_bp.route('/weekly-orders/api/create-cycle', methods=['POST'])
def create_new_cycle():
    """手動創建新週期（管理員功能）"""
    try:
        # 檢查是否有活躍週期
        current_cycle = WeeklyOrderCycle.get_current_cycle()
        if current_cycle:
            return jsonify({
                'success': False, 
                'error': '已有活躍的申請週期，請先完成或關閉現有週期'
            })
        
        new_cycle = WeeklyOrderCycle.create_weekly_cycle()
        
        return jsonify({
            'success': True,
            'message': f'新週期「{new_cycle.cycle_name}」創建成功',
            'cycle': new_cycle.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)})
