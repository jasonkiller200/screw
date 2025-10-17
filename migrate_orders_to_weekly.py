#!/usr/bin/env python3
"""
遷移現有訂單到週期訂單系統
"""

import os
import sys

# 添加當前目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from extensions import db
from models.order import Order
from models.weekly_order import WeeklyOrderCycle, OrderRegistration
from models.part import Part
from datetime import datetime, timezone, timedelta

def get_taipei_time():
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

def migrate_orders_to_weekly():
    """將現有的待處理訂單遷移到週期訂單系統"""
    
    with app.app_context():
        print("🔄 開始遷移現有訂單到週期訂單系統...")
        
        # 檢查待處理的訂單
        pending_orders = Order.get_pending_orders()
        print(f"📋 找到 {len(pending_orders)} 個待處理訂單")
        
        if not pending_orders:
            print("✅ 沒有待處理的訂單需要遷移")
            return
        
        # 檢查當前活躍的週期
        current_cycle = WeeklyOrderCycle.get_current_cycle()
        
        if not current_cycle:
            print("📅 沒有活躍的週期，創建新的週期...")
            current_cycle = WeeklyOrderCycle.create_weekly_cycle()
            print(f"✅ 創建新週期: {current_cycle.cycle_name}")
        else:
            print(f"📅 使用當前週期: {current_cycle.cycle_name}")
        
        # 獲取當前週期的最大項次
        max_sequence = db.session.query(db.func.max(OrderRegistration.item_sequence)).filter_by(cycle_id=current_cycle.id).scalar()
        next_sequence = (max_sequence or 0) + 1
        
        migrated_count = 0
        
        for order in pending_orders:
            try:
                # 獲取零件資訊
                part = order.part
                if not part:
                    print(f"⚠️ 跳過訂單 #{order.id}：找不到對應的零件")
                    continue
                
                # 創建週期申請記錄
                registration = OrderRegistration()
                registration.cycle_id = current_cycle.id
                registration.item_sequence = next_sequence
                registration.part_number = part.part_number
                registration.material_nature = '採購品'
                registration.part_name = part.name
                registration.specifications = part.description or ''
                registration.quantity = order.quantity_ordered
                registration.unit = part.unit
                registration.category = ''
                registration.required_date = order.expected_date
                registration.priority = 'normal'  # 預設為一般申請
                registration.purpose_notes = f'從舊系統遷移 (原訂單 #{order.id}){f" - {order.notes}" if order.notes else ""}'
                registration.applicant_name = '系統遷移'
                registration.department = '系統遷移'
                registration.status = 'registered'
                
                db.session.add(registration)
                
                # 更新原訂單狀態為已遷移
                order.status = 'migrated'
                order.notes = f'{order.notes} [已遷移到週期申請 #{next_sequence}]' if order.notes else f'[已遷移到週期申請 #{next_sequence}]'
                
                print(f"✅ 遷移訂單 #{order.id}: {part.part_number} - {part.name} (數量: {order.quantity_ordered}) → 週期申請 #{next_sequence}")
                
                next_sequence += 1
                migrated_count += 1
                
            except Exception as e:
                print(f"❌ 遷移訂單 #{order.id} 失敗: {str(e)}")
                continue
        
        # 提交所有變更
        try:
            db.session.commit()
            print(f"🎉 成功遷移 {migrated_count} 個訂單到週期申請系統")
            
            if migrated_count > 0:
                print(f"📊 週期申請詳情:")
                print(f"   週期名稱: {current_cycle.cycle_name}")
                print(f"   截止時間: {current_cycle.deadline}")
                print(f"   總申請項目: {current_cycle.total_registrations}")
                
        except Exception as e:
            db.session.rollback()
            print(f"❌ 提交變更失敗: {str(e)}")

if __name__ == '__main__':
    migrate_orders_to_weekly()