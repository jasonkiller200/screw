from flask import Blueprint, jsonify, request
from models.part import Part, Warehouse
from models.order import Order

api_bp = Blueprint('api', __name__, url_prefix='/api')

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
    
    # Fetch inventory for the part from all warehouses
    inventories = CurrentInventory.query.filter_by(part_id=part.id).all()
    inventory_data = []
    for inv in inventories:
        inventory_data.append({
            'warehouse_id': inv.warehouse_id,
            'warehouse_name': inv.warehouse.name if inv.warehouse else '未知',
            'warehouse_code': inv.warehouse.code if inv.warehouse else '未知',
            'quantity_on_hand': inv.quantity_on_hand,
            'reserved_quantity': inv.reserved_quantity,
            'available_quantity': inv.available_quantity
        })
    
    # Combine the results into a single JSON response
    result = {
        'part_info': part.to_dict(include_locations=True), # Convert Part object to dictionary and include locations
        'order_history': order_history_data,
        'inventories': inventory_data
    }
    
    return jsonify(result)

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
