from models.inventory import CurrentInventory, InventoryTransaction
from models.weekly_order import OrderRegistration
from models.part import Part, WarehouseLocation
from extensions import db
from sqlalchemy.exc import SQLAlchemyError

class InventoryService:
    @staticmethod
    def receive_stock(registration_id, inbound_quantity, notes=''):
        """
        Processes the receipt of stock for a weekly order registration.
        Updates inventory and the order registration status.
        """
        try:
            # Get the registration and lock it for update
            registration = OrderRegistration.query.filter_by(id=registration_id).with_for_update().first()
            if not registration:
                return {'success': False, 'error': '找不到指定的申請項目'}

            if registration.status not in ['approved', 'partially_received']:
                return {'success': False, 'error': f'此項目狀態為「{registration.status}」，無法執行入庫'}

            total_needed = registration.quantity - registration.quantity_received
            if inbound_quantity > total_needed:
                return {'success': False, 'error': f'入庫數量 ({inbound_quantity}) 超過剩餘未交數量 ({total_needed})'}

            # Get Part ID
            part = Part.query.filter_by(part_number=registration.part_number).first()
            if not part:
                return {'success': False, 'error': f'找不到對應的零件資料: {registration.part_number}'}

            # Update inventory using the existing class method
            # This will also create a transaction log
            update_success = CurrentInventory.update_stock(
                part_id=part.id,
                warehouse_location_id=registration.warehouse_location_id,
                quantity_change=inbound_quantity,
                transaction_type='INBOUND',
                reference_type='OrderRegistration',
                reference_id=registration.id,
                notes=f'週期訂單入庫: {notes}'
            )

            if not update_success:
                db.session.rollback() # Rollback if update_stock failed
                return {'success': False, 'error': '更新庫存時發生錯誤'}

            # Update the registration record
            registration.quantity_received += inbound_quantity
            
            # Update status
            if registration.quantity_received >= registration.quantity:
                registration.status = 'completed'
            else:
                registration.status = 'partially_received'

            db.session.commit()
            return {'success': True, 'message': '入庫成功', 'new_status': registration.status}

        except SQLAlchemyError as e:
            db.session.rollback()
            return {'success': False, 'error': f'資料庫操作失敗: {str(e)}'}