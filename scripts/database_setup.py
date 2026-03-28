import sqlite3
import random
import string
from datetime import datetime, timedelta

def generate_random_string(length=8):
    """Generate a random string of fixed length."""
    letters_and_digits = string.ascii_uppercase + string.digits
    return ''.join(random.choice(letters_and_digits) for i in range(length))

def setup_database():
    """Create and populate the database with sample data."""
    db_name = 'hardware.db'
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Drop tables if they exist to start fresh
    cursor.execute('DROP TABLE IF EXISTS order_history')
    cursor.execute('DROP TABLE IF EXISTS parts')

    # Create parts table
    cursor.execute('''
    CREATE TABLE parts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_number TEXT NOT NULL UNIQUE,
        quantity_per_box INTEGER NOT NULL,
        location TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT '個'
    )
    ''')

    # Create order_history table
    cursor.execute('''
    CREATE TABLE order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        part_id INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        quantity_ordered INTEGER NOT NULL,
        FOREIGN KEY (part_id) REFERENCES parts (id)
    )
    ''')

    print("Tables created successfully.")

    # --- Populate Data ---
    parts_to_insert = []
    units = ['盒', '個', '包', '隻', '件']
    for i in range(100):
        part_number = f"HW-{generate_random_string(6)}"
        quantity_per_box = random.choice([10, 20, 50, 100, 200])
        location = f"Shelf {random.randint(1, 20)}-{chr(65+random.randint(0, 4))}-{random.randint(1, 5)}"
        unit = random.choice(units)
        parts_to_insert.append((part_number, quantity_per_box, location, unit))

    cursor.executemany(
        'INSERT INTO parts (part_number, quantity_per_box, location, unit) VALUES (?, ?, ?, ?)',
        parts_to_insert
    )
    print(f"{cursor.rowcount} parts inserted.")

    # Populate order history
    parts_ids = [row[0] for row in cursor.execute('SELECT id FROM parts').fetchall()]
    orders_to_insert = []
    for part_id in parts_ids:
        # Create 1 to 5 historical orders for each part
        for _ in range(random.randint(1, 5)):
            random_days = random.randint(1, 365)
            random_seconds = random.randint(0, 86400)
            order_datetime = (datetime.now() - timedelta(days=random_days, seconds=random_seconds))
            order_date_str = order_datetime.strftime('%Y-%m-%d %H:%M:%S')
            quantity_ordered = random.randint(1, 10)
            orders_to_insert.append((part_id, order_date_str, quantity_ordered))

    cursor.executemany(
        'INSERT INTO order_history (part_id, order_date, quantity_ordered) VALUES (?, ?, ?)',
        orders_to_insert
    )
    print(f"{cursor.rowcount} order history records inserted.")

    conn.commit()
    conn.close()
    print(f"Database '{db_name}' created and populated successfully.")

if __name__ == '__main__':
    setup_database()
