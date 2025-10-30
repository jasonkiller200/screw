from flask import Blueprint, jsonify, request, send_file, Response
from models.part import Part, Warehouse
from models.order import Order
from models.inventory import CurrentInventory # Import CurrentInventory
from extensions import db # Import db
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from urllib.parse import quote

api_bp = Blueprint('api', __name__, url_prefix='/api')

@api_bp.route('/inventory/stock/export', methods=['GET'])
def export_inventory_stock():
    """匯出庫存數據為 Excel 檔案"""
    warehouse_id = request.args.get('warehouse_id', type=int)
    
    inventories = CurrentInventory.get_detailed_inventory_view(warehouse_id)
    
    export_data = []
    for item in inventories:
        export_data.append({
            '零件編號': item['part_number'],
            '零件名稱': item['part_name'],
            '儲位': f"{item['warehouse_name']} - {item['location_code']}",
            '現有庫存': item['quantity_on_hand'],
            '可用庫存': item['available_quantity'],
            '安全庫存': item['safety_stock'],
            '補貨點': item['reorder_point'],
            '單位': item['unit'],
        })
    
    df = pd.DataFrame(export_data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='庫存數據', index=False)
        
        # 自動調整欄寬
        worksheet = writer.sheets['庫存數據']
        for column in worksheet.columns:
            max_length = 0
            column_name = column[0].value # Get column header
            # Check length of header
            if column_name:
                max_length = max(max_length, len(str(column_name)))
            
            # Check length of data in column
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2) # Add a little extra space
            worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
    output.seek(0)
    
    filename = f"庫存數據_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )

@api_bp.route('/inventory/low-stock/export', methods=['GET'])
def export_low_stock_items():
    """匯出低庫存項目為 Excel 檔案"""
    warehouse_id = request.args.get('warehouse_id', type=int)
    
    low_stock_items = CurrentInventory.get_low_stock_items(warehouse_id)
    
    export_data = []
    for item in low_stock_items:
        export_data.append({
            '零件編號': item['part_number'],
            '零件名稱': item['part_name'],
            '儲位': f"{item['warehouse_name']} - {item['location_code']}", # Assuming location_code is available in low_stock_items
            '現有庫存': item['quantity_on_hand'],
            '可用庫存': item['available_quantity'],
            '安全庫存': item['safety_stock'],
            '補貨點': item['reorder_point'],
            '單位': item['unit'],
        })
    
    df = pd.DataFrame(export_data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='低庫存項目', index=False)
        
        # 自動調整欄寬
        worksheet = writer.sheets['低庫存項目']
        for column in worksheet.columns:
            max_length = 0
            column_name = column[0].value # Get column header
            # Check length of header
            if column_name:
                max_length = max(max_length, len(str(column_name)))
            
            # Check length of data in column
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = (max_length + 2) # Add a little extra space
            worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
    output.seek(0)
    
    filename = f"低庫存項目_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )

@api_bp.route('/part/<string:part_number>', methods=['GET'])
def get_part_details(part_number):
    """
    Fetches part details and its order history from the database.
    The part_number is the value scanned from the barcode.
    """
    from models.inventory import CurrentInventory
    
    # Find the part by its part_number
    part = Part.get_by_part_number(part_number)
    
    if part is None:
        return jsonify({'error': '找不到零件'}), 404
        
    # Fetch order history for the found part - 確保返回字典列表
    order_history = Order.get_history_by_part_number(part_number)
    order_history_data = [order.to_dict() for order in order_history] if order_history else []
    
    # Fetch inventory for the part from all warehouses by calling the correct to_dict() method
    inventories = CurrentInventory.query.filter_by(part_id=part.id).all()
    inventory_data = [inv.to_dict() for inv in inventories]
    
    # Combine the results into a single JSON response
    result = {
        'part_info': part.to_dict(include_locations=True), # Convert Part object to dictionary and include locations
        'order_history': order_history_data,
        'inventories': inventory_data
    }
    
    return jsonify(result)

@api_bp.route('/part/<string:part_number>/locations', methods=['GET'])
def get_part_locations(part_number):
    """
    Fetches all warehouse locations associated with a given part number.
    """
    part = Part.get_by_part_number(part_number)

    if part is None:
        return jsonify({'error': '找不到零件'}), 404

    locations_data = []
    for assoc in part.location_associations:
        locations_data.append({
            'id': assoc.warehouse_location.id,
            'location_code': assoc.warehouse_location.location_code,
            'warehouse_name': assoc.warehouse_location.warehouse.name
        })

    return jsonify({'locations': locations_data})

@api_bp.route('/order', methods=['POST'])
def place_order():
    """
    Places a new order for a given part number and quantity.
    Expects a JSON body with 'part_number', 'quantity_ordered', and optionally 'location_code'.
    """
    data = request.get_json()
    part_number = data.get('part_number')
    quantity_ordered = data.get('quantity_ordered')
    location_code = data.get('location_code')

    if not part_number or not quantity_ordered:
        return jsonify({'error': 'Missing part_number or quantity_ordered'}), 400

    try:
        quantity_ordered = int(quantity_ordered)
        if quantity_ordered <= 0:
            raise ValueError("Quantity must be positive")
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid quantity_ordered. Must be a positive integer.'}), 400

    # Check if part exists
    if not Part.exists(part_number):
        return jsonify({'error': 'Part not found'}), 404

    # Create the order with location_code
    success = Order.create(part_number, quantity_ordered, location_code=location_code)
    
    if success:
        return jsonify({'success': True, 'message': f'Order for {part_number} placed successfully.'}), 201
    else:
        return jsonify({'error': 'Failed to place order'}), 500

@api_bp.route('/pending_orders', methods=['GET'])
def get_pending_orders():
    """Get all pending orders for management interface."""
    orders = Order.get_pending_orders()
    return jsonify(orders)

@api_bp.route('/all_orders', methods=['GET'])
def get_all_orders():
    """Get all orders for management interface."""
    orders = Order.get_all_orders()
    return jsonify(orders)

@api_bp.route('/confirm_orders', methods=['POST'])
def confirm_orders():
    """Confirm multiple orders by updating their status."""
    data = request.get_json()
    order_ids = data.get('order_ids', [])
    
    if not order_ids:
        return jsonify({'error': 'No order IDs provided'}), 400
    
    success = Order.confirm_orders(order_ids)
    
    if success:
        return jsonify({'success': True, 'message': f'Confirmed {len(order_ids)} orders'}), 200
    else:
        return jsonify({'error': 'Failed to confirm orders'}), 500

@api_bp.route('/parts', methods=['GET'])
def get_all_parts():
    """Get all parts for management interface."""
    parts = Part.get_all()
    return jsonify(parts)

@api_bp.route('/warehouses', methods=['GET'])
def get_warehouses():
    """Gets a list of all active warehouses."""
    warehouses = Warehouse.get_all() # This already returns a list of dicts
    return jsonify(warehouses)

@api_bp.route('/parts/autocomplete', methods=['GET'])
def parts_autocomplete():
    """Provides autocomplete suggestions for part numbers and names."""
    from sqlalchemy import or_
    query = request.args.get('q', '').strip()
    if not query or len(query) < 1: # 至少需要1個字元才觸發搜尋
        return jsonify([])

    parts = Part.query.filter(
        or_(
            Part.part_number.ilike(f'%{query}%'),
            Part.name.ilike(f'%{query}%')
        )
    ).limit(10).all()

    results = [{'part_number': part.part_number, 'name': part.name} for part in parts]
    return jsonify(results)

@api_bp.route('/parts/search', methods=['GET'])
def search_parts():
    """Searches for parts by part_number or name."""
    query = request.args.get('q', '')
    parts = Part.get_all(search_term=query)
    return jsonify({'parts': [part.to_dict() for part in parts]})

@api_bp.route('/parts', methods=['POST'])
def create_part():
    """Create a new part."""
    data = request.get_json()
    
    required_fields = ['part_number', 'name', 'description', 'unit', 'quantity_per_box', 'storage_location']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    success = Part.create(
        data['part_number'],
        data['name'],
        data['description'],
        data['unit'],
        data['quantity_per_box'],
        data['storage_location']
    )
    
    if success:
        return jsonify({'success': True, 'message': 'Part created successfully'}), 201
    else:
        return jsonify({'error': 'Part number already exists'}), 400

@api_bp.route('/parts/<int:part_id>', methods=['PUT'])
def update_part(part_id):
    """Update an existing part."""
    data = request.get_json()
    
    required_fields = ['part_number', 'name', 'description', 'unit', 'quantity_per_box', 'storage_location']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    success = Part.update(
        part_id,
        data['part_number'],
        data['name'],
        data['description'],
        data['unit'],
        data['quantity_per_box'],
        data['storage_location']
    )
    
    if success:
        return jsonify({'success': True, 'message': 'Part updated successfully'}), 200
    else:
        return jsonify({'error': 'Part not found'}), 404

@api_bp.route('/parts/<int:part_id>', methods=['DELETE'])
def delete_part(part_id):
    """Delete a part."""
    success = Part.delete(part_id)
    
    if success:
        return jsonify({'success': True, 'message': 'Part deleted successfully'}), 200
    else:
        return jsonify({'error': 'Part not found'}), 404

# ============ 工單管理 API ============

@api_bp.route('/work-orders', methods=['GET'])
def get_work_orders():
    """獲取工單需求列表"""
    from models.work_order import WorkOrderDemand
    
    # 獲取查詢參數
    order_id = request.args.get('order_id')
    part_number = request.args.get('part_number')
    
    # 建立查詢
    query = WorkOrderDemand.query
    
    if order_id:
        query = query.filter(WorkOrderDemand.order_id.like(f'%{order_id}%'))
    
    if part_number:
        query = query.filter(WorkOrderDemand.part_number.like(f'%{part_number}%'))
    
    # 執行查詢並排序
    demands = query.order_by(WorkOrderDemand.order_id, WorkOrderDemand.part_number).all()
    
    # 轉換為字典格式
    result = {
        'demands': [demand.to_dict() for demand in demands],
        'total_count': len(demands)
    }
    
    return jsonify(result)

@api_bp.route('/work-orders/<string:order_id>', methods=['GET'])
def get_work_order_by_id(order_id):
    """依訂單編號獲取工單需求"""
    from models.work_order import WorkOrderDemand
    
    demands = WorkOrderDemand.get_by_order(order_id)
    
    if not demands:
        return jsonify({'error': '找不到該訂單的工單需求'}), 404
    
    result = {
        'order_id': order_id,
        'demands': [demand.to_dict() for demand in demands],
        'total_items': len(demands),
        'total_quantity': sum(demand.required_quantity for demand in demands)
    }
    
    return jsonify(result)

@api_bp.route('/work-orders/orders', methods=['GET'])
def get_all_work_order_numbers():
    """獲取所有工單編號"""
    from models.work_order import WorkOrderDemand
    
    orders = [row[0] for row in WorkOrderDemand.get_all_orders()]
    
    return jsonify({
        'orders': orders,
        'count': len(orders)
    })

@api_bp.route('/work-orders/search/part/<string:part_number>', methods=['GET'])
def search_work_orders_by_part(part_number):
    """依物料編號搜尋工單需求"""
    from models.work_order import WorkOrderDemand
    
    demands = WorkOrderDemand.search_by_part(part_number)
    
    result = {
        'part_number': part_number,
        'demands': [demand.to_dict() for demand in demands],
        'total_count': len(demands)
    }
    
    return jsonify(result)

@api_bp.route('/inventory/transactions/export', methods=['GET'])
def export_inventory_transactions():
    """匯出庫存異動記錄為 Excel 檔案"""
    from models.inventory import InventoryTransaction
    from datetime import datetime, timedelta
    import pandas as pd
    from io import BytesIO
    from flask import send_file
    
    # 取得篩選參數
    part_id = request.args.get('part_id', type=int)
    warehouse_id = request.args.get('warehouse_id', type=int)
    transaction_type = request.args.get('transaction_type')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    # 如果沒有指定日期範圍，預設為最近30天
    if not date_from and not date_to:
        today = datetime.now()
        thirty_days_ago = today - timedelta(days=30)
        date_from = thirty_days_ago.strftime('%Y-%m-%d')
        date_to = today.strftime('%Y-%m-%d')
    
    # 建立查詢
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
            to_date = to_date.replace(hour=23, minute=59, second=59)
            transactions_query = transactions_query.filter(InventoryTransaction.transaction_date <= to_date)
        except ValueError:
            pass
    
    # 取得所有符合條件的交易記錄
    transactions = transactions_query.order_by(
        InventoryTransaction.transaction_date.desc(),
        InventoryTransaction.id.desc()
    ).all()
    
    # 準備匯出資料
    export_data = []
    for transaction in transactions:
        export_data.append({
            '異動時間': transaction.transaction_date.strftime('%Y-%m-%d %H:%M:%S'),
            '異動類型': transaction.transaction_type,
            '零件編號': transaction.part.part_number if transaction.part else 'N/A',
            '零件名稱': transaction.part.name if transaction.part else 'N/A',
            '倉庫': transaction.warehouse.name if transaction.warehouse else 'N/A',
            '數量變化': transaction.quantity,
            '參考類型': transaction.reference_type or '',
            '參考編號': transaction.reference_id or '',
            '備註': transaction.notes or ''
        })
    
    # 建立 DataFrame 並匯出為 Excel
    df = pd.DataFrame(export_data)
    
    # 建立 Excel 檔案
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='庫存異動記錄', index=False)
    output.seek(0)
    
    # 產生檔案名稱
    filename = f"庫存異動記錄_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )

@api_bp.route('/parts/<int:part_id>/update_inventory_policy', methods=['POST'])
# @login_required
def update_inventory_policy(part_id):
    data = request.get_json()
    warehouse_id = data.get('warehouse_id')
    safety_stock = data.get('safety_stock')
    reorder_point = data.get('reorder_point')

    if not all([warehouse_id, safety_stock is not None, reorder_point is not None]):
        return jsonify({'error': 'Missing warehouse_id, safety_stock or reorder_point'}), 400

    current_inventory = CurrentInventory.query.filter_by(part_id=part_id, warehouse_id=warehouse_id).first()

    if not current_inventory:
        # If no existing inventory record, create one with default quantities
        current_inventory = CurrentInventory(
            part_id=part_id,
            warehouse_id=warehouse_id,
            quantity_on_hand=0,
            reserved_quantity=0,
            available_quantity=0,
            safety_stock=safety_stock,
            reorder_point=reorder_point
        )
        db.session.add(current_inventory)
    else:
        current_inventory.safety_stock = safety_stock
        current_inventory.reorder_point = reorder_point
    
    try:
        db.session.commit()
        return jsonify({'success': True, 'message': 'Inventory policy updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/parts/export', methods=['GET'])
def export_parts():
    """匯出零件清單為 Excel 檔案"""
    from sqlalchemy import or_, func
    from models.part import PartWarehouseLocation, WarehouseLocation, Warehouse

    search = request.args.get('search', '')
    sort_by = request.args.get('sort_by', 'part_number')
    sort_order = request.args.get('sort_order', 'asc')

    # --- Replicate query logic from Part.get_all ---
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
    # --- End of replicated logic ---

    # Fetch ALL parts matching the criteria
    parts = query.all()

    # Create Excel workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "零件清單"

    # Define styles
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4F81BD", end_color="4F81BD", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    # Write headers
    headers = ['零件編號', '名稱', '類型', '備註', '單位', '每盒數量', '採購前置期 (天)', '儲存位置']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num)
        cell.value = header
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = border

    # Write data rows
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

    # Auto-fit columns
    for col_num, column_cells in enumerate(ws.columns, 1):
        max_length = 0
        column_letter = get_column_letter(col_num)
        # Check header length
        max_length = len(str(ws.cell(row=1, column=col_num).value))
        for cell in column_cells:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Save to memory
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    # Create response
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"零件清單_{timestamp}.xlsx"
    encoded_filename = quote(filename)

    return Response(
        output.getvalue(),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )

