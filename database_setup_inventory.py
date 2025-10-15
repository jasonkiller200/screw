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

    # Create enhanced parts table
    cursor.execute('''
    CREATE TABLE parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT '個',
        quantity_per_box INTEGER NOT NULL,
        storage_location TEXT NOT NULL,
        safety_stock INTEGER DEFAULT 0,
        reorder_point INTEGER DEFAULT 0,
        standard_cost DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

    # Insert sample parts with enhanced fields
    parts_to_insert = []
    units = ['盒', '個', '包', '組', '件', '公斤', '公尺', '片']
    
    part_categories = [
        ('螺絲', 'SCR', ['十字螺絲', '一字螺絲', '六角螺絲', '自攻螺絲']),
        ('螺帽', 'NUT', ['六角螺帽', '方形螺帽', '蝶形螺帽', '圓螺帽']),
        ('墊片', 'WSH', ['平墊片', '彈簧墊片', '橡膠墊片', '銅墊片']),
        ('軸承', 'BRG', ['深溝球軸承', '角接觸軸承', '圓錐軸承', '推力軸承']),
        ('齒輪', 'GER', ['直齒輪', '斜齒輪', '蝸輪蝸桿', '行星齒輪']),
        ('彈簧', 'SPR', ['壓縮彈簧', '拉伸彈簧', '扭轉彈簧', '板簧']),
        ('管件', 'PIP', ['彎頭', '三通', '異徑管', '法蘭']),
        ('電線', 'WIR', ['單芯線', '多芯線', '屏蔽線', '耐高溫線']),
        ('連接器', 'CON', ['插頭', '插座', '端子台', '接線柱']),
        ('密封件', 'SEL', ['O型環', '油封', '密封墊', '密封條'])
    ]
    
    for category_name, prefix, items in part_categories:
        for i, item_name in enumerate(items):
            for size_variant in range(3):
                part_number = f"{prefix}-{generate_random_string(4)}"
                name = f"{item_name} ({['M6', 'M8', 'M10'][size_variant]})"
                description = f"{category_name} - {item_name}，尺寸：{['M6', 'M8', 'M10'][size_variant]}，適用於一般機械裝配"
                unit = random.choice(units)
                quantity_per_box = random.choice([10, 20, 50, 100, 200, 500])
                storage_location = f"{chr(65+random.randint(0, 4))}區-{random.randint(1, 5)}層-{random.randint(1, 10)}排"
                safety_stock = random.randint(5, 50)
                reorder_point = safety_stock + random.randint(10, 30)
                standard_cost = round(random.uniform(0.5, 50.0), 2)
                
                parts_to_insert.append((
                    part_number, name, description, unit, quantity_per_box, 
                    storage_location, safety_stock, reorder_point, standard_cost
                ))

    cursor.executemany(
        '''INSERT INTO parts (part_number, name, description, unit, quantity_per_box, 
           storage_location, safety_stock, reorder_point, standard_cost) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        parts_to_insert
    )
    print(f"{cursor.rowcount} parts inserted.")

    # Initialize current inventory for all parts in main warehouse
    parts_ids = [row[0] for row in cursor.execute('SELECT id FROM parts').fetchall()]
    warehouses_ids = [row[0] for row in cursor.execute('SELECT id FROM warehouses').fetchall()]
    
    inventory_data = []
    for part_id in parts_ids:
        for warehouse_id in warehouses_ids:
            # Main warehouse has more stock
            if warehouse_id == 1:  # Main warehouse
                quantity = random.randint(20, 200)
            else:
                quantity = random.randint(0, 50)
            
            reserved = random.randint(0, min(10, quantity))
            available = quantity - reserved
            
            inventory_data.append((part_id, warehouse_id, quantity, reserved, available))

    cursor.executemany(
        '''INSERT INTO current_inventory (part_id, warehouse_id, quantity_on_hand, reserved_quantity, available_quantity)
           VALUES (?, ?, ?, ?, ?)''',
        inventory_data
    )
    print(f"{cursor.rowcount} inventory records inserted.")

    # Create sample transactions
    transaction_types = ['IN_PURCHASE', 'IN_TRANSFER', 'IN_RETURN', 'OUT_ISSUE', 'OUT_TRANSFER', 'ADJUST']
    transactions_data = []
    
    for _ in range(500):  # Create 500 sample transactions
        part_id = random.choice(parts_ids)
        warehouse_id = random.choice(warehouses_ids)
        transaction_type = random.choice(transaction_types)
        
        if transaction_type.startswith('IN_'):
            quantity = random.randint(1, 50)
        else:
            quantity = -random.randint(1, 30)
        
        unit_cost = round(random.uniform(0.5, 20.0), 2)
        
        random_days = random.randint(1, 90)
        random_seconds = random.randint(0, 86400)
        transaction_date = (datetime.now() - timedelta(days=random_days, seconds=random_seconds))
        transaction_date_str = transaction_date.strftime('%Y-%m-%d %H:%M:%S')
        
        reference_type = random.choice(['ORDER', 'TRANSFER', 'MANUAL', 'COUNT'])
        reference_id = random.randint(1, 100) if reference_type != 'MANUAL' else None
        
        notes = f"自動生成的{transaction_type}交易記錄"
        
        transactions_data.append((
            part_id, warehouse_id, transaction_type, quantity, unit_cost,
            reference_type, reference_id, notes, transaction_date_str
        ))

    cursor.executemany(
        '''INSERT INTO inventory_transactions 
           (part_id, warehouse_id, transaction_type, quantity, unit_cost, reference_type, reference_id, notes, transaction_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        transactions_data
    )
    print(f"{cursor.rowcount} transactions inserted.")

    # Create enhanced order history
    orders_data = []
    statuses = ['pending', 'confirmed', 'received']
    suppliers = ['供應商A', '供應商B', '供應商C', '供應商D', '供應商E']
    
    for part_id in parts_ids[:50]:  # First 50 parts have orders
        num_orders = random.randint(1, 3)
        for _ in range(num_orders):
            warehouse_id = random.choice(warehouses_ids)
            random_days = random.randint(1, 180)
            order_date = (datetime.now() - timedelta(days=random_days))
            order_date_str = order_date.strftime('%Y-%m-%d %H:%M:%S')
            
            quantity_ordered = random.randint(10, 100)
            quantity_received = 0 if random.random() < 0.3 else random.randint(0, quantity_ordered)
            unit_cost = round(random.uniform(1.0, 25.0), 2)
            status = random.choice(statuses)
            supplier = random.choice(suppliers)
            
            expected_date = (order_date + timedelta(days=random.randint(7, 30))).strftime('%Y-%m-%d')
            received_date = None
            if status == 'received':
                received_date = (order_date + timedelta(days=random.randint(5, 25))).strftime('%Y-%m-%d')
            
            notes = f"訂購{quantity_ordered}個，預計{expected_date}到貨"
            
            orders_data.append((
                part_id, warehouse_id, order_date_str, quantity_ordered, quantity_received,
                unit_cost, status, supplier, expected_date, received_date, notes
            ))

    cursor.executemany(
        '''INSERT INTO order_history 
           (part_id, warehouse_id, order_date, quantity_ordered, quantity_received, unit_cost, status, supplier, expected_date, received_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        orders_data
    )
    print(f"{cursor.rowcount} enhanced orders inserted.")

    # Create sample stock count
    count_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute(
        '''INSERT INTO stock_counts (count_number, warehouse_id, count_date, status, count_type, description, counted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        ('SC-001', 1, count_date, 'planning', 'full', '主倉庫全盤點', '管理員')
    )
    
    stock_count_id = cursor.lastrowid
    
    # Add stock count details for first 20 parts
    count_details = []
    for part_id in parts_ids[:20]:
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
    inventory_count = cursor.execute("SELECT COUNT(*) FROM current_inventory").fetchone()[0]
    transactions_count = cursor.execute("SELECT COUNT(*) FROM inventory_transactions").fetchone()[0]
    orders_count = cursor.execute("SELECT COUNT(*) FROM order_history").fetchone()[0]
    
    print(f"\n=== 完整庫存管理資料庫統計 ===")
    print(f"倉庫數量: {warehouses_count}")
    print(f"零件數量: {parts_count}")
    print(f"庫存記錄: {inventory_count}")
    print(f"交易記錄: {transactions_count}")
    print(f"訂單記錄: {orders_count}")
    print(f"盤點記錄: 1 (含 {len(count_details)} 個明細)")

    conn.commit()
    conn.close()
    print(f"\nComplete inventory database '{db_name}' created successfully.")

if __name__ == '__main__':
    setup_inventory_database()