import sqlite3
import os

def fix_database(db_path='instance/hardware.db'):
    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Find inventory records with null location
        cursor.execute("SELECT id, warehouse_id FROM current_inventory WHERE warehouse_location_id IS NULL")
        records_to_fix = cursor.fetchall()

        if not records_to_fix:
            print("No records with NULL warehouse_location_id found.")
            return

        print(f"Found {len(records_to_fix)} records to fix.")

        for record_id, warehouse_id in records_to_fix:
            # Find the first location for the given warehouse
            cursor.execute("SELECT id FROM warehouse_locations WHERE warehouse_id = ? ORDER BY id LIMIT 1", (warehouse_id,))
            first_location = cursor.fetchone()

            if first_location:
                location_id = first_location[0]
                print(f"Updating record {record_id} (Warehouse {warehouse_id}) with Location ID {location_id}.")
                cursor.execute("UPDATE current_inventory SET warehouse_location_id = ? WHERE id = ?", (location_id, record_id))
            else:
                print(f"Warning: Could not find any location for Warehouse ID {warehouse_id}. Record {record_id} was not updated.")

        conn.commit()
        print("Database fix complete.")

    except sqlite3.Error as e:
        print(f"An error occurred: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    # Assuming the script is run from the root of the project
    db_file_path = os.path.join(os.path.dirname(__file__), 'instance', 'screw.db')
    fix_database(db_path='instance/hardware.db')
