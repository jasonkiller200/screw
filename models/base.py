import sqlite3
from datetime import datetime, timezone, timedelta

DATABASE_NAME = 'hardware.db'

def get_db_connection():
    """Creates a connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row  # This allows accessing columns by name
    return conn

class BaseModel:
    """Base model class with common database operations."""
    
    @staticmethod
    def get_connection():
        return get_db_connection()
    
    @staticmethod
    def get_taipei_time():
        """Get current time in UTC+8 timezone."""
        tz_taipei = timezone(timedelta(hours=8))
        return datetime.now(tz_taipei).strftime('%Y-%m-%d %H:%M:%S')