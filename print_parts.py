import sqlite3

def print_some_parts(limit=10):
    """Connects to the database and prints a few existing part numbers."""
    db_name = 'hardware.db'
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()
        print(f"--- First {limit} Part Numbers from {db_name} ---")
        cursor.execute("SELECT part_number FROM parts LIMIT ?", (limit,))
        parts = cursor.fetchall()
        conn.close()
        
        if not parts:
            print("No parts found in the database.")
            return

        for i, part in enumerate(parts):
            print(f"{i+1}. {part[0]}")
        print("-------------------------------------------------")
        print("\nPlease copy one of the part numbers above and paste it into the app to test.")

    except sqlite3.Error as e:
        print(f"Database error: {e}")

if __name__ == '__main__':
    print_some_parts()
