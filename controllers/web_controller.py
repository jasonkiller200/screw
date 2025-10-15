from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_file
from models.part import Part
from models.order import Order
from models.inventory import Warehouse, Inventory, Transaction, StockCount
import os
import pandas as pd
from werkzeug.utils import secure_filename
from io import BytesIO

web_bp = Blueprint('web', __name__)

@web_bp.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

@web_bp.route('/parts')
def parts():
    """Parts management page."""
    search_term = request.args.get('search', '')
    sort_by = request.args.get('sort_by', 'part_number')
    sort_order = request.args.get('sort_order', 'asc')
    
    parts_list = Part.get_all(search_term=search_term, sort_by=sort_by, sort_order=sort_order)
    
    return render_template('parts.html', 
                           parts=parts_list, 
                           search_term=search_term,
                           sort_by=sort_by,
                           sort_order=sort_order)

@web_bp.route('/orders')
def orders():
    """Orders management page."""
    pending_orders = Order.get_pending_orders()
    all_orders = Order.get_all_orders()
    return render_template('orders.html', pending_orders=pending_orders, all_orders=all_orders)

@web_bp.route('/part_lookup')
def part_lookup():
    """Part lookup page for barcode scanning."""
    return render_template('part_lookup.html')

@web_bp.route('/parts/new', methods=['GET', 'POST'])
def new_part():
    """Create new part page."""
    part_data = {}
    warehouses = Part.get_all_warehouses() # Get all warehouses for dropdown

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
            if wh_id and loc_code:
                locations_data.append({'warehouse_id': int(wh_id), 'location_code': loc_code})

        if not all([part_number, name, description, unit, quantity_per_box]) or not locations_data:
            flash('所有欄位都是必填的，且至少需要一個儲存位置', 'error')
            # If there's an error, re-render the form with the submitted data
            part_data = {
                'part_number': part_number,
                'name': name,
                'description': description,
                'unit': unit,
                'quantity_per_box': quantity_per_box,
                'locations': locations_data # Pass back the structured locations data
            }
            return render_template('part_form.html', part=part_data, warehouses=warehouses)
        
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
        
        success = Part.create(part_number, name, description, unit, quantity_per_box, locations_data)
        
        if success:
            flash('零件新增成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            flash('零件編號已存在', 'error')
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
    warehouses = Part.get_all_warehouses() # Get all warehouses for dropdown

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
            if wh_id and loc_code:
                locations_data.append({'warehouse_id': int(wh_id), 'location_code': loc_code})

        if not all([part_number, name, description, unit, quantity_per_box]) or not locations_data:
            flash('所有欄位都是必填的，且至少需要一個儲存位置', 'error')
            return redirect(url_for('web.edit_part', part_id=part_id))
        
        try:
            quantity_per_box = int(quantity_per_box)
        except ValueError:
            flash('每盒數量必須是數字', 'error')
            return redirect(url_for('web.edit_part', part_id=part_id))
        
        success = Part.update(part_id, part_number, name, description, unit, quantity_per_box, locations_data)
        
        if success:
            flash('零件更新成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            flash('零件更新失敗', 'error')
    
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

    if file and file.filename.endswith('.xlsx'):
        try:
            df = pd.read_excel(file)
            
            column_map = {
                '零件編號': 'part_number',
                '名稱': 'name',
                '描述': 'description',
                '單位': 'unit',
                '每盒數量': 'quantity_per_box',
                '儲存位置(倉別代碼:位置代碼, 逗號分隔)': 'locations_str' # New column for locations
            }

            if not all(col in df.columns for col in column_map.keys()):
                flash(f'Excel 文件缺少必要的欄位。需要: {", ".join(column_map.keys())}', 'error')
                return redirect(url_for('web.parts'))

            df.rename(columns=column_map, inplace=True)

            imported_count = 0
            skipped_count = 0
            
            for index, row in df.iterrows():
                # Basic validation
                if pd.isna(row.get('part_number')) or pd.isna(row.get('name')) or pd.isna(row.get('unit')) or pd.isna(row.get('locations_str')):
                    skipped_count += 1
                    continue

                try:
                    quantity_per_box = int(row['quantity_per_box'])
                except (ValueError, TypeError):
                    quantity_per_box = 1
                
                # Parse locations string into list of dicts
                locations_str = str(row['locations_str'])
                locations_data = []
                for loc_pair_str in locations_str.split(','):
                    parts = [p.strip() for p in loc_pair_str.split(':') if p.strip()]
                    if len(parts) == 2:
                        warehouse_code = parts[0]
                        location_code = parts[1]
                        # Look up warehouse_id from code
                        warehouse = Part.get_warehouse_by_code(warehouse_code)
                        if warehouse:
                            locations_data.append({'warehouse_id': warehouse['id'], 'location_code': location_code})
                        else:
                            flash(f'匯入失敗: 找不到倉別代碼 {warehouse_code}', 'error')
                            skipped_count += 1
                            continue
                    elif parts:
                        flash(f'匯入失敗: 儲存位置格式錯誤 {loc_pair_str}，應為 倉別代碼:位置代碼', 'error')
                        skipped_count += 1
                        continue
                
                if not locations_data:
                    skipped_count += 1
                    continue

                if not Part.exists(row['part_number']):
                    Part.create(
                        part_number=row['part_number'],
                        name=row['name'],
                        description=row.get('description', ''),
                        unit=row['unit'],
                        quantity_per_box=quantity_per_box,
                        locations_data=locations_data # Pass list of locations data
                    )
                    imported_count += 1
                else:
                    flash(f"匯入失敗: 零件編號 {row['part_number']} 已存在", 'error')
                    skipped_count += 1
            
            flash(f'成功匯入 {imported_count} 個新零件。跳過 {skipped_count} 個已存在或資料不完整的零件。', 'success')

        except Exception as e:
            flash(f'處理檔案時發生錯誤: {e}', 'error')
        
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
    inventories = Inventory.get_all_inventory(warehouse_id)
    low_stock_items = Inventory.get_low_stock_items(warehouse_id)
    
    return render_template('inventory/index.html', 
                         warehouses=warehouses, 
                         inventories=inventories,
                         low_stock_items=low_stock_items,
                         selected_warehouse_id=warehouse_id)

@web_bp.route('/inventory/transactions')
def inventory_transactions():
    """交易記錄頁面"""
    part_id = request.args.get('part_id', type=int)
    warehouse_id = request.args.get('warehouse_id', type=int)
    warehouses = Warehouse.get_all()
    parts = Part.get_all()
    transactions = Transaction.get_transactions(part_id, warehouse_id, 200)
    
    return render_template('inventory/transactions.html',
                         warehouses=warehouses,
                         parts=parts,
                         transactions=transactions,
                         selected_part_id=part_id,
                         selected_warehouse_id=warehouse_id)

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
            quantity = int(quantity)
            warehouse_id = int(warehouse_id)
            if quantity <= 0:
                raise ValueError("數量必須大於0")
        except (ValueError, TypeError):
            flash('請輸入有效的數量', 'error')
            return redirect(url_for('web.stock_in'))
        
        # 執行入庫
        success = Inventory.update_stock(
            part['id'], warehouse_id, quantity, transaction_type,
            'MANUAL', None, notes
        )
        
        if success:
            flash(f'{part_number} 入庫 {quantity} {part["unit"]} 成功', 'success')
        else:
            flash('入庫作業失敗', 'error')
        
        return redirect(url_for('web.stock_in'))
    
    warehouses = Warehouse.get_all()
    parts = Part.get_all()
    return render_template('inventory/stock_in.html', warehouses=warehouses, parts=parts)

@web_bp.route('/inventory/stock-out', methods=['GET', 'POST'])
def stock_out():
    """出庫作業頁面"""
    if request.method == 'POST':
        part_number = request.form.get('part_number')
        warehouse_id = request.form.get('warehouse_id')
        quantity = request.form.get('quantity')
        transaction_type = request.form.get('transaction_type')
        notes = request.form.get('notes', '')
        
        # 驗證必填欄位
        if not all([part_number, warehouse_id, quantity, transaction_type]):
            flash('所有欄位都是必填的', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 驗證零件
        part = Part.get_by_part_number(part_number)
        if not part:
            flash(f'找不到零件編號: {part_number}', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 驗證數量
        try:
            quantity = int(quantity)
            warehouse_id = int(warehouse_id)
            if quantity <= 0:
                raise ValueError("數量必須大於0")
        except (ValueError, TypeError):
            flash('請輸入有效的數量', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 檢查庫存
        current_stock = Inventory.get_current_stock(part['id'], warehouse_id)
        if not current_stock or current_stock['available_quantity'] < quantity:
            available = current_stock['available_quantity'] if current_stock else 0
            flash(f'庫存不足。可用數量: {available}', 'error')
            return redirect(url_for('web.stock_out'))
        
        # 執行出庫
        success = Inventory.update_stock(
            part['id'], warehouse_id, -quantity, transaction_type,
            'MANUAL', None, notes
        )
        
        if success:
            flash(f'{part_number} 出庫 {quantity} {part["unit']} 成功', 'success')
        else:
            flash('出庫作業失敗', 'error')
        
        return redirect(url_for('web.stock_out'))
    
    warehouses = Warehouse.get_all()
    parts = Part.get_all()
    return render_template('inventory/stock_out.html', warehouses=warehouses, parts=parts)

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