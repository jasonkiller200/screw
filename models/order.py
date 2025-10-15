import sqlite3
from .base import BaseModel

class Order(BaseModel):
    """Model for handling order data operations."""
    
    @classmethod
    def create(cls, part_number, quantity_ordered, status='pending'):
        """Create a new order."""
        conn = cls.get_connection()
        try:
            # Get part ID first
            part = conn.execute(
                'SELECT id FROM parts WHERE part_number = ?', 
                (part_number,)
            ).fetchone()
            
            if not part:
                return False
            
            part_id = part['id']
            order_date = cls.get_taipei_time()
            
            conn.execute(
                '''INSERT INTO order_history (part_id, order_date, quantity_ordered, status) 
                   VALUES (?, ?, ?, ?)''',
                (part_id, order_date, quantity_ordered, status)
            )
            conn.commit()
            return True
        except Exception:
            return False
        finally:
            conn.close()
    
    @classmethod
    def get_history_by_part_id(cls, part_id):
        """Get order history for a specific part."""
        conn = cls.get_connection()
        try:
            orders = conn.execute(
                '''SELECT order_date, quantity_ordered, status 
                   FROM order_history WHERE part_id = ? 
                   ORDER BY order_date DESC''',
                (part_id,)
            ).fetchall()
            return [dict(order) for order in orders]
        finally:
            conn.close()
    
    @classmethod
    def get_history_by_part_number(cls, part_number):
        """Get order history for a specific part by part number."""
        conn = cls.get_connection()
        try:
            orders = conn.execute(
                '''SELECT oh.order_date, oh.quantity_ordered, oh.status 
                   FROM order_history oh
                   JOIN parts p ON oh.part_id = p.id
                   WHERE p.part_number = ? 
                   ORDER BY oh.order_date DESC''',
                (part_number,)
            ).fetchall()
            return [dict(order) for order in orders]
        finally:
            conn.close()
    
    @classmethod
    def get_pending_orders(cls):
        """Get all pending orders."""
        conn = cls.get_connection()
        try:
            orders = conn.execute(
                '''SELECT oh.id, p.part_number, p.name as part_name, 
                          oh.order_date, oh.quantity_ordered, oh.status
                   FROM order_history oh
                   JOIN parts p ON oh.part_id = p.id
                   WHERE oh.status = 'pending'
                   ORDER BY oh.order_date DESC'''
            ).fetchall()
            return [dict(order) for order in orders]
        finally:
            conn.close()
    
    @classmethod
    def get_all_orders(cls):
        """Get all orders with part information."""
        conn = cls.get_connection()
        try:
            orders = conn.execute(
                '''SELECT oh.id, p.part_number, p.name as part_name, 
                          oh.order_date, oh.quantity_ordered, oh.status
                   FROM order_history oh
                   JOIN parts p ON oh.part_id = p.id
                   ORDER BY oh.order_date DESC'''
            ).fetchall()
            return [dict(order) for order in orders]
        finally:
            conn.close()
    
    @classmethod
    def confirm_orders(cls, order_ids):
        """Confirm multiple orders by updating their status."""
        conn = cls.get_connection()
        try:
            placeholders = ','.join(['?'] * len(order_ids))
            conn.execute(
                f'UPDATE order_history SET status = "confirmed" WHERE id IN ({placeholders})',
                order_ids
            )
            conn.commit()
            return True
        except Exception:
            return False
        finally:
            conn.close()
    
    @classmethod
    def delete_order(cls, order_id):
        """Delete an order."""
        conn = cls.get_connection()
        try:
            cursor = conn.execute('DELETE FROM order_history WHERE id = ?', (order_id,))
            conn.commit()
            return cursor.rowcount > 0
        except Exception:
            return False
        finally:
            conn.close()