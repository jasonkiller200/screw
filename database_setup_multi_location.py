import sqlite3
import random
import string
from datetime import datetime, timedelta

def generate_random_string(length=8):
    """Generate a random string of fixed length."""
    letters_and_digits = string.ascii_uppercase + string.digits
    return ''.join(random.choice(letters_and_digits) for i in range(length))

def setup_database():
    """Create and populate the database with sample data for MVC architecture with multi-location support."""
    db_name = 'hardware.db'
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Drop tables if they exist to start fresh
    cursor.execute('DROP TABLE IF EXISTS order_history')
    cursor.execute('DROP TABLE IF EXISTS part_locations') # New table
    cursor.execute('DROP TABLE IF EXISTS parts')

    # Create parts table (without storage_location)
    cursor.execute('''
    CREATE TABLE parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT '個',
        quantity_per_box INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Create part_locations table
    cursor.execute('''
    CREATE TABLE part_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        location TEXT NOT NULL,
        FOREIGN KEY (part_id) REFERENCES parts (id) ON DELETE CASCADE,
        UNIQUE(part_id, location)
    )
    ''')

    # Create order_history table with status field
    cursor.execute('''
    CREATE TABLE order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        quantity_ordered INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (part_id) REFERENCES parts (id)
    )
    ''')

    print("Tables created successfully.")

    # --- Populate Data ---
    parts_to_insert = []
    units = ['盒', '個', '包', '組', '件', '公斤', '公尺', '片']
    
    # 生成更真實的零件資料
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
        ('密封件', 'SEL', ['O型環', '油封', '密封墊', '密封條'])]
    
    for category_name, prefix, items in part_categories:
        for i, item_name in enumerate(items):
            for size_variant in range(3):  # 每種零件3個尺寸變種
                part_number = f"{prefix}-{generate_random_string(4)}"
                name = f"{item_name} ({['M6', 'M8', 'M10'][size_variant]})"
                description = f"{category_name} - {item_name}，尺寸：{['M6', 'M8', 'M10'][size_variant]}，適用於一般機械裝配"
                unit = random.choice(units)
                quantity_per_box = random.choice([10, 20, 50, 100, 200, 500])
                
                parts_to_insert.append((
                    part_number, name, description, unit, quantity_per_box
                ))

    cursor.executemany(
        'INSERT INTO parts (part_number, name, description, unit, quantity_per_box) VALUES (?, ?, ?, ?, ?)',
        parts_to_insert
    )
    print(f"{cursor.rowcount} parts inserted.")

    # Populate part_locations
    parts_ids = [row[0] for row in cursor.execute('SELECT id FROM parts').fetchall()]
    locations_to_insert = []
    for part_id in parts_ids:
        num_locations = random.randint(1, 3) # Each part can have 1 to 3 locations
        for _ in range(num_locations):
            location = f"{chr(65+random.randint(0, 4))}區-{random.randint(1, 5)}層-{random.randint(1, 10)}排"
            locations_to_insert.append((part_id, location))
    
    # Insert locations, handling potential duplicates if random generates same location for same part_id
    for part_id, location in locations_to_insert:
        try:
            cursor.execute(
                'INSERT INTO part_locations (part_id, location) VALUES (?, ?)',
                (part_id, location)
            )
        except sqlite3.IntegrityError:
            # Location already exists for this part, skip
            pass
    print(f"{cursor.rowcount} part locations inserted.")


    # Populate order history with status
    orders_to_insert = []
    statuses = ['pending', 'confirmed']
    
    for part_id in parts_ids:
        # Create 1 to 5 historical orders for each part
        num_orders = random.randint(1, 5)
        for order_idx in range(num_orders):
            random_days = random.randint(1, 365)
            random_seconds = random.randint(0, 86400)
            order_datetime = (datetime.now() - timedelta(days=random_days, seconds=random_seconds))
            order_date_str = order_datetime.strftime('%Y-%m-%d %H:%M:%S')
            quantity_ordered = random.randint(1, 10)
            
            # 最近的訂單更可能是 pending 狀態
            if order_idx == 0 and random.random() < 0.7:  # 70% 機率最新訂單是 pending
                status = 'pending'
            else:
                status = random.choice(statuses)
            
            orders_to_insert.append((part_id, order_date_str, quantity_ordered, status))

    cursor.executemany(
        'INSERT INTO order_history (part_id, order_date, quantity_ordered, status) VALUES (?, ?, ?, ?)',
        orders_to_insert
    )
    print(f"{cursor.rowcount} order history records inserted.")

    # 顯示統計資訊
    pending_count = cursor.execute("SELECT COUNT(*) FROM order_history WHERE status = 'pending'").fetchone()[0]
    confirmed_count = cursor.execute("SELECT COUNT(*) FROM order_history WHERE status = 'confirmed'").fetchone()[0]
    total_parts = cursor.execute("SELECT COUNT(*) FROM parts").fetchone()[0]
    total_locations = cursor.execute("SELECT COUNT(*) FROM part_locations").fetchone()[0]
    
    print(f"\n=== 資料庫統計 ===")
    print(f"總零件數量: {total_parts}")
    print(f"總儲存位置數量: {total_locations}")
    print(f"待處理訂單: {pending_count}")
    print(f"已確認訂單: {confirmed_count}")
    print(f"總訂單數量: {pending_count + confirmed_count}")

    conn.commit()
    conn.close()
    print(f"\nDatabase '{db_name}' created and populated successfully.")

if __name__ == '__main__':
    setup_database()
