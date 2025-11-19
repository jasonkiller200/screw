from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_file
from flask_login import login_required, current_user
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation # Import PartWarehouseLocation for dummy object
from models.order import Order
from models.inventory import CurrentInventory, InventoryTransaction, StockCount
from extensions import db
from controllers.user_controller import admin_required
from datetime import datetime, timedelta
import os
import pandas as pd
from werkzeug.utils import secure_filename
from io import BytesIO
from services.part_service import PartService # Import the new service
from openpyxl import Workbook

web_bp = Blueprint('web', __name__)

# Helper class for re-rendering part form with unsaved locations
class DummyPartWarehouseLocation:
    def __init__(self, warehouse_location):
        self.warehouse_location = warehouse_location

@web_bp.route('/')
@login_required
def index():
    """Main dashboard page."""
    return render_template('index.html')

@web_bp.route('/parts')
@login_required
def parts():
    """Parts management page with pagination."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search_term = request.args.get('search', '')
    sort_by = request.args.get('sort_by', 'part_number')
    sort_order = request.args.get('sort_order', 'asc')
    
    pagination = Part.get_all(
        search_term=search_term, 
        sort_by=sort_by, 
        sort_order=sort_order,
        page=page,
        per_page=per_page
    )
    
    return render_template('parts.html', 
                           pagination=pagination,
                           search_term=search_term,
                           sort_by=sort_by,
                           sort_order=sort_order,
                           per_page=per_page)

@web_bp.route('/orders')
@login_required
def orders():
    """重定向到週期訂單頁面"""
    flash('所有訂單管理已統一到週期訂單系統中', 'info')
    return redirect(url_for('weekly_order.weekly_orders'))

@web_bp.route('/order-history')
@login_required
def order_history():
    """歷史訂單記錄頁面 - 重定向到新的統一歷史頁面"""
    flash('歷史記錄已整合到訂單管理模組', 'info')
    return redirect(url_for('weekly_order.order_history'))

@web_bp.route('/work-orders')
@login_required
def work_orders():
    """工單需求管理頁面"""
    from models.work_order import WorkOrderDemand
    
    # 獲取查詢參數
    order_id = request.args.get('order_id', '')
    part_number = request.args.get('part_number', '')
    
    # 建立查詢
    query = WorkOrderDemand.query
    
    if order_id:
        query = query.filter(WorkOrderDemand.order_id.like(f'%{order_id}%'))
    
    if part_number:
        query = query.filter(WorkOrderDemand.part_number.like(f'%{part_number}%'))
    
    # 獲取所有工單需求並按訂單編號排序
    demands = query.order_by(WorkOrderDemand.order_id, WorkOrderDemand.part_number).all()
    
    # 獲取所有不重複的訂單編號
    all_orders = [row[0] for row in WorkOrderDemand.get_all_orders()]
    
    return render_template('work_orders.html', 
                         demands=demands, 
                         all_orders=all_orders,
                         search_order_id=order_id,
                         search_part_number=part_number)

from services.work_order_service import WorkOrderService

@web_bp.route('/work-orders/import', methods=['POST'])
@login_required
def import_work_order_demands():
    """匯入工單需求資料"""
    if 'excel_file' not in request.files:
        return jsonify({'success': False, 'error': '沒有檔案被上傳'})

    file = request.files['excel_file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '沒有選擇檔案'})

    if not (file and file.filename is not None and file.filename.lower().endswith(('.xlsx', '.xls'))):
        return jsonify({'success': False, 'error': '請上傳 Excel 檔案 (.xlsx 或 .xls 格式)'})

    # 將檔案流傳遞給 Service 層處理
    result = WorkOrderService.import_from_excel(file.stream)
    
    # 直接返回 Service 層的處理結果
    return jsonify(result)

@web_bp.route('/part_lookup')
@login_required
def part_lookup():
    """Part lookup page for barcode scanning."""
    # Fetch all warehouse locations for the modal dropdown
    all_locations = db.session.query(WarehouseLocation).join(WarehouseLocation.warehouse).order_by(Warehouse.name, WarehouseLocation.location_code).all()
    
    locations_for_modal = []
    for loc in all_locations:
        locations_for_modal.append({
            'id': loc.id,
            'text': f"{loc.warehouse.name} - {loc.location_code}"
        })

    return render_template('part_lookup.html', all_warehouse_locations=locations_for_modal)

@web_bp.route('/parts/new', methods=['GET', 'POST'])
@login_required
def new_part():
    """Create new part page."""
    warehouses = Warehouse.get_all()

    if request.method == 'POST':
        # Delegate all logic to the service layer
        result = PartService.create_part_from_form(request.form)
        
        if result['success']:
            flash('零件新增成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            error_message = result.get('error', '零件新增失敗')
            if error_message == 'location_conflict':
                conflict_details = []
                for conflict in result.get('conflicts', []):
                    parts_info = ', '.join(conflict.get('parts', []))
                    conflict_details.append(f"倉位 {conflict.get('warehouse')} - {conflict.get('location')} 已被零件 {parts_info} 使用。")
                flash(f"零件新增失敗：儲位衝突。{''.join(conflict_details)}", 'error')
            elif error_message == 'duplicate_location_for_part':
                flash(f"零件新增失敗：{result.get('message', '零件不能重複指派相同的倉位。')}", 'error')
            else:
                flash(error_message, 'error')
            # Re-render the form with the data returned from the service
            return render_template('part_form.html', part=result.get('data', {}), warehouses=warehouses)
    
    # For GET request, render with empty part data
    return render_template('part_form.html', part={}, warehouses=warehouses)

@web_bp.route('/parts/<int:part_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_part(part_id):
    """Edit part page."""
    warehouses = Warehouse.get_all()
    part = Part.get_by_id(part_id)
    if not part:
        flash('找不到零件', 'error')
        return redirect(url_for('web.parts'))

    if request.method == 'POST':
        result = PartService.update_part_from_form(part_id, request.form)
        
        if result['success']:
            flash('零件更新成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            error_message = result.get('error', '零件更新失敗')
            if error_message == 'location_conflict':
                conflict_details = []
                for conflict in result.get('conflicts', []):
                    parts_info = ', '.join(conflict.get('parts', []))
                    conflict_details.append(f"倉位 {conflict.get('warehouse')} - {conflict.get('location')} 已被零件 {parts_info} 使用。")
                flash(f"零件更新失敗：儲位衝突。{''.join(conflict_details)}", 'error')
            elif error_message == 'duplicate_location_for_part':
                flash(f"零件更新失敗：{result.get('message', '零件不能重複指派相同的倉位。')}", 'error')
            else:
                flash(error_message, 'error')

            # Reconstruct the 'part' object for the template to prevent crashing
            # and to preserve user input.
            submitted_data = result.get('data', {})
            part_for_template = {}
            
            # Handle ImmutableMultiDict - convert lists to single values where appropriate
            for key, value in submitted_data.items():
                if isinstance(value, list) and len(value) == 1:
                    # Single-value lists should be converted to strings (except for location arrays)
                    if not key.endswith('[]'):
                        part_for_template[key] = value[0]
                    else:
                        part_for_template[key] = value
                else:
                    part_for_template[key] = value

            # 1. Ensure 'id' is present for url_for
            part_for_template['id'] = part_id

            # 2. Reconstruct the 'locations' list for the template
            part_for_template['locations'] = []
            warehouse_ids = part_for_template.get('location_warehouse_id[]', [])
            location_codes = part_for_template.get('location_code[]', [])
            
            # Ensure they are lists
            if not isinstance(warehouse_ids, list): warehouse_ids = [warehouse_ids]
            if not isinstance(location_codes, list): location_codes = [location_codes]

            for i in range(len(warehouse_ids)):
                try:
                    wh_id = int(warehouse_ids[i])
                    wh = Warehouse.get_by_id(wh_id)
                    wh_name = wh.name if wh else "未知倉庫"
                    
                    # We don't know the stock quantity here without more queries, so default to 'N/A'
                    part_for_template['locations'].append({
                        'warehouse_id': wh_id,
                        'warehouse_name': wh_name,
                        'location_code': location_codes[i],
                        'stock_quantity': 'N/A' 
                    })
                except (ValueError, IndexError):
                    continue
            
            # Re-render the form with the reconstructed data
            return render_template('part_form.html', part=part_for_template, edit_mode=True, warehouses=warehouses)
    
    # For GET request, prepare data for the template
    part_locations_with_stock = []
    for assoc in part.location_associations:
        location_dict = assoc.warehouse_location.to_dict()
        # 使用 warehouse_location_id 而不是 warehouse_id
        stock_info = CurrentInventory.get_current_stock(part.id, location_dict['id'])
        location_dict['stock_quantity'] = stock_info['quantity_on_hand'] if stock_info else 0
        part_locations_with_stock.append(location_dict)

    part_data_for_template = part.to_dict()
    part_data_for_template['locations'] = part_locations_with_stock

    return render_template('part_form.html', part=part_data_for_template, edit_mode=True, warehouses=warehouses)

@web_bp.route('/parts/<int:part_id>/delete', methods=['POST'])
@login_required
def delete_part(part_id):
    """Delete part."""
    # 檢查是否為管理員
    if current_user.role != 'admin':
        flash('您沒有權限執行此操作', 'error')
        return redirect(url_for('web.parts'))
    
    result = Part.delete(part_id)
    
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    
    return redirect(url_for('web.parts'))

@web_bp.route('/parts/import', methods=['POST'])
@login_required
def import_parts():
    """Batch import parts from an XLSX file."""
    if 'file' not in request.files:
        flash('沒有檔案被上傳', 'error')
        return redirect(url_for('web.parts'))

    file = request.files['file']
    if file.filename == '':
        flash('沒有選擇檔案', 'error')
        return redirect(url_for('web.parts'))

    if file and file.filename is not None and file.filename.endswith('.xlsx'):
        # Pass the file stream to the service layer
        result = PartService.import_parts_from_excel(file.stream)
        
        if result['success']:
            flash(result['message'], 'success')
            if result['errors']:
                for error_msg in result['errors']:
                    flash(error_msg, 'warning') # Use warning for individual row errors
        else:
            flash(result['error'], 'error')
            if result['errors']:
                for error_msg in result['errors']:
                    flash(error_msg, 'warning')

        return redirect(url_for('web.parts'))
    else:
        flash('只接受 .xlsx 格式的檔案', 'error')
        return redirect(url_for('web.parts'))

@web_bp.route('/parts/import/example')
@login_required
def import_parts_example():
    """Downloads a sample XLSX file for batch import."""
    data = {
        '零件編號': ['PN-001', 'PN-002'],
        '名稱': ['螺絲 A', '螺帽 B'],
        '描述': ['M5x10 規格', 'M5 規格'],
        '單位': ['個', '個'],
        '每盒數量': [100, 200],
        '儲存位置(倉別代碼:位置代碼, 逗號分隔)': ['W001:A-01-01, W001:B-02-03', 'W002:C-03-01'] # New format
    }
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='零件')
    
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='batch_import_example.xlsx'
    )

# 庫存管理路由
@web_bp.route('/inventory')
@login_required
def inventory():
    """庫存管理首頁"""
    warehouse_id = request.args.get('warehouse_id', type=int)
    sort_by = request.args.get('sort_by', 'status')
    sort_order = request.args.get('sort_order', 'asc')
    
    warehouses = Warehouse.get_all()
    inventories = CurrentInventory.get_detailed_inventory_view(
        warehouse_id=warehouse_id,
        sort_by=sort_by,
        sort_order=sort_order
    )
    low_stock_items = CurrentInventory.get_low_stock_items(warehouse_id)
    
    return render_template('inventory/index.html', 
                         warehouses=warehouses, 
                         inventories=inventories,
                         low_stock_items=low_stock_items,
                         selected_warehouse_id=warehouse_id,
                         sort_by=sort_by,
                         sort_order=sort_order)

@web_bp.route('/inventory/adjustment')
@login_required
def inventory_adjustment():
    """即時庫存調整頁面"""
    return render_template('inventory/adjustment.html')

@web_bp.route('/inventory/transactions')
@login_required
def inventory_transactions():
    """交易記錄頁面"""
    # 取得篩選參數
    part_id = request.args.get('part_id', type=int)
    warehouse_id = request.args.get('warehouse_id', type=int)
    location_id = request.args.get('location_id', type=int)  # 新增儲位參數
    transaction_type = request.args.get('transaction_type')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    page = request.args.get('page', 1, type=int)
    per_page = 50  # 每頁顯示筆數
    
    # 如果沒有指定日期範圍，預設為最近30天
    if not date_from and not date_to:
        today = datetime.now()
        thirty_days_ago = today - timedelta(days=30)
        date_from = thirty_days_ago.strftime('%Y-%m-%d')
        date_to = today.strftime('%Y-%m-%d')
    
    # 取得所有倉庫供篩選使用
    warehouses = Warehouse.get_all()  # 這已經返回字典列表了
    
    # 取得篩選後的交易記錄
    transactions_query = InventoryTransaction.query.join(Part).join(WarehouseLocation).join(Warehouse)
    
    # 應用篩選條件
    if part_id:
        transactions_query = transactions_query.filter(InventoryTransaction.part_id == part_id)
    if location_id:
        # 優先使用 location_id（更精確）
        transactions_query = transactions_query.filter(InventoryTransaction.warehouse_location_id == location_id)
    elif warehouse_id:
        # 如果沒有 location_id，才用 warehouse_id
        transactions_query = transactions_query.filter(Warehouse.id == warehouse_id)
    if transaction_type:
        if transaction_type == 'IN':
            transactions_query = transactions_query.filter(
                InventoryTransaction.transaction_type.in_(['IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'INBOUND'])
            )
        elif transaction_type == 'OUT':
            transactions_query = transactions_query.filter(
                InventoryTransaction.transaction_type.in_(['OUT_ISSUE', 'OUT_WORK_ORDER', 'OUT_SCRAP'])
            )
        elif transaction_type == 'TRANSFER':
            transactions_query = transactions_query.filter(
                InventoryTransaction.transaction_type.in_(['IN_TRANSFER', 'OUT_TRANSFER', 'TRANSFER'])
            )
        elif transaction_type == 'ADJUST':
            transactions_query = transactions_query.filter(InventoryTransaction.transaction_type == 'ADJUST')
    if date_from:
        try:
            from_date = datetime.strptime(date_from, '%Y-%m-%d')
            transactions_query = transactions_query.filter(InventoryTransaction.transaction_date >= from_date)
        except ValueError:
            pass
    if date_to:
        try:
            to_date = datetime.strptime(date_to, '%Y-%m-%d')
            to_date = to_date.replace(hour=23, minute=59, second=59)
            transactions_query = transactions_query.filter(InventoryTransaction.transaction_date <= to_date)
        except ValueError:
            pass
    
    # 按日期排序並分頁
    transactions_query = transactions_query.order_by(db.desc(InventoryTransaction.transaction_date), 
                                                   db.desc(InventoryTransaction.id))
    
    # 執行分頁查詢
    paginated = transactions_query.paginate(
        page=page, 
        per_page=per_page, 
        error_out=False
    )
    
    # 準備交易記錄資料
    transactions = []
    for transaction in paginated.items:
        transactions.append({
            'id': transaction.id,
            'transaction_date': transaction.transaction_date.strftime('%Y-%m-%d %H:%M:%S'),
            'transaction_type': transaction.transaction_type,
            'part_number': transaction.part.part_number if transaction.part else 'N/A',
            'part_name': transaction.part.name if transaction.part else 'N/A',
            'warehouse_name': transaction.warehouse_location.warehouse.name if transaction.warehouse_location and transaction.warehouse_location.warehouse else 'N/A',
            'location_code': transaction.warehouse_location.location_code if transaction.warehouse_location else 'N/A',
            'quantity': transaction.quantity,
            'user_name': transaction.user.full_name if transaction.user else None,
            'reference_type': transaction.reference_type,
            'reference_id': transaction.reference_id,
            'notes': transaction.notes
        })
    
    # 準備分頁資訊
    page_info = None
    if paginated.total and paginated.total > 0:
        page_info = {
            'current_page': page,
            'total_pages': paginated.pages,
            'total': paginated.total,
            'start': (page - 1) * per_page + 1,
            'end': min(page * per_page, paginated.total)
        }

    # 建立中文對照表
    transaction_type_map = {
        'IN_PURCHASE': '採購入庫',
        'IN_TRANSFER': '倉庫轉入', 
        'IN_RETURN': '退料入庫', 
        'INBOUND': '週期單入庫',
        'OUT_ISSUE': '領料出庫',
        'OUT_WORK_ORDER': '工單領用',
        'OUT_SCRAP': '報廢出庫',
        'OUT_TRANSFER': '倉庫轉出',
        'ADJUST': '庫存調整'
    }
    reference_type_map = {
        'OrderRegistration': '週期訂單',
        'StockCount': '庫存盤點',
        'MANUAL': '手動操作',
        'MANUAL_BATCH': '批量操作',
        'ADMIN_ACTION': '管理員操作',
        'PURCHASE': '採購入庫',
        'TRANSFER': '倉位轉移',
        'WORK_ORDER': '工單領料',
        'ADJUSTMENT': '庫存調整',
        'RETURN': '退料入庫',
        'SCRAP': '報廢處理',
        'COUNT': '盤點調整'
    }
    
    return render_template('inventory/transactions.html',
                         warehouses=warehouses,
                         transactions=transactions,
                         page_info=page_info,
                         selected_part_id=part_id,
                         selected_warehouse_id=warehouse_id,
                         selected_location_id=location_id,
                         selected_transaction_type=transaction_type,
                         selected_date_from=date_from,
                         selected_date_to=date_to,
                         transaction_type_map=transaction_type_map,
                         reference_type_map=reference_type_map)

@web_bp.route('/reports/parts-comparison')
@login_required
def parts_comparison_report():
    """零件差異分析報告頁面"""
    return render_template('reports/parts_comparison.html')

@web_bp.route('/reports/ai-query')
@login_required
def ai_query_report():
    """AI資料庫查詢頁面"""
    return render_template('reports/ai_query.html')

from services.report_service import ReportService



@web_bp.route('/reports/parts-comparison/data')
@login_required

def parts_comparison_data():

    """獲取零件差異分析數據"""

    data = ReportService.get_parts_comparison_data()

    return jsonify(data)



@web_bp.route('/reports/parts-comparison/export')
@login_required

def export_parts_comparison():

    """匯出零件差異分析數據到 Excel"""

    try:

        file_content, filename = ReportService.export_parts_comparison_excel()

        return send_file(BytesIO(file_content),

                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

                         as_attachment=True,

                         download_name=filename)

    except Exception as e:

        flash(f"匯出失敗: {str(e)}", 'error')

        return redirect(url_for('web.parts_comparison_report'))

@web_bp.route('/reports/parts-comparison/add-parts', methods=['POST'])
@login_required
def add_parts_to_comparison():
    """批次新增零件至零件倉"""
    # 暫時返回成功
    return jsonify({'success': True, 'message': '功能開發中'})

@web_bp.route('/reports/parts-comparison/add-part-detailed', methods=['POST'])
@login_required
def add_part_detailed():
    """新增單個零件(詳細資訊)至零件倉"""
    from models.part import Part
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '請求數據格式錯誤'
            })
        
        part_number = data.get('part_number', '').strip()
        name = data.get('name', '').strip()
        
        if not part_number or not name:
            return jsonify({
                'success': False,
                'error': '零件編號和名稱不能為空'
            })
        
        # 檢查零件是否已存在
        existing_part = Part.query.filter_by(part_number=part_number).first()
        if existing_part:
            return jsonify({
                'success': False,
                'error': f'零件編號 {part_number} 已存在'
            })
        
        # 創建新零件
            new_part = Part(
                part_number=part_number,
                name=name,
                description=data.get('description', ''),
                unit=data.get('unit', '個'),
                quantity_per_box=data.get('quantity_per_box', 1),
                lead_time=data.get('lead_time', 5), # Include lead_time
                standard_cost=data.get('standard_cost', 0),
                is_active=True
            )        
        db.session.add(new_part)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'成功新增零件 {part_number}',
            'part_id': new_part.id
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'新增零件時發生錯誤: {str(e)}'
        })

@web_bp.route('/reports/parts-comparison/create-purchase-order', methods=['POST'])
@login_required
def create_purchase_order():
    """建立採購單"""
    from models.order import Order
    from models.part import Part
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': '請求數據格式錯誤'
            })
        
        order_number = data.get('order_number', '').strip()
        expected_date = data.get('expected_date')
        priority = data.get('priority', 'normal')
        notes = data.get('notes', '')
        items = data.get('items', [])
        
        if not order_number or not expected_date or not items:
            return jsonify({
                'success': False,
                'error': '請填寫所有必要資訊'
            })
        
        # 轉換日期格式
        from datetime import datetime
        try:
            expected_date = datetime.strptime(expected_date, '%Y-%m-%d')
        except ValueError:
            return jsonify({
                'success': False,
                'error': '日期格式錯誤'
            })
        
        # 計算總金額
        total_amount = sum(item.get('subtotal', 0) for item in items)
        
        # 為每個零件創建訂單記錄
        order_ids = []
        
        for item in items:
            part_number = item.get('part_number')
            quantity = item.get('quantity', 0)
            unit_price = item.get('unit_price', 0)
            
            # 查找零件
            part = Part.query.filter_by(part_number=part_number).first()
            if not part:
                continue
            
            # 創建訂單記錄
            new_order = Order(
                part_id=part.id,
                warehouse_id=1,  # 預設倉庫
                quantity_ordered=quantity,
                quantity_received=0,
                unit_cost=unit_price,
                status='pending',
                supplier='自動採購單',  # 預設供應商
                expected_date=expected_date,
                notes=f"{order_number} - {notes}" if notes else order_number
            )
            
            db.session.add(new_order)
            db.session.flush()
            order_ids.append(new_order.id)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'採購單 {order_number} 建立成功',
            'order_ids': order_ids,
            'order_number': order_number,
            'total_amount': total_amount,
            'items_count': len(items)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'建立採購單時發生錯誤: {str(e)}'
        })

from services.inventory_service import InventoryService

@web_bp.route('/inventory/stock-in', methods=['GET', 'POST'])
@login_required
def stock_in():
    """入庫作業頁面"""
    if request.method == 'POST':
        result = InventoryService.perform_stock_in_from_form(request.form, user_id=current_user.id)
        if result['success']:
            flash(result['message'], 'success')
        else:
            flash(result['message'], 'error')
        return redirect(url_for('web.stock_in'))
    
    warehouses = Warehouse.get_all()
    parts_list = [part.to_dict(include_locations=True) for part in Part.get_all()]
    return render_template('inventory/stock_in.html', warehouses=warehouses, parts=parts_list)

@web_bp.route('/inventory/stock-out', methods=['GET', 'POST'])
@login_required
def stock_out():
    """出庫作業頁面"""
    if request.method == 'POST':
        result = InventoryService.perform_stock_out_from_form(request.form, user_id=current_user.id)
        if result['success']:
            flash(result['message'], 'success')
        else:
            flash(result['message'], 'error')
        return redirect(url_for('web.stock_out'))
    
    warehouses = Warehouse.get_all()
    parts_list = [part.to_dict(include_locations=True) for part in Part.get_all()]
    return render_template('inventory/stock_out.html', warehouses=warehouses, parts=parts_list)

@web_bp.route('/inventory/batch-stock-out')
@login_required
def batch_stock_out():
    """
    Renders the batch stock-out page.
    """
    warehouses = Warehouse.get_all()
    return render_template('inventory/batch_stock_out.html', warehouses=warehouses)

@web_bp.route('/inventory/stock-counts')
@login_required
def stock_counts():
    """盤點管理頁面"""
    counts = StockCount.get_all_counts()
    warehouses = Warehouse.get_all()
    return render_template('inventory/stock_counts.html', counts=counts, warehouses=warehouses)

@web_bp.route('/inventory/stock-counts/new')
@login_required
def new_stock_count():
    """建立新盤點頁面"""
    warehouses = Warehouse.get_all()
    return render_template('inventory/new_stock_count.html', warehouses=warehouses)

@web_bp.route('/inventory/stock-counts/<int:count_id>')
@login_required
def stock_count_detail(count_id):
    """盤點明細頁面"""
    count_info = StockCount.get_count_by_id(count_id)
    if not count_info:
        flash('找不到盤點記錄', 'error')
        return redirect(url_for('web.stock_counts'))
    
    # 獲取排序參數
    sort_by = request.args.get('sort_by', 'part_number')
    sort_order = request.args.get('sort_order', 'asc')
    
    details = StockCount.get_count_details(count_id, sort_by, sort_order)
    
    return render_template('inventory/stock_count_detail.html', 
                         count_info=count_info, 
                         details=details,
                         sort_by=sort_by,
                         sort_order=sort_order)

@web_bp.route('/inventory/stock-counts/<int:count_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_stock_count(count_id):
    """Edit an existing stock count."""
    # Use .first() to get a single object or None
    count = StockCount.query.get(count_id)
    if not count:
        flash('找不到盤點記錄', 'error')
        return redirect(url_for('web.stock_counts'))

    # A user can only edit a count if it is in the 'planning' status
    if count.status != 'planning':
        flash('只能編輯「規劃中」的盤點', 'error')
        return redirect(url_for('web.stock_count_detail', count_id=count_id))

    if request.method == 'POST':
        count_type = request.form.get('count_type')
        count_date_str = request.form.get('count_date')
        counted_by = request.form.get('counted_by')
        notes = request.form.get('notes')
        
        from datetime import datetime
        count_date = None
        if count_date_str:
            try:
                # The date from the form is a string, convert it to a date object
                count_date = datetime.strptime(count_date_str, '%Y-%m-%d')
            except (ValueError, TypeError):
                flash('無效的日期格式', 'error')
                # Get all warehouses for the dropdown
                warehouses = Warehouse.get_all()
                return render_template('inventory/edit_stock_count.html', count=count, warehouses=warehouses)
        else:
            flash('盤點日期為必填項目', 'error')
            warehouses = Warehouse.get_all()
            return render_template('inventory/edit_stock_count.html', count=count, warehouses=warehouses)

        success = StockCount.update_count(
            count_id=count_id,
            count_type=count_type,
            count_date=count_date,
            counted_by=counted_by,
            notes=notes
        )
        
        if success:
            flash('盤點更新成功', 'success')
            return redirect(url_for('web.stock_count_detail', count_id=count_id))
        else:
            flash('盤點更新失敗', 'error')
            # Re-render the edit page with the current (failed) data
            warehouses = Warehouse.get_all()
            return render_template('inventory/edit_stock_count.html', count=count, warehouses=warehouses)

    # For GET request, also get all warehouses for the dropdown
    warehouses = Warehouse.get_all()
    return render_template('inventory/edit_stock_count.html', count=count, warehouses=warehouses)

@web_bp.route('/sw.js')
def service_worker():
    """Service Worker 路由 (用於 PWA)"""
    from flask import send_from_directory
    import os
    return send_from_directory(os.path.join(os.getcwd(), 'static'), 'sw.js', mimetype='application/javascript')

@web_bp.route('/pwa-test')
@login_required
def pwa_test():
    """PWA 測試頁面"""
    return render_template('pwa_test.html')

@web_bp.route('/pwa-install')
@login_required
def pwa_install():
    """PWA 快速安裝頁面"""
    return render_template('pwa_install.html')

@web_bp.route('/camera-test')
@login_required
def camera_test():
    """相機和條碼掃描測試頁面"""
    return render_template('camera_test.html')

from services.part_service import PartService # Import the new service

# ==================== 倉位管理 ====================

@web_bp.route('/warehouse-locations')
@login_required
def warehouse_locations():
    """倉位管理頁面"""
    warehouses = Warehouse.get_all()
    
    locations = db.session.query(WarehouseLocation, Warehouse)\
        .join(Warehouse, WarehouseLocation.warehouse_id == Warehouse.id)\
        .order_by(Warehouse.name, WarehouseLocation.location_code)\
        .all()
    
    locations_data = []
    for loc, wh in locations:
        locations_data.append({
            'id': loc.id,
            'warehouse_id': loc.warehouse_id,
            'warehouse_name': wh.name,
            'warehouse_code': wh.code,
            'location_code': loc.location_code,
            'description': loc.description
        })
    
    return render_template('warehouse_locations.html', 
                         warehouses=warehouses, 
                         locations=locations_data)

@web_bp.route('/warehouse-locations/add', methods=['POST'])
@login_required
def add_warehouse_location():
    """新增倉位"""
    result = PartService.add_warehouse_location(request.form)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouse-locations/<int:location_id>/edit', methods=['POST'])
@login_required
def edit_warehouse_location(location_id):
    """編輯倉位"""
    result = PartService.edit_warehouse_location(location_id, request.form)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouse-locations/<int:location_id>/delete', methods=['POST'])
@login_required
def delete_warehouse_location(location_id):
    """刪除倉位"""
    result = PartService.delete_warehouse_location(location_id)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    return redirect(url_for('web.warehouse_locations'))

# ==================== 倉庫管理 ====================

@web_bp.route('/warehouses/add', methods=['POST'])
@login_required
def add_warehouse():
    """新增倉庫"""
    result = PartService.add_warehouse(request.form)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouses/<int:warehouse_id>/edit', methods=['POST'])
@login_required
def edit_warehouse(warehouse_id):
    """編輯倉庫"""
    result = PartService.edit_warehouse(warehouse_id, request.form)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouses/<int:warehouse_id>/delete', methods=['POST'])
@login_required
def delete_warehouse(warehouse_id):
    """刪除倉庫"""
    result = PartService.delete_warehouse(warehouse_id)
    if result['success']:
        flash(result['message'], 'success')
    else:
        flash(result['message'], 'error')
    return redirect(url_for('web.warehouse_locations'))

# ==================== 管理員專用：交易記錄管理 ====================

@web_bp.route('/admin/transactions/<int:transaction_id>/delete', methods=['POST'])
@admin_required
def delete_transaction_record(transaction_id):
    """
    管理員專用：刪除交易記錄（開發/測試用）
    
    ⚠️ 警告：此功能僅供開發階段清理測試數據使用
    生產環境中不建議刪除交易記錄，會影響庫存一致性
    """
    try:
        data = request.get_json()
        reason = data.get('reason', '').strip() if data else ''
        
        if not reason:
            return jsonify({
                'success': False,
                'message': '請提供刪除原因'
            }), 400
        
        # 查找交易記錄
        transaction = InventoryTransaction.query.get(transaction_id)
        if not transaction:
            return jsonify({
                'success': False,
                'message': '找不到指定的交易記錄'
            }), 404
        
        # 記錄刪除資訊（用於審計）
        deleted_info = {
            'id': transaction.id,
            'part_id': transaction.part_id,
            'part_number': transaction.part.part_number if transaction.part else 'N/A',
            'warehouse_location_id': transaction.warehouse_location_id,
            'transaction_type': transaction.transaction_type,
            'quantity': transaction.quantity,
            'transaction_date': transaction.transaction_date.isoformat() if transaction.transaction_date else None,
            'user_id': transaction.user_id,
            'reference_type': transaction.reference_type,
            'reference_id': transaction.reference_id,
            'notes': transaction.notes,
            'deleted_by': current_user.id,
            'deleted_at': datetime.now().isoformat(),
            'delete_reason': reason
        }
        
        # 重新計算庫存（反向操作）
        stock_update_info = "無庫存更新"
        if transaction.warehouse_location_id:
            current_stock = CurrentInventory.query.filter_by(
                part_id=transaction.part_id,
                warehouse_location_id=transaction.warehouse_location_id
            ).first()
            
            if current_stock:
                # 記錄原始庫存
                old_quantity = current_stock.quantity_on_hand
                old_available = current_stock.available_quantity
                
                # 反向調整庫存
                reverse_quantity = -transaction.quantity
                current_stock.quantity_on_hand += reverse_quantity
                current_stock.available_quantity = current_stock.quantity_on_hand - current_stock.reserved_quantity
                
                # 確保庫存不為負數
                current_stock.quantity_on_hand = max(0, current_stock.quantity_on_hand)
                current_stock.available_quantity = max(0, current_stock.available_quantity)
                
                # 記錄更新資訊
                stock_update_info = f"庫存更新: {old_quantity} → {current_stock.quantity_on_hand} (變化: {reverse_quantity})"
            else:
                stock_update_info = f"找不到庫存記錄 (零件ID: {transaction.part_id}, 儲位ID: {transaction.warehouse_location_id})"
        else:
            stock_update_info = f"無儲位ID，跳過庫存更新 (交易ID: {transaction_id})"
        
        # 建立審計記錄（新增一筆特殊的交易記錄）
        audit_transaction = InventoryTransaction(
            part_id=transaction.part_id,
            warehouse_id=transaction.warehouse_id,
            warehouse_location_id=transaction.warehouse_location_id,
            transaction_type='ADMIN_DELETE',
            quantity=0,  # 不影響庫存，純記錄用
            reference_type='ADMIN_ACTION',
            reference_id=transaction_id,
            notes=f'管理員刪除交易記錄 #{transaction_id}。原因：{reason}。原交易：{transaction.transaction_type} {transaction.quantity}',
            user_id=current_user.id,
            transaction_date=datetime.now()
        )
        db.session.add(audit_transaction)
        
        # 刪除原交易記錄
        db.session.delete(transaction)
        
        # 提交更改
        db.session.commit()
        
        # 記錄到系統日誌（如果有的話）
        print(f"ADMIN_DELETE_TRANSACTION: {deleted_info}")
        print(f"STOCK_UPDATE: {stock_update_info}")
        
        return jsonify({
            'success': True,
            'message': f'交易記錄已刪除。{stock_update_info}。審計記錄已建立。'
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"刪除交易記錄時發生錯誤: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'刪除失敗：{str(e)}'
        }), 500
