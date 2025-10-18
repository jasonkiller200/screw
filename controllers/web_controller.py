from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_file
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation # Import PartWarehouseLocation for dummy object
from models.order import Order
from models.inventory import CurrentInventory, InventoryTransaction, StockCount
from extensions import db
from datetime import datetime, timedelta
import os
import pandas as pd
from werkzeug.utils import secure_filename
from io import BytesIO
from services.part_service import PartService # Import the new service

web_bp = Blueprint('web', __name__)

# Helper class for re-rendering part form with unsaved locations
class DummyPartWarehouseLocation:
    def __init__(self, warehouse_location):
        self.warehouse_location = warehouse_location

@web_bp.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

@web_bp.route('/parts')
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
def orders():
    """重定向到週期訂單頁面"""
    flash('所有訂單管理已統一到週期訂單系統中', 'info')
    return redirect(url_for('weekly_order.weekly_orders'))

@web_bp.route('/order-history')
def order_history():
    """歷史訂單記錄頁面 - 只顯示已遷移的訂單"""
    migrated_orders = Order.query.filter_by(status='migrated').order_by(db.desc(Order.order_date)).all()
    confirmed_orders = Order.query.filter_by(status='confirmed').order_by(db.desc(Order.order_date)).all()
    
    all_history_orders = migrated_orders + confirmed_orders
    
    return render_template('order_history.html', 
                         history_orders=all_history_orders,
                         migrated_count=len(migrated_orders),
                         confirmed_count=len(confirmed_orders))

@web_bp.route('/work-orders')
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

@web_bp.route('/work-orders/import', methods=['POST'])
def import_work_order_demands():
    """匯入工單需求資料"""
    from models.work_order import WorkOrderDemand
    from datetime import datetime
    from extensions import db
    
    if 'excel_file' not in request.files:
        return jsonify({'success': False, 'error': '沒有檔案被上傳'})

    file = request.files['excel_file']
    if file.filename == '':
        return jsonify({'success': False, 'error': '沒有選擇檔案'})

    if not (file and file.filename is not None and file.filename.lower().endswith(('.xlsx', '.xls'))):
        return jsonify({'success': False, 'error': '請上傳 Excel 檔案 (.xlsx 或 .xls 格式)'})

    try:
        # 讀取 Excel 檔案
        df = pd.read_excel(file.stream)
        
        # 驗證必要欄位
        required_columns = ['訂單', '物料', '需求數量 (EINHEIT)', '物料說明', '作業說明', '上層物料說明', '需求日期', '散裝物料']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            return jsonify({
                'success': False, 
                'error': f'Excel 檔案缺少必要欄位: {", ".join(missing_columns)}'
            })
        
        imported_count = 0
        updated_count = 0
        error_count = 0
        filtered_count = 0  # 新增：被篩選掉的數量
        
        # 處理每一行資料
        for index, row in df.iterrows():
            try:
                # 讀取欄位資料
                order_id = str(row['訂單']).strip()
                part_number = str(row['物料']).strip()
                required_quantity = float(row['需求數量 (EINHEIT)'])
                
                # 處理可能為空的欄位
                material_description = str(row['物料說明']).strip() if not pd.isna(row['物料說明']) else ''
                operation_description = str(row['作業說明']).strip() if not pd.isna(row['作業說明']) else ''
                parent_material_description = str(row['上層物料說明']).strip() if not pd.isna(row['上層物料說明']) else ''
                bulk_material = str(row['散裝物料']).strip() if not pd.isna(row['散裝物料']) else ''
                
                # 篩選：跳過物料說明包含"圖"的項目
                if '圖' in material_description:
                    filtered_count += 1
                    continue  # 跳過此項目，不進行匯入
                
                # 解析需求日期
                required_date = row['需求日期']
                if pd.isna(required_date):
                    required_date = datetime.now()
                elif isinstance(required_date, str):
                    try:
                        required_date = datetime.strptime(required_date, '%Y-%m-%d')
                    except:
                        required_date = datetime.now()
                elif not isinstance(required_date, datetime):
                    required_date = datetime.now()
                
                # 檢查記錄是否已存在
                existing_demand = WorkOrderDemand.query.filter_by(
                    order_id=order_id, 
                    part_number=part_number
                ).first()
                
                if existing_demand:
                    # 更新現有記錄
                    existing_demand.required_quantity = required_quantity
                    existing_demand.material_description = material_description
                    existing_demand.operation_description = operation_description
                    existing_demand.parent_material_description = parent_material_description
                    existing_demand.required_date = required_date
                    existing_demand.bulk_material = bulk_material
                    updated_count += 1
                else:
                    # 建立新記錄
                    new_demand = WorkOrderDemand()
                    new_demand.order_id = order_id
                    new_demand.part_number = part_number
                    new_demand.required_quantity = required_quantity
                    new_demand.material_description = material_description
                    new_demand.operation_description = operation_description
                    new_demand.parent_material_description = parent_material_description
                    new_demand.required_date = required_date
                    new_demand.bulk_material = bulk_material
                    
                    db.session.add(new_demand)
                    imported_count += 1
                    
            except Exception as e:
                error_count += 1
                print(f"處理第 {index + 2} 行時發生錯誤: {e}")
        
        # 提交資料庫變更
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'updated_count': updated_count,
            'error_count': error_count,
            'filtered_count': filtered_count,  # 新增：被篩選掉的數量
            'total_processed': len(df)
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False, 
            'error': f'匯入過程發生錯誤: {str(e)}'
        })

@web_bp.route('/part_lookup')
def part_lookup():
    """Part lookup page for barcode scanning."""
    return render_template('part_lookup.html')

@web_bp.route('/parts/new', methods=['GET', 'POST'])
def new_part():
    """Create new part page."""
    part_data = {}
    warehouses = Warehouse.get_all() # Get all warehouses for dropdown

    if request.method == 'POST':
        part_number = request.form.get('part_number')
        name = request.form.get('name')
        description = request.form.get('description')
        unit = request.form.get('unit')
        quantity_per_box = request.form.get('quantity_per_box')
        
        # Get locations data from form
        location_warehouse_ids = request.form.getlist('location_warehouse_id[]')
        location_codes = request.form.getlist('location_code[]')
        
        locations_data = []
        for i in range(len(location_warehouse_ids)):
            wh_id = location_warehouse_ids[i]
            loc_code = location_codes[i]
            # Only add if both warehouse_id and location_code are provided
            if wh_id and loc_code:
                locations_data.append({'warehouse_id': int(wh_id), 'location_code': loc_code})

        # Validate required fields and at least one storage location
        # description is nullable, so it's not included in the all() check
        # Explicitly check for None or empty strings for required fields
        if not part_number or not name or not unit or not quantity_per_box:
            flash('所有欄位都是必填的，且至少需要一個儲存位置', 'error')
            part_data = {
                'part_number': part_number,
                'name': name,
                'description': description,
                'unit': unit,
                'quantity_per_box': quantity_per_box,
                'locations': locations_data
            }
            return render_template('part_form.html', part=part_data, warehouses=warehouses)
        
        # Validate for duplicate locations within the submitted data
        seen_locations = set()
        for loc_data in locations_data:
            location_tuple = (loc_data['warehouse_id'], loc_data['location_code'].lower()) # Case-insensitive check for location code
            if location_tuple in seen_locations:
                flash(f"儲存位置重複：倉庫ID {loc_data['warehouse_id']} 的位置代碼 '{loc_data['location_code']}' 已存在於提交的列表中。", 'error')
                part_data = {
                    'part_number': part_number,
                    'name': name,
                    'description': description,
                    'unit': unit,
                    'quantity_per_box': quantity_per_box,
                    'locations': locations_data
                }
                return render_template('part_form.html', part=part_data, warehouses=warehouses)
            seen_locations.add(location_tuple)

        try:
            quantity_per_box = int(quantity_per_box)
        except ValueError:
            flash('每盒數量必須是數字', 'error')
            part_data = {
                'part_number': part_number,
                'name': name,
                'description': description,
                'unit': unit,
                'quantity_per_box': quantity_per_box,
                'locations': locations_data
            }
            return render_template('part_form.html', part=part_data, warehouses=warehouses)
        
        # Corrected Part.create call: description is passed as a keyword argument
        result = Part.create(
            part_number=part_number, 
            name=name, 
            description=description, 
            unit=unit, 
            quantity_per_box=quantity_per_box, 
            locations_data=locations_data
        )
        
        if result['success']:
            flash('零件新增成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            # 處理倉位衝突錯誤
            if result.get('error') == 'location_conflict':
                conflicts = result.get('conflicts', [])
                error_msg = '倉位衝突！以下倉位已被其他零件使用：\n'
                for conflict in conflicts:
                    error_msg += f"\n• {conflict['warehouse']} - {conflict['location']}\n"
                    error_msg += f"  使用中的零件: {', '.join(conflict['parts'][:3])}"
                    if len(conflict['parts']) > 3:
                        error_msg += f" 等 {len(conflict['parts'])} 個零件"
                flash(error_msg, 'error')
            else:
                flash(str(result.get('error', '零件新增失敗')), 'error') # Ensure message is string
            
            part_data = {
                'part_number': part_number,
                'name': name,
                'description': description,
                'unit': unit,
                'quantity_per_box': quantity_per_box,
                'locations': locations_data
            }
            return render_template('part_form.html', part=part_data, warehouses=warehouses)
    
    return render_template('part_form.html', part=part_data, warehouses=warehouses)

@web_bp.route('/parts/<int:part_id>/edit', methods=['GET', 'POST'])
def edit_part(part_id):
    """Edit part page."""
    warehouses = Warehouse.get_all() # Get all warehouses for dropdown

    if request.method == 'POST':
        part_number = request.form.get('part_number')
        name = request.form.get('name')
        type = request.form.get('type')
        description = request.form.get('description')
        unit = request.form.get('unit')
        quantity_per_box = request.form.get('quantity_per_box')
        
        # Get locations data from form
        location_warehouse_ids = request.form.getlist('location_warehouse_id[]')
        location_codes = request.form.getlist('location_code[]')
        
        locations_data = []
        for i in range(len(location_warehouse_ids)):
            wh_id = location_warehouse_ids[i]
            loc_code = location_codes[i]
            if wh_id and loc_code:
                locations_data.append({'warehouse_id': int(wh_id), 'location_code': loc_code})

        # Validate required fields and at least one storage location
        # description is nullable, so it's not included in the all() check
        # Explicitly check for None or empty strings for required fields
        if not part_number or not name or not unit or not quantity_per_box:
            flash('所有欄位都是必填的，且至少需要一個儲存位置', 'error')
            # To re-render the form with submitted data, we need to fetch the part again
            part = Part.get_by_id(part_id)
            if part:
                # Update part object attributes for re-rendering
                part.name = name
                part.type = type
                part.description = description
                part.unit = unit
                part.quantity_per_box = quantity_per_box
                # Manually set locations for re-rendering
                part.location_associations = [] # Clear existing associations for re-rendering
                for loc_data in locations_data:
                    dummy_wh_loc = WarehouseLocation(loc_data['warehouse_id'], loc_data['location_code'])
                    part.location_associations.append(DummyPartWarehouseLocation(dummy_wh_loc))
            return render_template('part_form.html', part=part, edit_mode=True, warehouses=warehouses)
        
        # Validate for duplicate locations within the submitted data
        seen_locations = set()
        for loc_data in locations_data:
            location_tuple = (loc_data['warehouse_id'], loc_data['location_code'].lower()) # Case-insensitive check for location code
            if location_tuple in seen_locations:
                flash(f"儲存位置重複：倉庫ID {loc_data['warehouse_id']} 的位置代碼 '{loc_data['location_code']}' 已存在於提交的列表中。", 'error')
                part = Part.get_by_id(part_id)
                if part:
                    part.name = name
                    part.type = type
                    part.description = description
                    part.unit = unit
                    part.quantity_per_box = quantity_per_box
                    part.location_associations = [] # Clear existing associations for re-rendering
                    for loc_data_re_render in locations_data:
                        dummy_wh_loc = WarehouseLocation(loc_data_re_render['warehouse_id'], loc_data_re_render['location_code'])
                        part.location_associations.append(DummyPartWarehouseLocation(dummy_wh_loc))
                return render_template('part_form.html', part=part, edit_mode=True, warehouses=warehouses)
            seen_locations.add(location_tuple)

        try:
            quantity_per_box = int(quantity_per_box)
        except ValueError:
            flash('每盒數量必須是數字', 'error')
            part = Part.get_by_id(part_id)
            if part:
                part.part_number = part_number
                part.name = name
                part.description = description
                part.unit = unit
                part.quantity_per_box = quantity_per_box
                part.location_associations = [] # Clear existing associations for re-rendering
                for loc_data_re_render in locations_data:
                    dummy_wh_loc = WarehouseLocation(loc_data_re_render['warehouse_id'], loc_data_re_render['location_code'])
                    part.location_associations.append(DummyPartWarehouseLocation(dummy_wh_loc))
            return render_template('part_form.html', part=part, edit_mode=True, warehouses=warehouses)
        
        # Corrected Part.update call: description is passed as a keyword argument
        result = Part.update(
            part_id=part_id, 
            part_number=part_number, 
            name=name, 
            type=type, 
            description=description, 
            unit=unit, 
            quantity_per_box=quantity_per_box, 
            locations_data=locations_data
        )
        
        if result['success']:
            flash('零件更新成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            # 處理倉位衝突錯誤
            if result.get('error') == 'location_conflict':
                conflicts = result.get('conflicts', [])
                error_msg = '倉位衝突！以下倉位已被其他零件使用：\n'
                for conflict in conflicts:
                    error_msg += f"\n• {conflict['warehouse']} - {conflict['location']}\n"
                    error_msg += f"  使用中的零件: {', '.join(conflict['parts'][:3])}"
                    if len(conflict['parts']) > 3:
                        error_msg += f" 等 {len(conflict['parts'])} 個零件"
                flash(error_msg, 'error')
            else:
                flash(str(result.get('error', '零件更新失敗')), 'error') # Ensure message is string
    
    # Get existing part data for the form
    part = Part.get_by_id(part_id)
    
    if not part:
        flash('找不到零件', 'error')
        return redirect(url_for('web.parts'))
    
    return render_template('part_form.html', part=part, edit_mode=True, warehouses=warehouses)

@web_bp.route('/parts/<int:part_id>/delete', methods=['POST'])
def delete_part(part_id):
    """Delete part."""
    success = Part.delete(part_id)
    
    if success:
        flash('零件刪除成功', 'success')
    else:
        flash('零件刪除失敗', 'error')
    
    return redirect(url_for('web.parts'))

@web_bp.route('/parts/import', methods=['POST'])
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
def inventory():
    """庫存管理首頁"""
    warehouse_id = request.args.get('warehouse_id', type=int)
    warehouses = Warehouse.get_all()
    inventories = CurrentInventory.get_all_inventory(warehouse_id)
    low_stock_items = CurrentInventory.get_low_stock_items(warehouse_id)
    
    return render_template('inventory/index.html', 
                         warehouses=warehouses, 
                         inventories=inventories,
                         low_stock_items=low_stock_items,
                         selected_warehouse_id=warehouse_id)

@web_bp.route('/inventory/transactions')
def inventory_transactions():
    """交易記錄頁面"""
    # 取得篩選參數
    part_id = request.args.get('part_id', type=int)
    warehouse_id = request.args.get('warehouse_id', type=int)
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
    transactions_query = InventoryTransaction.query.join(Part).join(Warehouse)
    
    # 應用篩選條件
    if part_id:
        transactions_query = transactions_query.filter(InventoryTransaction.part_id == part_id)
    if warehouse_id:
        transactions_query = transactions_query.filter(InventoryTransaction.warehouse_id == warehouse_id)
    if transaction_type:
        transactions_query = transactions_query.filter(InventoryTransaction.transaction_type == transaction_type)
    if date_from:
        try:
            from_date = datetime.strptime(date_from, '%Y-%m-%d')
            transactions_query = transactions_query.filter(InventoryTransaction.transaction_date >= from_date)
        except ValueError:
            pass
    if date_to:
        try:
            to_date = datetime.strptime(date_to, '%Y-%m-%d')
            # 加上一天，使結束日期包含當天的所有記錄
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
            'warehouse_name': transaction.warehouse.name if transaction.warehouse else 'N/A',
            'quantity': transaction.quantity,
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
    
    return render_template('inventory/transactions.html',
                         warehouses=warehouses,
                         transactions=transactions,
                         page_info=page_info,
                         selected_part_id=part_id,
                         selected_warehouse_id=warehouse_id,
                         selected_transaction_type=transaction_type,
                         selected_date_from=date_from,
                         selected_date_to=date_to)

@web_bp.route('/reports/parts-comparison')
def parts_comparison_report():
    """零件差異分析報告頁面"""
    return render_template('reports/parts_comparison.html')

@web_bp.route('/reports/parts-comparison/data')
def parts_comparison_data():
    """獲取零件差異分析數據"""
    from models.work_order import WorkOrderDemand
    from models.inventory import CurrentInventory
    from models.part import Part
    
    try:
        # 1. 取得工單需求零件的詳細資訊
        work_order_details = db.session.query(
            WorkOrderDemand.part_number,
            WorkOrderDemand.material_description,
            db.func.sum(WorkOrderDemand.required_quantity).label('total_required'),
            db.func.count(WorkOrderDemand.order_id).label('order_count')
        ).group_by(
            WorkOrderDemand.part_number,
            WorkOrderDemand.material_description
        ).all()
        
        work_order_dict = {}
        for row in work_order_details:
            work_order_dict[row[0]] = {
                'description': row[1],
                'total_required': float(row[2]),
                'order_count': int(row[3])
            }
        
        # 2. 取得零件倉零件的詳細資訊
        inventory_details = db.session.query(Part).all()
        
        inventory_dict = {}
        for part in inventory_details:
            inventory_dict[part.part_number] = {
                'name': part.name,
                'unit': part.unit or '',
                'description': part.description or ''
            }
        
        # 3. 取得零件庫存資訊
        stock_details = db.session.query(
            Part.part_number,
            db.func.sum(CurrentInventory.quantity_on_hand).label('total_stock'),
            db.func.sum(CurrentInventory.available_quantity).label('available_stock')
        ).join(CurrentInventory, Part.id == CurrentInventory.part_id).group_by(Part.part_number).all()
        
        stock_dict = {}
        for row in stock_details:
            stock_dict[row[0]] = {
                'total_stock': float(row[1]) if row[1] else 0,
                'available_stock': float(row[2]) if row[2] else 0
            }
        
        # 4. 分析差異
        # 4.1 工單需求有但零件倉沒有的零件
        missing_in_inventory = []
        for part_number, details in work_order_dict.items():
            if part_number not in inventory_dict:
                missing_in_inventory.append({
                    'part_number': part_number,
                    'description': details['description'],
                    'total_required': details['total_required'],
                    'order_count': details['order_count'],
                    'status': '工單需求有，零件倉缺少',
                    'action': '新增至零件倉'
                })
        
        # 4.2 零件倉有的零件與工單需求對比
        inventory_with_demand = []
        for part_number, details in inventory_dict.items():
            work_order_info = work_order_dict.get(part_number, {})
            stock_info = stock_dict.get(part_number, {'total_stock': 0, 'available_stock': 0})
            
            required_qty = work_order_info.get('total_required', 0)
            available_qty = stock_info.get('available_stock', 0)
            shortage = max(0, required_qty - available_qty)
            
            inventory_with_demand.append({
                'part_number': part_number,
                'name': details['name'],
                'description': details['description'],
                'unit': details['unit'],
                'required_quantity': required_qty,
                'total_stock': stock_info.get('total_stock', 0),
                'available_stock': available_qty,
                'shortage': shortage,
                'order_count': work_order_info.get('order_count', 0),
                'has_demand': required_qty > 0,
                'stock_status': '充足' if shortage == 0 and required_qty > 0 else ('缺料' if shortage > 0 else '無需求')
            })
        
        # 4.3 零件倉有但工單需求沒有的零件
        unused_inventory = []
        for part_number, details in inventory_dict.items():
            if part_number not in work_order_dict:
                stock_info = stock_dict.get(part_number, {'total_stock': 0, 'available_stock': 0})
                unused_inventory.append({
                    'part_number': part_number,
                    'name': details['name'],
                    'description': details['description'],
                    'unit': details['unit'],
                    'total_stock': stock_info.get('total_stock', 0),
                    'available_stock': stock_info.get('available_stock', 0),
                    'status': '零件倉有，無工單需求',
                    'action': '檢視是否為過剩庫存'
                })
        
        # 5. 計算統計資訊
        summary = {
            'work_order_parts_count': len(work_order_dict),
            'inventory_parts_count': len(inventory_dict),
            'common_parts_count': len(set(work_order_dict.keys()) & set(inventory_dict.keys())),
            'missing_in_inventory_count': len(missing_in_inventory),
            'unused_in_inventory_count': len(unused_inventory),
            'shortage_parts_count': len([item for item in inventory_with_demand if item['shortage'] > 0]),
            'sufficient_parts_count': len([item for item in inventory_with_demand if item['stock_status'] == '充足'])
        }
        
        return jsonify({
            'success': True,
            'summary': summary,
            'missing_in_inventory': sorted(missing_in_inventory, key=lambda x: x['total_required'], reverse=True),
            'inventory_with_demand': sorted(inventory_with_demand, key=lambda x: x['shortage'], reverse=True),
            'unused_inventory': sorted(unused_inventory, key=lambda x: x['total_stock'], reverse=True)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

@web_bp.route('/reports/parts-comparison/add-parts', methods=['POST'])
def add_parts_to_inventory():
    """批量新增零件至零件倉"""
    from models.part import Part
    
    try:
        data = request.get_json()
        if not data or 'parts' not in data:
            return jsonify({
                'success': False,
                'error': '請求數據格式錯誤'
            })
        
        parts = data['parts']
        if not isinstance(parts, list) or len(parts) == 0:
            return jsonify({
                'success': False,
                'error': '零件列表不能為空'
            })
        
        added_count = 0
        skipped_count = 0
        error_parts = []
        
        for part_data in parts:
            part_number = part_data.get('part_number', '').strip()
            description = part_data.get('description', '').strip()
            
            if not part_number:
                error_parts.append('零件編號不能為空')
                continue
            
            # 檢查零件是否已存在
            existing_part = Part.query.filter_by(part_number=part_number).first()
            if existing_part:
                skipped_count += 1
                continue
            
            # 創建新零件
            new_part = Part(
                part_number=part_number,
                name=description or part_number,  # 如果沒有描述，使用零件編號作為名稱
                description=description,
                unit='個',  # 預設單位
                quantity_per_box=1,  # 預設每箱數量
                safety_stock=0,  # 預設安全庫存
                reorder_point=0,  # 預設補貨點
                standard_cost=0,  # 預設成本
                is_active=True  # 預設啟用
            )
            
            try:
                db.session.add(new_part)
                db.session.flush()  # 確保取得ID
                added_count += 1
            except Exception as e:
                error_parts.append(f'{part_number}: {str(e)}')
                db.session.rollback()
                continue
        
        if added_count > 0:
            db.session.commit()
        
        # 準備回應訊息
        response_data = {
            'success': True,
            'added_count': added_count,
            'skipped_count': skipped_count,
            'message': f'成功新增 {added_count} 個零件'
        }
        
        if skipped_count > 0:
            response_data['message'] += f'，跳過 {skipped_count} 個已存在的零件'
        
        if error_parts:
            response_data['errors'] = error_parts
            response_data['message'] += f'，{len(error_parts)} 個零件新增失敗'
        
        return jsonify(response_data)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'新增零件時發生錯誤: {str(e)}'
        })

@web_bp.route('/reports/parts-comparison/add-part-detailed', methods=['POST'])
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
            safety_stock=data.get('safety_stock', 0),
            reorder_point=data.get('reorder_point', 0),
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

@web_bp.route('/inventory/stock-in', methods=['GET', 'POST'])
def stock_in():
    """入庫作業頁面"""
    if request.method == 'POST':
        part_number = request.form.get('part_number')
        warehouse_id = request.form.get('warehouse_id')
        quantity = request.form.get('quantity')
        transaction_type = request.form.get('transaction_type')
        notes = request.form.get('notes', '')
        
        # 驗證必填欄位
        if not all([part_number, warehouse_id, quantity, transaction_type]):
            flash('所有欄位都是必填的', 'error')
            return redirect(url_for('web.stock_in'))
        
        # 驗證零件
        part = Part.get_by_part_number(part_number)
        if not part:
            flash(f'找不到零件編號: {part_number}', 'error')
            return redirect(url_for('web.stock_in'))
        
        # 驗證數量
        try:
            # Ensure warehouse_id and quantity are not None before converting to int
            # Provide default empty string for .get() to avoid None
            warehouse_id_str = request.form.get('warehouse_id', '')
            quantity_str = request.form.get('quantity', '')

            warehouse_id = int(warehouse_id_str) if warehouse_id_str else None
            quantity = int(quantity_str) if quantity_str else None

            if warehouse_id is None or quantity is None or quantity <= 0:
                raise ValueError("數量必須大於0")
        except (ValueError, TypeError):
            flash('請輸入有效的數量', 'error')
            return redirect(url_for('web.stock_in'))
        
        # 執行入庫
        success = CurrentInventory.update_stock(
            part.id, warehouse_id, quantity, transaction_type,
            'MANUAL', None, notes
        )
        
        if success:
            flash(f'{part_number} 入庫 {quantity} {part.unit} 成功', 'success')
        else:
            flash('入庫作業失敗', 'error')
        
        return redirect(url_for('web.stock_in'))
    
    warehouses = Warehouse.get_all()
    # Convert Part objects to dictionaries including locations for JavaScript
    parts_list = [part.to_dict(include_locations=True) for part in Part.get_all()]
    return render_template('inventory/stock_in.html', warehouses=warehouses, parts=parts_list)

@web_bp.route('/inventory/stock-out', methods=['GET', 'POST'])
def stock_out():
    """出庫作業頁面"""
    if request.method == 'POST':
        part_number = request.form.get('part_number')
        warehouse_id = request.form.get('warehouse_id')
        quantity = request.form.get('quantity')
        transaction_type = request.form.get('transaction_type')
        work_order_id = request.form.get('work_order_id')
        notes = request.form.get('notes', '')
        
        # 驗證必填欄位
        if not all([part_number, warehouse_id, quantity, transaction_type]):
            flash('所有欄位都是必填的', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 工單領用時需要工單編號
        if transaction_type == 'OUT_WORK_ORDER' and not work_order_id:
            flash('工單領用必須選擇工單編號', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 驗證零件
        part = Part.get_by_part_number(part_number)
        if not part:
            flash(f'找不到零件編號: {part_number}', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 驗證數量
        try:
            # Ensure warehouse_id and quantity are not None before converting to int
            # Provide default empty string for .get() to avoid None
            warehouse_id_str = request.form.get('warehouse_id', '')
            quantity_str = request.form.get('quantity', '')

            warehouse_id = int(warehouse_id_str) if warehouse_id_str else None
            quantity = int(quantity_str) if quantity_str else None

            if warehouse_id is None or quantity is None or quantity <= 0:
                raise ValueError("數量必須大於0")
        except (ValueError, TypeError):
            flash('請輸入有效的數量', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 檢查庫存
        # current_stock is expected to be a dictionary or None when warehouse_id is provided
        current_stock = CurrentInventory.get_current_stock(part.id, warehouse_id)
        if not current_stock or current_stock.get('available_quantity', 0) < quantity: # Use .get with default
            available = current_stock.get('available_quantity', 0) if current_stock else 0
            flash(f'庫存不足。可用數量: {available}', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 準備備註資訊
        final_notes = notes
        if transaction_type == 'OUT_WORK_ORDER' and work_order_id:
            final_notes = f"工單領用 - 工單編號: {work_order_id}"
            if notes:
                final_notes += f"\n備註: {notes}"
        
        # 執行出庫
        success = CurrentInventory.update_stock(
            part.id, warehouse_id, -quantity, transaction_type,
            'MANUAL', None, final_notes
        )
        
        if success:
            success_msg = f'{part_number} 出庫 {quantity} {part.unit} 成功'
            if transaction_type == 'OUT_WORK_ORDER':
                success_msg += f' (工單: {work_order_id})'
            flash(success_msg, 'success')
        else:
            flash('出庫作業失敗', 'error')
        
        return redirect(url_for('web.stock_out'))
    
    warehouses = Warehouse.get_all()
    # Convert Part objects to dictionaries including locations for JavaScript
    parts_list = [part.to_dict(include_locations=True) for part in Part.get_all()]
    return render_template('inventory/stock_out.html', warehouses=warehouses, parts=parts_list)

@web_bp.route('/inventory/stock-counts')
def stock_counts():
    """盤點管理頁面"""
    counts = StockCount.get_all_counts()
    warehouses = Warehouse.get_all()
    return render_template('inventory/stock_counts.html', counts=counts, warehouses=warehouses)

@web_bp.route('/inventory/stock-counts/new')
def new_stock_count():
    """建立新盤點頁面"""
    warehouses = Warehouse.get_all()
    return render_template('inventory/new_stock_count.html', warehouses=warehouses)

@web_bp.route('/inventory/stock-counts/<int:count_id>')
def stock_count_detail(count_id):
    """盤點明細頁面"""
    count_info = StockCount.get_count_by_id(count_id)
    if not count_info:
        flash('找不到盤點記錄', 'error')
        return redirect(url_for('web.stock_counts'))
    
    details = StockCount.get_count_details(count_id)
    
    return render_template('inventory/stock_count_detail.html', 
                         count_info=count_info, 
                         details=details)

@web_bp.route('/inventory/stock-counts/<int:count_id>/edit', methods=['GET', 'POST'])
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
def pwa_test():
    """PWA 測試頁面"""
    return render_template('pwa_test.html')

@web_bp.route('/pwa-install')
def pwa_install():
    """PWA 快速安裝頁面"""
    return render_template('pwa_install.html')

@web_bp.route('/camera-test')
def camera_test():
    """相機和條碼掃描測試頁面"""
    return render_template('camera_test.html')

# ==================== 倉位管理 ====================

@web_bp.route('/warehouse-locations')
def warehouse_locations():
    """倉位管理頁面"""
    from models.part import WarehouseLocation
    from extensions import db
    
    warehouses = Warehouse.get_all()
    
    # 取得所有倉位，並附帶倉庫資訊
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
def add_warehouse_location():
    """新增倉位"""
    from models.part import WarehouseLocation
    from extensions import db
    
    warehouse_id = request.form.get('warehouse_id')
    location_code = request.form.get('location_code')
    description = request.form.get('description', '')
    
    # Ensure warehouse_id and location_code are not None
    # Provide default empty string for .get() to avoid None
    warehouse_id_str = request.form.get('warehouse_id', '')
    location_code = request.form.get('location_code', '')
    description = request.form.get('description', '')
    
    if not warehouse_id_str or not location_code:
        flash('倉庫和位置代碼為必填項目', 'error')
        return redirect(url_for('web.warehouse_locations'))
    
    try:
        # Ensure warehouse_id is an integer
        warehouse_id_int = int(warehouse_id_str)
        
        # 檢查是否已存在相同的倉位
        existing = WarehouseLocation.query.filter_by(
            warehouse_id=warehouse_id_int,
            location_code=location_code
        ).first()
        
        if existing:
            flash('該倉位已存在', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        # 建立新倉位
        new_location = WarehouseLocation(
            warehouse_id_int, # Positional argument
            location_code,    # Positional argument
            description=description
        )
        db.session.add(new_location)
        db.session.commit()
        
        flash('倉位新增成功', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'倉位新增失敗: {str(e)}', 'error')
    
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouse-locations/<int:location_id>/edit', methods=['POST'])
def edit_warehouse_location(location_id):
    """編輯倉位"""
    from models.part import WarehouseLocation
    from extensions import db
    
    location_code = request.form.get('location_code')
    description = request.form.get('description', '')
    
    if not location_code:
        flash('位置代碼為必填項目', 'error')
        return redirect(url_for('web.warehouse_locations'))
    
    try:
        location = WarehouseLocation.query.get(location_id)
        if not location:
            flash('找不到該倉位', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        # 檢查是否有重複的倉位代碼（排除自己）
        existing = WarehouseLocation.query.filter(
            WarehouseLocation.warehouse_id == location.warehouse_id,
            WarehouseLocation.location_code == location_code,
            WarehouseLocation.id != location_id
        ).first()
        
        if existing:
            flash('該倉位代碼已存在於此倉庫', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        location.location_code = location_code
        location.description = description
        db.session.commit()
        
        flash('倉位更新成功', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'倉位更新失敗: {str(e)}', 'error')
    
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouse-locations/<int:location_id>/delete', methods=['POST'])
def delete_warehouse_location(location_id):
    """刪除倉位"""
    from models.part import WarehouseLocation, PartWarehouseLocation, Part
    from extensions import db
    
    try:
        location = WarehouseLocation.query.get(location_id)
        if not location:
            flash('找不到該倉位', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        # 檢查是否有零件使用此倉位
        parts_using_assoc = PartWarehouseLocation.query.filter_by(
            warehouse_location_id=location_id
        ).all()
        
        if parts_using_assoc:
            # 獲取使用此倉位的零件清單
            part_list = []
            for assoc in parts_using_assoc:
                part = Part.query.get(assoc.part_id)
                if part:
                    part_list.append(f"{part.part_number} - {part.name}")
            
            # 限制顯示前5個零件
            if len(part_list) <= 5:
                parts_info = '、'.join(part_list)
            else:
                parts_info = '、'.join(part_list[:5]) + f' 等 {len(part_list)} 個零件'
            
            flash(f'無法刪除：此倉位被以下零件使用中：{parts_info}', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        db.session.delete(location)
        db.session.commit()
        
        flash('倉位刪除成功', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'倉位刪除失敗: {str(e)}', 'error')
    
    return redirect(url_for('web.warehouse_locations'))

# ==================== 倉庫管理 ====================

@web_bp.route('/warehouses/add', methods=['POST'])
def add_warehouse():
    """新增倉庫"""
    from extensions import db
    
    # Provide default empty string for .get() to avoid None
    code = request.form.get('code', '')
    name = request.form.get('name', '')
    description = request.form.get('description', '')
    
    if not code or not name:
        flash('倉庫編號和名稱為必填項目', 'error')
        return redirect(url_for('web.warehouse_locations'))
    
    try:
        # 檢查倉庫編號是否已存在
        existing = Warehouse.query.filter_by(code=code).first()
        if existing:
            flash('倉庫編號已存在', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        new_warehouse = Warehouse(
            code, # Positional argument
            name, # Positional argument
            description=description,
            is_active=True
        )
        db.session.add(new_warehouse)
        db.session.commit()
        
        flash('倉庫新增成功', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'倉庫新增失敗: {str(e)}', 'error')
    
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouses/<int:warehouse_id>/edit', methods=['POST'])
def edit_warehouse(warehouse_id):
    """編輯倉庫"""
    from extensions import db
    
    name = request.form.get('name')
    description = request.form.get('description', '')
    
    if not name:
        flash('倉庫名稱為必填項目', 'error')
        return redirect(url_for('web.warehouse_locations'))
    
    try:
        warehouse = Warehouse.query.get(warehouse_id)
        if not warehouse:
            flash('找不到該倉庫', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        warehouse.name = name
        warehouse.description = description
        db.session.commit()
        
        flash('倉庫更新成功', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'倉庫更新失敗: {str(e)}', 'error')
    
    return redirect(url_for('web.warehouse_locations'))

@web_bp.route('/warehouses/<int:warehouse_id>/delete', methods=['POST'])
def delete_warehouse(warehouse_id):
    """刪除倉庫"""
    from extensions import db
    from models.part import WarehouseLocation
    
    try:
        warehouse = Warehouse.query.get(warehouse_id)
        if not warehouse:
            flash('找不到該倉庫', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        # 檢查是否有倉位使用此倉庫
        locations_count = WarehouseLocation.query.filter_by(
            warehouse_id=warehouse_id
        ).count()
        
        if locations_count > 0:
            flash(f'無法刪除：此倉庫有 {locations_count} 個倉位，請先刪除所有倉位', 'error')
            return redirect(url_for('web.warehouse_locations'))
        
        db.session.delete(warehouse)
        db.session.commit()
        
        flash('倉庫刪除成功', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'倉庫刪除失敗: {str(e)}', 'error')
    
    return redirect(url_for('web.warehouse_locations'))
