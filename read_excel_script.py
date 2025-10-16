import pandas as pd

file_path = 'C:/app/screw/screw.xlsx'

try:
    df = pd.read_excel(file_path)
    print("Column Names:")
    print(df.columns.tolist())
    print("\nFirst 5 Rows:")
    print(df.head().to_string())
    print("\nDataFrame Info:")
    df.info()
except FileNotFoundError:
    print(f"Error: The file {file_path} was not found.")
except Exception as e:
    print(f"An error occurred: {e}")

