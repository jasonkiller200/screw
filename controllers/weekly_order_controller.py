from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, send_file, make_response
from flask_login import login_required, current_user
from extensions import db
from models.weekly_order import WeeklyOrderCycle, OrderRegistration, OrderReviewLog, User
from models.part import WarehouseLocation # Import for relationship loading
from services.inventory_service import InventoryService # New import
from services.weekly_order_service import WeeklyOrderService # New import
from datetime import datetime, timedelta
from sqlalchemy.orm import joinedload
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
@login_required
def weekly_orders():
    """週期訂單管理主頁"""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    # 如果沒有活躍的週期，自動創建一個
    if not current_cycle:
        current_cycle = WeeklyOrderCycle.create_weekly_cycle()
        flash('已自動創建新的週期申請', 'info')
    
    # 獲取分頁參數
    per_page = request.args.get('per_page', 10, type=int)
    status_filter = request.args.get('status', '')
    
    # 構建查詢
    query = WeeklyOrderCycle.query
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    # 獲取歷史週期（支援分頁）
    historical_cycles = query.order_by(WeeklyOrderCycle.created_at.desc()).limit(per_page).all()
    
    # 傳遞當前台灣時間給模板（移除時區資訊以避免比較問題）
    now = get_taipei_time().replace(tzinfo=None)
    
    return render_template('weekly_orders/index.html', 
                         current_cycle=current_cycle,
                         historical_cycles=historical_cycles,
                         now=now,
                         per_page=per_page)

@weekly_order_bp.route('/weekly-orders/pending-inbound')
@login_required
def pending_inbound_orders():
    """顯示所有已核准待入庫的訂單項目（包含部分入庫的項目）"""
    pending_items = OrderRegistration.query.options(
        joinedload(OrderRegistration.warehouse_location).joinedload(WarehouseLocation.warehouse),
        joinedload(OrderRegistration.cycle)
    ).filter(
        OrderRegistration.status.in_(['approved', 'partially_received']),  # 包含部分入庫的項目
        OrderRegistration.warehouse_location_id.isnot(None) # Exclude items without a specified location
    ).order_by(
        OrderRegistration.required_date.asc(),
        OrderRegistration.created_at.asc()
    ).all()

    return render_template('weekly_orders/pending_inbound.html', items=pending_items)

@weekly_order_bp.route('/weekly-orders/register', methods=['GET', 'POST'])
@login_required
def register_order():
    """登記申請項目"""
    from models.part import WarehouseLocation # New import

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
            'category': request.args.get('category', ''),
            'source': request.args.get('source', '')  # 來源：shortage, lookup, manual
        }
        # Also prefill warehouse_location_id if available in URL args
        prefill_data['warehouse_location_id'] = request.args.get('warehouse_location_id', type=int) # New

    if request.method == 'POST':
        result = WeeklyOrderService.register_new_order(
            current_cycle.id, 
            request.form,
            user_id=current_user.id,
            user_name=current_user.full_name,
            user_department=current_user.department
        )
        if result['success']:
            flash(result['message'], 'success')
            return redirect(url_for('weekly_order.weekly_orders'))
        else:
            flash(result['message'], 'error')
    
    all_warehouse_locations = []
    # Fetch all warehouse locations with their warehouse names
    locations = db.session.query(WarehouseLocation).join(WarehouseLocation.warehouse).all()
    for loc in locations:
        all_warehouse_locations.append({
            'id': loc.id,
            'location_code': loc.location_code,
            'warehouse_name': loc.warehouse.name # Access warehouse name via relationship
        })

    return render_template('weekly_orders/register.html',
                         current_cycle=current_cycle,
                         prefill_data=prefill_data,
                         all_warehouse_locations=all_warehouse_locations)
@weekly_order_bp.route('/weekly_orders/batch_register', methods=['POST'])
@login_required
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
    
    result = WeeklyOrderService.batch_register_orders(current_cycle.id, parts, source)
    
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500

@weekly_order_bp.route('/weekly-orders/batch-register', methods=['GET', 'POST'])
@login_required
def batch_register_form():
    """批量申請表單頁面"""
    from models.part import WarehouseLocation # New import

    current_cycle = WeeklyOrderCycle.get_current_cycle()

    if not current_cycle:
        flash('目前沒有活躍的申請週期', 'error')
        return redirect(url_for('weekly_order.weekly_orders'))

    if not current_cycle.is_active:
        flash('申請週期已截止，無法新增登記', 'error')
        return redirect(url_for('weekly_order.weekly_orders'))

    all_warehouse_locations = []
    # Fetch all warehouse locations with their warehouse names
    locations = db.session.query(WarehouseLocation).join(WarehouseLocation.warehouse).all()
    for loc in locations:
        all_warehouse_locations.append({
            'id': loc.id,
            'location_code': loc.location_code,
            'warehouse_name': loc.warehouse.name # Access warehouse name via relationship
        })

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
                             prefill_items=prefill_items,
                             all_warehouse_locations=all_warehouse_locations) # New

    # POST 處理表單提交
    if request.method == 'POST':
        try:
            # 直接使用 current_user，移除表單驗證
            applicant_name = current_user.full_name
            applicant_id = current_user.id
            department = current_user.department or '未設定'
            
            added_count = 0
            
            # 處理批量項目
            item_index = 0
            while f'items[{item_index}][part_number]' in request.form:
                part_number = request.form.get(f'items[{item_index}][part_number]', '').strip()
                part_name = request.form.get(f'items[{item_index}][part_name]', '').strip()
                quantity_str = request.form.get(f'items[{item_index}][quantity]', '0')
                warehouse_location_id = request.form.get(f'items[{item_index}][warehouse_location_id]', type=int) # New

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
                registration.warehouse_location_id = warehouse_location_id # New
                registration.quantity = quantity
                registration.unit = request.form.get(f'items[{item_index}][unit]', '個').strip()
                registration.category = request.form.get(f'items[{item_index}][part_type]', '').strip()
                registration.priority = request.form.get(f'items[{item_index}][priority]', 'normal').strip()
                registration.purpose_notes = request.form.get(f'items[{item_index}][purpose_notes]', '').strip()
                registration.applicant_id = applicant_id
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

@weekly_order_bp.route('/weekly-orders/batch_register.js')
@login_required
def batch_register_js():
    """Renders the javascript for the batch register page."""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    
    # This logic is duplicated from batch_register_form's GET part
    prefill_items = []
    items_param = request.args.get('items')
    if items_param:
        try:
            import json
            prefill_items = json.loads(items_param)
        except (json.JSONDecodeError, TypeError):
            prefill_items = []

    response = make_response(render_template(
        'weekly_orders/batch_register.js.j2',
        current_cycle=current_cycle,
        prefill_items=prefill_items
    ))
    response.headers['Content-Type'] = 'application/javascript'
    return response

@weekly_order_bp.route('/weekly-orders/cycle/<int:cycle_id>', methods=['GET', 'DELETE'])
@login_required
def manage_cycle(cycle_id):
    """查看或刪除特定週期"""
    cycle = WeeklyOrderCycle.query.get_or_404(cycle_id)
    
    if request.method == 'DELETE':
        if not current_user.is_admin:
            flash('您沒有權限執行此操作', 'danger')
            return redirect(url_for('weekly_order.weekly_orders'))
        try:
            db.session.delete(cycle)
            db.session.commit()
            return jsonify({'success': True, 'message': '週期已成功刪除'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'error': str(e)})
    
    # GET request (accessible to all logged-in users)
    registrations = OrderRegistration.query.options(
        joinedload(OrderRegistration.warehouse_location).joinedload(WarehouseLocation.warehouse)
    ).filter_by(cycle_id=cycle_id).order_by(OrderRegistration.item_sequence).all()
    
    # 獲取分頁參數
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    # 審查記錄分頁查詢
    review_logs_pagination = OrderReviewLog.query.filter_by(
        cycle_id=cycle_id
    ).order_by(OrderReviewLog.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    # 狀態中英文對應
    status_map = {
        'registered': '已登記',
        'approved': '已核准',
        'rejected': '已拒絕',
        'completed': '已完成',
        'partially_received': '部分入庫'
    }
    
    action_map = {
        'approved': '核准',
        'rejected': '拒絕',
        'modified': '修改',
        'export_excel': '匯出Excel'
    }
    
    return render_template('weekly_orders/cycle_detail.html', 
                         cycle=cycle, 
                         registrations=registrations,
                         review_logs_pagination=review_logs_pagination,
                         status_map=status_map,
                         action_map=action_map)

@weekly_order_bp.route('/weekly-orders/review/<int:cycle_id>')
@login_required
def review_cycle(cycle_id):
    """主管審查頁面"""
    if not current_user.is_admin:
        flash('您沒有權限執行此操作', 'danger')
        return redirect(url_for('weekly_order.weekly_orders'))
    cycle = WeeklyOrderCycle.query.get_or_404(cycle_id)
    
    # 檢查是否有審查權限（暫時開放給所有人，之後會加入權限控制）
    from sqlalchemy.orm import joinedload

    registrations = OrderRegistration.query.options(joinedload(OrderRegistration.warehouse_location).joinedload(WarehouseLocation.warehouse)).filter_by(cycle_id=cycle_id).order_by(OrderRegistration.item_sequence).all()
    
    return render_template('weekly_orders/review.html', 
                         cycle=cycle, 
                         registrations=registrations)

# 審查相關 API 路由
@weekly_order_bp.route('/weekly_orders/review/<int:registration_id>', methods=['POST'])
@login_required
def review_registration(registration_id):
    """審查單個登記項目"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': '您沒有權限執行此操作'}), 403
    data = request.get_json()
    action = data.get('action')  # approved, rejected
    notes = data.get('notes', '')

    result = WeeklyOrderService.review_order_registration(
        registration_id, 
        action, 
        notes, 
        reviewer_id=current_user.id,
        reviewer_name=current_user.full_name
    )
    
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500

@weekly_order_bp.route('/weekly_orders/batch_review', methods=['POST'])
@login_required
def batch_review():
    """批量審查登記項目"""
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': '您沒有權限執行此操作'}), 403
    data = request.get_json()
    registration_ids = data.get('registration_ids', [])
    action = data.get('action', 'approved')
    
    result = WeeklyOrderService.batch_review_registrations(
        registration_ids, 
        action, 
        reviewer_id=current_user.id,
        reviewer_name=current_user.full_name
    )
    
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500

@weekly_order_bp.route('/weekly_orders/registration/<int:registration_id>')
@login_required
def get_registration_detail(registration_id):
    """獲取登記項目詳細信息"""
    registration = OrderRegistration.query.get_or_404(registration_id)
    return jsonify(registration.to_dict())

@weekly_order_bp.route('/api/weekly_orders/inbound_item', methods=['POST'])
@login_required
def inbound_item():
    """處理單個訂單項目的入庫操作"""
    data = request.get_json()
    registration_id = data.get('registration_id')
    quantity = data.get('quantity')
    notes = data.get('notes', '')

    if not all([registration_id, quantity]):
        return jsonify({'success': False, 'error': '缺少必要參數 (registration_id, quantity)'}), 400

    try:
        inbound_quantity = int(quantity)
        if inbound_quantity <= 0:
            return jsonify({'success': False, 'error': '入庫數量必須為正整數'}), 400
    except (ValueError, TypeError):
        return jsonify({'success': False, 'error': '數量必須是有效的整數'}), 400

    result = InventoryService.receive_stock(
        registration_id=registration_id, 
        inbound_quantity=inbound_quantity, 
        notes=notes,
        user_id=current_user.id
    )

    if result.get('success'):
        return jsonify(result)
    else:
        return jsonify(result), 500

@weekly_order_bp.route('/api/weekly_orders/batch_inbound', methods=['POST'])
@login_required
def batch_inbound_items():
    """處理批量訂單項目的入庫操作"""
    data = request.get_json()
    items = data.get('items')

    result = WeeklyOrderService.batch_inbound_weekly_orders(items)

    status_code = 200 if result['error_count'] == 0 else 400
    return jsonify(result), status_code

@weekly_order_bp.route('/weekly_orders/export_excel/<int:cycle_id>')
@login_required
def export_excel(cycle_id):
    """生成Excel申請單"""
    result = WeeklyOrderService.export_weekly_order_excel(cycle_id)

    if result['success']:
        return send_file(
            BytesIO(result['file_content']),
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=result['filename']
        )
    else:
        flash(result['message'], 'danger')
        return redirect(url_for('weekly_order.review_cycle', cycle_id=cycle_id))

@weekly_order_bp.route('/weekly_orders/export_pdf/<int:cycle_id>')
@login_required
def export_pdf(cycle_id):
    """生成PDF申請單"""
    result = WeeklyOrderService.export_weekly_order_pdf(cycle_id)

    if result['success']:
        return send_file(
            BytesIO(result['file_content']),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=result['filename']
        )
    else:
        flash(result['message'], 'danger')
        return redirect(url_for('weekly_order.review_cycle', cycle_id=cycle_id))

@weekly_order_bp.route('/weekly-orders/api/cycle-summary')
@login_required
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
@login_required
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
        return jsonify({'success': False, 'error': str(e)})

@weekly_order_bp.route('/weekly-orders/history')
@login_required
def order_history():
    """統一的訂單歷史頁面 - 包含週期記錄和舊系統記錄"""
    # 獲取已完成的週期歷史（新系統）
    historical_cycles = WeeklyOrderCycle.query\
        .filter(WeeklyOrderCycle.is_active == False)\
        .order_by(WeeklyOrderCycle.created_at.desc())\
        .limit(50).all()
    
    # 獲取舊系統歷史
    try:
        from models.order import Order
        legacy_orders = Order.query.filter(
            Order.status.in_(['migrated', 'confirmed'])
        ).order_by(Order.order_date.desc()).all()
        migrated_count = len([o for o in legacy_orders if o.status == 'migrated'])
        confirmed_count = len([o for o in legacy_orders if o.status == 'confirmed'])
    except Exception as e:
        # 如果 Order 模型不存在或查詢失敗，使用空列表
        legacy_orders = []
        migrated_count = 0
        confirmed_count = 0
    
    return render_template('weekly_orders/history.html',
                         historical_cycles=historical_cycles,
                         legacy_orders=legacy_orders,
                         cycle_count=len(historical_cycles),
                         legacy_count=len(legacy_orders),
                         migrated_count=migrated_count,
                         confirmed_count=confirmed_count)

@weekly_order_bp.route('/api/weekly-orders/register', methods=['POST'])
@login_required
def api_register_order():
    """API endpoint to register a new order, typically from a modal."""
    current_cycle = WeeklyOrderCycle.get_current_cycle()
    if not current_cycle or not current_cycle.is_active:
        return jsonify({'success': False, 'message': '目前沒有活躍的申請週期或週期已截止'}), 400

    data = request.get_json()
    required_fields = ['part_number', 'part_name', 'quantity', 'unit', 'applicant_name', 'priority', 'required_date']
    if not all(data.get(field) for field in required_fields):
        return jsonify({'success': False, 'message': '缺少必要欄位'}), 400

    try:
        quantity = int(data['quantity'])
        if quantity <= 0:
            raise ValueError("數量必須為正數")

        # Handle optional warehouse_location_id
        warehouse_location_id_str = data.get('warehouse_location_id')
        warehouse_location_id = int(warehouse_location_id_str) if warehouse_location_id_str else None

        required_date = datetime.strptime(data['required_date'], '%Y-%m-%d')

    except (ValueError, TypeError) as e:
        return jsonify({'success': False, 'message': f'欄位格式錯誤，請檢查數量、儲位或日期: {str(e)}'}), 400

    try:
        max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
        next_sequence = (max_sequence or 0) + 1

        registration = OrderRegistration(
            cycle_id=current_cycle.id,
            item_sequence=next_sequence,
            part_number=data['part_number'].strip(),
            part_name=data['part_name'].strip(),
            warehouse_location_id=warehouse_location_id,
            quantity=quantity,
            unit=data['unit'].strip(),
            category=data.get('category', '').strip(),
            required_date=required_date,
            priority=data['priority'].strip(),
            purpose_notes=data.get('purpose_notes', '').strip(),
            applicant_name=data['applicant_name'].strip(),
            department=data.get('department', '').strip()
        )
        
        db.session.add(registration)
        db.session.commit()
        
        return jsonify({'success': True, 'message': f'項目 #{next_sequence} 登記成功'}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f'登記失敗：{str(e)}'}), 500
