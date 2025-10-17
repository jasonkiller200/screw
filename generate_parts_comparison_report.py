"""
工單需求零件與零件倉差異分析報表生成工具
自動比對工單需求零件與零件倉項目，生成詳細的差異分析報表
"""

from app import app
from models.work_order import WorkOrderDemand
from models.part import Part
from models.inventory import CurrentInventory
from extensions import db
import pandas as pd
from datetime import datetime
import os

def generate_parts_comparison_report():
    """生成工單需求零件與零件倉差異分析報表"""
    
    with app.app_context():
        print("🔍 開始分析工單需求零件與零件倉差異...")
        
        # 1. 取得工單需求零件的詳細資訊
        print("📋 正在分析工單需求零件...")
        work_order_details = db.session.query(
            WorkOrderDemand.part_number,
            WorkOrderDemand.material_description,
            db.func.sum(WorkOrderDemand.required_quantity).label('total_required'),
            db.func.count(WorkOrderDemand.order_id).label('order_count')
        ).group_by(
            WorkOrderDemand.part_number,
            WorkOrderDemand.material_description
        ).all()
        
        work_order_dict = {}
        for row in work_order_details:
            work_order_dict[row[0]] = {
                'description': row[1],
                'total_required': float(row[2]),
                'order_count': int(row[3])
            }
        
        # 2. 取得零件倉零件的詳細資訊
        print("📦 正在分析零件倉項目...")
        inventory_details = db.session.query(
            Part.part_number,
            Part.name,
            Part.unit,
            Part.description
        ).all()
        
        inventory_dict = {}
        for row in inventory_details:
            inventory_dict[row[0]] = {
                'name': row[1],
                'unit': row[2] or '',
                'description': row[3] or ''
            }
        
        # 3. 取得零件庫存資訊
        print("📊 正在分析庫存狀況...")
        stock_details = db.session.query(
            Part.part_number,
            db.func.sum(CurrentInventory.quantity_on_hand).label('total_stock'),
            db.func.sum(CurrentInventory.available_quantity).label('available_stock')
        ).join(CurrentInventory).group_by(Part.part_number).all()
        
        stock_dict = {}
        for row in stock_details:
            stock_dict[row[0]] = {
                'total_stock': float(row[1]) if row[1] else 0,
                'available_stock': float(row[2]) if row[2] else 0
            }
        
        # 4. 分析差異
        print("🔎 正在進行差異分析...")
        
        # 4.1 工單需求有但零件倉沒有的零件
        missing_in_inventory = []
        for part_number, details in work_order_dict.items():
            if part_number not in inventory_dict:
                missing_in_inventory.append({
                    '零件編號': part_number,
                    '物料說明': details['description'],
                    '總需求量': details['total_required'],
                    '關聯工單數': details['order_count'],
                    '狀態': '工單需求有，零件倉缺少',
                    '建議動作': '新增至零件倉'
                })
        
        # 4.2 零件倉有的零件與工單需求對比
        inventory_with_demand = []
        for part_number, details in inventory_dict.items():
            work_order_info = work_order_dict.get(part_number, {})
            stock_info = stock_dict.get(part_number, {'total_stock': 0, 'available_stock': 0})
            
            required_qty = work_order_info.get('total_required', 0)
            available_qty = stock_info.get('available_stock', 0)
            shortage = max(0, required_qty - available_qty)
            
            inventory_with_demand.append({
                '零件編號': part_number,
                '零件名稱': details['name'],
                '零件說明': details['description'],
                '單位': details['unit'],
                '工單需求量': required_qty,
                '庫存總量': stock_info.get('total_stock', 0),
                '可用庫存': available_qty,
                '缺料數量': shortage,
                '關聯工單數': work_order_info.get('order_count', 0),
                '是否有工單需求': '是' if required_qty > 0 else '否',
                '庫存狀況': '充足' if shortage == 0 and required_qty > 0 else ('缺料' if shortage > 0 else '無需求')
            })
        
        # 4.3 零件倉有但工單需求沒有的零件
        unused_inventory = []
        for part_number, details in inventory_dict.items():
            if part_number not in work_order_dict:
                stock_info = stock_dict.get(part_number, {'total_stock': 0, 'available_stock': 0})
                unused_inventory.append({
                    '零件編號': part_number,
                    '零件名稱': details['name'],
                    '零件說明': details['description'],
                    '單位': details['unit'],
                    '庫存總量': stock_info.get('total_stock', 0),
                    '可用庫存': stock_info.get('available_stock', 0),
                    '狀態': '零件倉有，無工單需求',
                    '建議動作': '檢視是否為過剩庫存'
                })
        
        # 5. 生成報表
        print("📄 正在生成 Excel 報表...")
        
        # 建立 DataFrames
        df_missing = pd.DataFrame(missing_in_inventory)
        df_inventory = pd.DataFrame(inventory_with_demand)
        df_unused = pd.DataFrame(unused_inventory)
        
        # 排序
        if not df_missing.empty:
            df_missing = df_missing.sort_values('總需求量', ascending=False)
        
        if not df_inventory.empty:
            df_inventory = df_inventory.sort_values('缺料數量', ascending=False)
        
        if not df_unused.empty:
            df_unused = df_unused.sort_values('庫存總量', ascending=False)
        
        # 生成檔案名稱
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'工單需求與零件倉差異分析_{timestamp}.xlsx'
        
        # 寫入 Excel 檔案
        with pd.ExcelWriter(filename, engine='openpyxl') as writer:
            # 摘要頁
            summary_data = {
                '項目': [
                    '工單需求零件總數',
                    '零件倉零件總數',
                    '共同零件數',
                    '工單需求有但零件倉沒有',
                    '零件倉有但工單需求沒有',
                    '有庫存缺料的零件數',
                    '庫存充足的零件數'
                ],
                '數量': [
                    len(work_order_dict),
                    len(inventory_dict),
                    len(set(work_order_dict.keys()) & set(inventory_dict.keys())),
                    len(missing_in_inventory),
                    len(unused_inventory),
                    len(df_inventory[df_inventory['缺料數量'] > 0]) if not df_inventory.empty else 0,
                    len(df_inventory[df_inventory['庫存狀況'] == '充足']) if not df_inventory.empty else 0
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='摘要', index=False)
            
            # 缺少零件頁
            if not df_missing.empty:
                df_missing.to_excel(writer, sheet_name='工單需求但零件倉缺少', index=False)
            
            # 庫存與需求對比頁
            if not df_inventory.empty:
                df_inventory.to_excel(writer, sheet_name='庫存與工單需求對比', index=False)
            
            # 無需求零件頁
            if not df_unused.empty:
                df_unused.to_excel(writer, sheet_name='零件倉有但無工單需求', index=False)
        
        # 6. 輸出統計資訊
        print("\n" + "="*80)
        print("📊 工單需求與零件倉差異分析完成")
        print("="*80)
        print(f"📋 工單需求零件總數: {len(work_order_dict)} 個")
        print(f"📦 零件倉零件總數: {len(inventory_dict)} 個")
        print(f"🔗 共同零件數: {len(set(work_order_dict.keys()) & set(inventory_dict.keys()))} 個")
        print(f"⚠️  工單需求有但零件倉沒有: {len(missing_in_inventory)} 個")
        print(f"📁 零件倉有但工單需求沒有: {len(unused_inventory)} 個")
        
        if not df_inventory.empty:
            shortage_count = len(df_inventory[df_inventory['缺料數量'] > 0])
            sufficient_count = len(df_inventory[df_inventory['庫存狀況'] == '充足'])
            print(f"🚨 有庫存缺料的零件數: {shortage_count} 個")
            print(f"✅ 庫存充足的零件數: {sufficient_count} 個")
        
        print(f"\n📄 報表已生成: {filename}")
        print("="*80)
        
        # 7. 顯示重要的缺少零件
        if missing_in_inventory:
            print("\n🔴 最重要的缺少零件 (前10個):")
            print("-" * 60)
            for i, item in enumerate(df_missing.head(10).to_dict('records')):
                print(f"{i+1:2d}. {item['零件編號']} - 需求量: {item['總需求量']}")
                print(f"     {item['物料說明']}")
        
        # 8. 顯示最嚴重的缺料情況
        if not df_inventory.empty:
            shortage_items = df_inventory[df_inventory['缺料數量'] > 0].head(10)
            if not shortage_items.empty:
                print("\n🚨 最嚴重的缺料情況 (前10個):")
                print("-" * 60)
                for i, (_, item) in enumerate(shortage_items.iterrows()):
                    print(f"{i+1:2d}. {item['零件編號']} - 缺料: {item['缺料數量']}")
                    print(f"     需求: {item['工單需求量']}, 可用: {item['可用庫存']}")
        
        return filename

if __name__ == '__main__':
    print("🚀 工單需求零件與零件倉差異分析工具")
    print("="*80)
    
    try:
        filename = generate_parts_comparison_report()
        print(f"\n✅ 分析完成！報表檔案: {filename}")
    except Exception as e:
        print(f"\n❌ 分析過程發生錯誤: {e}")
        import traceback
        traceback.print_exc()