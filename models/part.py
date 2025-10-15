import sqlite3
from .base import BaseModel

class Part(BaseModel):
    """Model for handling parts data operations."""
    
    @classmethod
    def get_by_part_number(cls, part_number):
        """Find a part by its part number."""
        conn = cls.get_connection()
        try:
            part = conn.execute(
                'SELECT * FROM parts WHERE part_number = ?', 
                (part_number,)
            ).fetchone()
            return dict(part) if part else None
        finally:
            conn.close()
    
    @classmethod
    def get_all(cls):
        """Get all parts."""
        conn = cls.get_connection()
        try:
            parts = conn.execute('SELECT * FROM parts ORDER BY part_number').fetchall()
            return [dict(part) for part in parts]
        finally:
            conn.close()
    
    @classmethod
    def create(cls, part_number, name, description, unit, quantity_per_box, storage_location):
        """Create a new part."""
        conn = cls.get_connection()
        try:
            conn.execute(
                '''INSERT INTO parts (part_number, name, description, unit, quantity_per_box, storage_location) 
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (part_number, name, description, unit, quantity_per_box, storage_location)
            )
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()
    
    @classmethod
    def update(cls, part_id, part_number, name, description, unit, quantity_per_box, storage_location):
        """Update an existing part."""
        conn = cls.get_connection()
        try:
            conn.execute(
                '''UPDATE parts SET part_number=?, name=?, description=?, unit=?, 
                   quantity_per_box=?, storage_location=? WHERE id=?''',
                (part_number, name, description, unit, quantity_per_box, storage_location, part_id)
            )
            conn.commit()
            return conn.rowcount > 0
        finally:
            conn.close()
    
    @classmethod
    def delete(cls, part_id):
        """Delete a part."""
        conn = cls.get_connection()
        try:
            conn.execute('DELETE FROM parts WHERE id = ?', (part_id,))
            conn.commit()
            return conn.rowcount > 0
        finally:
            conn.close()
    
    @classmethod
    def exists(cls, part_number):
        """Check if a part exists by part number."""
        conn = cls.get_connection()
        try:
            result = conn.execute(
                'SELECT 1 FROM parts WHERE part_number = ?', 
                (part_number,)
            ).fetchone()
            return result is not None
        finally:
            conn.close()