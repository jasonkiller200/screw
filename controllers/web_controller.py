from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from models.part import Part
from models.order import Order
from models.inventory import Warehouse, Inventory, Transaction, StockCount

web_bp = Blueprint('web', __name__)

@web_bp.route('/')
def index():
    """Main dashboard page."""
    return render_template('index.html')

@web_bp.route('/parts')
def parts():
    """Parts management page."""
    parts_list = Part.get_all()
    return render_template('parts.html', parts=parts_list)

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
    if request.method == 'POST':
        part_number = request.form.get('part_number')
        name = request.form.get('name')
        description = request.form.get('description')
        unit = request.form.get('unit')
        quantity_per_box = request.form.get('quantity_per_box')
        storage_location = request.form.get('storage_location')
        
        if not all([part_number, name, description, unit, quantity_per_box, storage_location]):
            flash('所有欄位都是必填的', 'error')
            return render_template('part_form.html')
        
        try:
            quantity_per_box = int(quantity_per_box)
        except ValueError:
            flash('每盒數量必須是數字', 'error')
            return render_template('part_form.html')
        
        success = Part.create(part_number, name, description, unit, quantity_per_box, storage_location)
        
        if success:
            flash('零件新增成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            flash('零件編號已存在', 'error')
    
    return render_template('part_form.html')

@web_bp.route('/parts/<int:part_id>/edit', methods=['GET', 'POST'])
def edit_part(part_id):
    """Edit part page."""
    if request.method == 'POST':
        part_number = request.form.get('part_number')
        name = request.form.get('name')
        description = request.form.get('description')
        unit = request.form.get('unit')
        quantity_per_box = request.form.get('quantity_per_box')
        storage_location = request.form.get('storage_location')
        
        if not all([part_number, name, description, unit, quantity_per_box, storage_location]):
            flash('所有欄位都是必填的', 'error')
            return redirect(url_for('web.edit_part', part_id=part_id))
        
        try:
            quantity_per_box = int(quantity_per_box)
        except ValueError:
            flash('每盒數量必須是數字', 'error')
            return redirect(url_for('web.edit_part', part_id=part_id))
        
        success = Part.update(part_id, part_number, name, description, unit, quantity_per_box, storage_location)
        
        if success:
            flash('零件更新成功', 'success')
            return redirect(url_for('web.parts'))
        else:
            flash('零件更新失敗', 'error')
    
    # Get existing part data for the form
    parts_list = Part.get_all()
    part = next((p for p in parts_list if p['id'] == part_id), None)
    
    if not part:
        flash('找不到零件', 'error')
        return redirect(url_for('web.parts'))
    
    return render_template('part_form.html', part=part, edit_mode=True)

@web_bp.route('/parts/<int:part_id>/delete', methods=['POST'])
def delete_part(part_id):
    """Delete part."""
    success = Part.delete(part_id)
    
    if success:
        flash('零件刪除成功', 'success')
    else:
        flash('零件刪除失敗', 'error')
    
    return redirect(url_for('web.parts'))

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
            flash(f'{part_number} 出庫 {quantity} {part["unit"]} 成功', 'success')
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