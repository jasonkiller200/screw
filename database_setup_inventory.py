import sqlite3
import random
import string
from datetime import datetime, timedelta

def generate_random_string(length=8):
    """Generate a random string of fixed length."""
    letters_and_digits = string.ascii_uppercase + string.digits
    return ''.join(random.choice(letters_and_digits) for i in range(length))

def setup_inventory_database():
    """Create complete inventory management database with in/out transactions and stock counting."""
    db_name = 'hardware.db'
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Drop existing tables
    cursor.execute('DROP TABLE IF EXISTS stock_count_details')
    cursor.execute('DROP TABLE IF EXISTS stock_counts')
    cursor.execute('DROP TABLE IF EXISTS inventory_transactions')
    cursor.execute('DROP TABLE IF EXISTS current_inventory')
    cursor.execute('DROP TABLE IF EXISTS part_locations') # New table
    cursor.execute('DROP TABLE IF EXISTS warehouse_locations') # New table
    cursor.execute('DROP TABLE IF EXISTS warehouses')
    cursor.execute('DROP TABLE IF EXISTS order_history')
    cursor.execute('DROP TABLE IF EXISTS parts')

    # Create warehouses table (倉庫/倉別管理)
    cursor.execute('''
    CREATE TABLE warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Create warehouse_locations table
    cursor.execute('''
    CREATE TABLE warehouse_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        warehouse_id INTEGER NOT NULL,
        location_code TEXT NOT NULL,
        description TEXT,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE CASCADE,
        UNIQUE(warehouse_id, location_code)
    )
    ''')

    # Create enhanced parts table (without storage_location)
    cursor.execute('''
    CREATE TABLE parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT '個',
        quantity_per_box INTEGER NOT NULL,
        safety_stock INTEGER DEFAULT 0,
        reorder_point INTEGER DEFAULT 0,
        standard_cost DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Create part_locations table (linking parts to specific warehouse locations)
    cursor.execute('''
    CREATE TABLE part_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        warehouse_location_id INTEGER NOT NULL,
        FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE CASCADE,
        FOREIGN KEY (warehouse_location_id) REFERENCES warehouse_locations (id) ON DELETE CASCADE,
        UNIQUE(part_id, warehouse_location_id)
    )
    ''')

    # Create current inventory table (即時庫存)
    cursor.execute('''
    CREATE TABLE current_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        quantity_on_hand INTEGER DEFAULT 0,
        reserved_quantity INTEGER DEFAULT 0,
        available_quantity INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (part_id) REFERENCES parts (id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses (id),
        UNIQUE(part_id, warehouse_id)
    )
    ''')

    # Create inventory transactions table (入出庫交易記錄)
    cursor.execute('''
    CREATE TABLE inventory_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        warehouse_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL, -- 'IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'OUT_ISSUE', 'OUT_TRANSFER', 'OUT_SCRAP', 'ADJUST'
        quantity INTEGER NOT NULL,
        unit_cost DECIMAL(10,2) DEFAULT 0,
        reference_type TEXT, -- 'ORDER', 'TRANSFER', 'MANUAL', 'COUNT'
        reference_id INTEGER,
        notes TEXT,
        transaction_date TEXT NOT NULL,
        created_by TEXT DEFAULT 'system',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (part_id) REFERENCES parts (id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    )
    ''')

    # Create order_history table (enhanced)
    cursor.execute('''
    CREATE TABLE order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        warehouse_id INTEGER DEFAULT 1,
        order_date TEXT NOT NULL,
        quantity_ordered INTEGER NOT NULL,
        quantity_received INTEGER DEFAULT 0,
        unit_cost DECIMAL(10,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'received', 'cancelled'
        supplier TEXT,
        expected_date TEXT,
        received_date TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (part_id) REFERENCES parts (id),
        FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    )
    ''')

    # Create stock count tables (盤點管理)
    cursor.execute('''
    CREATE TABLE stock_counts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        count_number TEXT NOT NULL UNIQUE,
        warehouse_id INTEGER NOT NULL,
        count_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planning', -- 'planning', 'counting', 'completed', 'cancelled'
        count_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'cycle', 'spot'
        description TEXT,
        counted_by TEXT,
        verified_by TEXT,
        total_items INTEGER DEFAULT 0,
        variance_items INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    )
    ''')

    cursor.execute('''
    CREATE TABLE stock_count_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_count_id INTEGER NOT NULL,
        part_id INTEGER NOT NULL,
        system_quantity INTEGER NOT NULL,
        counted_quantity INTEGER,
        variance_quantity INTEGER DEFAULT 0,
        notes TEXT,
        counted_at TEXT,
        FOREIGN KEY (stock_count_id) REFERENCES stock_counts (id),
        FOREIGN KEY (part_id) REFERENCES parts (id),
        UNIQUE(stock_count_id, part_id)
    )
    ''')

    print("Tables created successfully.")

    # Insert sample warehouses
    warehouses_data = [
        ('W001', '主倉庫', '主要儲存倉庫'),
        ('W002', '備品倉庫', '備品和工具倉庫'),
        ('W003', '退料倉庫', '退料和待處理倉庫'),
        ('W004', '在製品倉庫', '生產中的在製品倉庫')
    ]
    
    cursor.executemany(
        'INSERT INTO warehouses (code, name, description) VALUES (?, ?, ?)',
        warehouses_data
    )
    print(f"{cursor.rowcount} warehouses inserted.")

    # Populate warehouse_locations (only one per warehouse)
    warehouse_locations_to_insert = []
    warehouses_ids = [row[0] for row in cursor.execute('SELECT id FROM warehouses').fetchall()]
    
    for warehouse_id in warehouses_ids:
        location_code = f"A區-1層-1排 (W{warehouse_id})"
        description = f"倉庫 {warehouse_id} 的 {location_code}"
        warehouse_locations_to_insert.append((warehouse_id, location_code, description))

    cursor.executemany(
        'INSERT INTO warehouse_locations (warehouse_id, location_code, description) VALUES (?, ?, ?)',
        warehouse_locations_to_insert
    )
    print(f"{cursor.rowcount} warehouse locations inserted.")

    # Insert sample parts (only one)
    parts_to_insert = []
    units = ['個']
    
    part_number = f"SCR-001"
    name = f"螺絲 M6"
    description = f"螺絲 - 十字螺絲，尺寸：M6，適用於一般機械裝配"
    unit = random.choice(units)
    quantity_per_box = 100
    safety_stock = 10
    reorder_point = 20
    standard_cost = 1.50
    
    parts_to_insert.append((
        part_number, name, description, unit, quantity_per_box, 
        safety_stock, reorder_point, standard_cost
    ))

    cursor.executemany(
        '''INSERT INTO parts (part_number, name, description, unit, quantity_per_box, 
           safety_stock, reorder_point, standard_cost) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        parts_to_insert
    )
    print(f"{cursor.rowcount} parts inserted.")

    # Populate part_locations (linking parts to warehouse_locations) (only one)
    parts_ids = [row[0] for row in cursor.execute('SELECT id FROM parts').fetchall()]
    warehouse_locations_ids = [row[0] for row in cursor.execute('SELECT id FROM warehouse_locations').fetchall()]
    
    part_locations_to_insert = []
    if parts_ids and warehouse_locations_ids:
        part_id = parts_ids[0]
        wh_loc_id = warehouse_locations_ids[0]
        part_locations_to_insert.append((part_id, wh_loc_id))
    
    for part_id, wh_loc_id in part_locations_to_insert:
        try:
            cursor.execute(
                'INSERT INTO part_locations (part_id, warehouse_location_id) VALUES (?, ?)',
                (part_id, wh_loc_id)
            )
        except sqlite3.IntegrityError:
            pass
    print(f"{cursor.rowcount} part locations inserted.")

    # Initialize current inventory (only one)
    warehouses_ids = [row[0] for row in cursor.execute('SELECT id FROM warehouses').fetchall()]
    
    inventory_data = []
    if parts_ids and warehouses_ids:
        part_id = parts_ids[0]
        warehouse_id = warehouses_ids[0]
        quantity = 100
        reserved = 10
        available = quantity - reserved
        inventory_data.append((part_id, warehouse_id, quantity, reserved, available))

    cursor.executemany(
        '''INSERT INTO current_inventory (part_id, warehouse_id, quantity_on_hand, reserved_quantity, available_quantity)
           VALUES (?, ?, ?, ?, ?)''',
        inventory_data
    )
    print(f"{cursor.rowcount} inventory records inserted.")

    # Create sample transactions (only one)
    transaction_types = ['IN_PURCHASE']
    transactions_data = []
    
    if parts_ids and warehouses_ids:
        part_id = parts_ids[0]
        warehouse_id = warehouses_ids[0]
        transaction_type = transaction_types[0]
        quantity = 50
        unit_cost = 1.50
        transaction_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        reference_type = 'MANUAL'
        reference_id = None
        notes = f"自動生成的{transaction_type}交易記錄"
        
        transactions_data.append((
            part_id, warehouse_id, transaction_type, quantity, unit_cost,
            reference_type, reference_id, notes, transaction_date
        ))

    cursor.executemany(
        '''INSERT INTO inventory_transactions 
           (part_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id, notes, transaction_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        transactions_data
    )
    print(f"{cursor.rowcount} transactions inserted.")

    # Create enhanced order history (only one)
    orders_data = []
    statuses = ['pending']
    suppliers = ['供應商A']
    
    if parts_ids and warehouses_ids:
        part_id = parts_ids[0]
        warehouse_id = warehouses_ids[0]
        order_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        quantity_ordered = 20
        quantity_received = 0
        unit_cost = 2.00
        status = statuses[0]
        supplier = suppliers[0]
        expected_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        received_date = None
        notes = f"訂購{quantity_ordered}個，預計{expected_date}到貨"
        
        orders_data.append((
            part_id, warehouse_id, order_date, quantity_ordered, quantity_received,
            unit_cost, status, supplier, expected_date, received_date, notes
        ))

    cursor.executemany(
        '''INSERT INTO order_history 
           (part_id, warehouse_id, order_date, quantity_ordered, quantity_received, unit_cost, status, supplier, expected_date, received_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        orders_data
    )
    print(f"{cursor.rowcount} enhanced orders inserted.")

    # Create sample stock count (only one)
    count_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute(
        '''INSERT INTO stock_counts (count_number, warehouse_id, count_date, status, count_type, description, counted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        ('SC-001', 1, count_date, 'planning', 'full', '主倉庫全盤點', '管理員')
    )
    
    stock_count_id = cursor.lastrowid
    
    # Add stock count details for first part (only one)
    count_details = []
    if parts_ids:
        part_id = parts_ids[0]
        system_qty = cursor.execute(
            'SELECT quantity_on_hand FROM current_inventory WHERE part_id = ? AND warehouse_id = 1',
            (part_id,)
        ).fetchone()[0]
        
        count_details.append((stock_count_id, part_id, system_qty))
    
    cursor.executemany(
        'INSERT INTO stock_count_details (stock_count_id, part_id, system_quantity) VALUES (?, ?, ?)',
        count_details
    )
    print(f"{cursor.rowcount} stock count details inserted.")

    # Display statistics
    parts_count = cursor.execute("SELECT COUNT(*) FROM parts").fetchone()[0]
    warehouses_count = cursor.execute("SELECT COUNT(*) FROM warehouses").fetchone()[0]
    warehouse_locations_count = cursor.execute("SELECT COUNT(*) FROM warehouse_locations").fetchone()[0]
    inventory_count = cursor.execute("SELECT COUNT(*) FROM current_inventory").fetchone()[0]
    transactions_count = cursor.execute("SELECT COUNT(*) FROM inventory_transactions").fetchone()[0]
    orders_count = cursor.execute("SELECT COUNT(*) FROM order_history").fetchone()[0]
    total_locations = cursor.execute("SELECT COUNT(*) FROM part_locations").fetchone()[0]
    
    print(f"\n=== 完整庫存管理資料庫統計 ===")
    print(f"倉庫數量: {warehouses_count}")
    print(f"零件數量: {parts_count}")
    print(f"總倉庫位置數量: {warehouse_locations_count}")
    print(f"總零件位置關聯數量: {total_locations}")
    print(f"庫存記錄: {inventory_count}")
    print(f"交易記錄: {transactions_count}")
    print(f"訂單記錄: {orders_count}")
    print(f"盤點記錄: 1 (含 {len(count_details)} 個明細)")

    conn.commit()
    conn.close()
    print(f"\nComplete inventory database '{db_name}' created successfully.")

if __name__ == '__main__':
    setup_inventory_database()
