import sqlite3
import pandas as pd

# Connect to the SQLite database
conn = sqlite3.connect('hardware.db')

# Check what tables exist
print('Available tables in database:')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
for table in tables:
    print(f'- {table[0]}')

print('\n' + '='*50)

# Check if work_order_demand table exists and has data
try:
    work_order_query = '''
    SELECT * FROM work_order_demand 
    WHERE order_id LIKE '%dj4hjp6ej03xu3%'
    '''
    work_orders = pd.read_sql_query(work_order_query, conn)
    print(f'Found {len(work_orders)} matching work orders for dj4hjp6ej03xu3')
    
    if work_orders.empty:
        # Try broader search
        print('Trying broader search...')
        broad_search = '''
        SELECT order_id, part_number, required_quantity, material_description 
        FROM work_order_demand 
        WHERE order_id LIKE '%dj4hjp%' OR material_description LIKE '%零件%'
        LIMIT 10
        '''
        broader_results = pd.read_sql_query(broad_search, conn)
        print(f'Broader search found {len(broader_results)} results:')
        for _, row in broader_results.iterrows():
            print(f'{row["order_id"]} | {row["part_number"]} | {row["material_description"]}')
    else:
        for _, row in work_orders.iterrows():
            print(f'Order: {row["order_id"]}, Part: {row["part_number"]}, Qty: {row["required_quantity"]}')
            print(f'Description: {row["material_description"]}')

except Exception as e:
    print(f'Error accessing work_order_demand table: {e}')
    
    # Try to find tables with similar names
    print('Looking for tables with "order" or "work" in name:')
    for table in tables:
        if 'order' in table[0].lower() or 'work' in table[0].lower():
            print(f'Found table: {table[0]}')
            try:
                sample_query = f'SELECT * FROM {table[0]} LIMIT 3'
                sample_data = pd.read_sql_query(sample_query, conn)
                print(f'Columns: {list(sample_data.columns)}')
                print(f'Sample data: {len(sample_data)} rows')
                if not sample_data.empty:
                    print(sample_data.head())
                print('---')
            except Exception as table_error:
                print(f'Error reading {table[0]}: {table_error}')

conn.close()