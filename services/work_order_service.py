"""
Service layer for handling work order related business logic.
"""
from extensions import db
from models.work_order import WorkOrderDemand
import pandas as pd
from datetime import datetime

class WorkOrderService:

    @staticmethod
    def import_from_excel(file_stream):
        """
        Imports work order demands from an Excel file stream.
        This method contains the logic moved from web_controller.import_work_order_demands.
        """
        try:
            # 讀取 Excel 檔案
            df = pd.read_excel(file_stream)
            
            # 驗證必要欄位
            required_columns = ['訂單', '物料', '需求數量 (EINHEIT)', '物料說明', '作業說明', '上層物料說明', '需求日期', '散裝物料']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                return {
                    'success': False, 
                    'error': f'Excel 檔案缺少必要欄位: {", ".join(missing_columns)}'
                }
            
            imported_count = 0
            updated_count = 0
            error_count = 0
            filtered_count = 0
            
            # 處理每一行資料
            for index, row in df.iterrows():
                try:
                    # 讀取欄位資料
                    order_id = str(row['訂單']).strip()
                    part_number = str(row['物料']).strip()
                    required_quantity = float(row['需求數量 (EINHEIT)'])
                    
                    material_description = str(row['物料說明']).strip() if not pd.isna(row['物料說明']) else ''
                    operation_description = str(row['作業說明']).strip() if not pd.isna(row['作業說明']) else ''
                    parent_material_description = str(row['上層物料說明']).strip() if not pd.isna(row['上層物料說明']) else ''
                    bulk_material = str(row['散裝物料']).strip() if not pd.isna(row['散裝物料']) else ''
                    
                    # 篩選：跳過物料說明包含"圖"的項目
                    if '圖' in material_description:
                        filtered_count += 1
                        continue
                    
                    # 解析需求日期
                    required_date = row['需求日期']
                    if pd.isna(required_date):
                        required_date = datetime.now()
                    elif isinstance(required_date, str):
                        try:
                            required_date = datetime.strptime(required_date, '%Y-%m-%d')
                        except:
                            required_date = datetime.now()
                    elif not isinstance(required_date, datetime):
                        required_date = datetime.now()
                    
                    # 檢查記錄是否已存在
                    existing_demand = WorkOrderDemand.query.filter_by(
                        order_id=order_id, 
                        part_number=part_number
                    ).first()
                    
                    if existing_demand:
                        # 更新現有記錄
                        existing_demand.required_quantity = required_quantity
                        existing_demand.material_description = material_description
                        existing_demand.operation_description = operation_description
                        existing_demand.parent_material_description = parent_material_description
                        existing_demand.required_date = required_date
                        existing_demand.bulk_material = bulk_material
                        updated_count += 1
                    else:
                        # 建立新記錄
                        new_demand = WorkOrderDemand(
                            order_id=order_id,
                            part_number=part_number,
                            required_quantity=required_quantity,
                            material_description=material_description,
                            operation_description=operation_description,
                            parent_material_description=parent_material_description,
                            required_date=required_date,
                            bulk_material=bulk_material
                        )
                        db.session.add(new_demand)
                        imported_count += 1
                        
                except Exception as e:
                    error_count += 1
                    print(f"處理第 {index + 2} 行時發生錯誤: {e}")
            
            # 提交資料庫變更
            db.session.commit()
            
            return {
                'success': True,
                'imported_count': imported_count,
                'updated_count': updated_count,
                'error_count': error_count,
                'filtered_count': filtered_count,
                'total_processed': len(df)
            }
            
        except Exception as e:
            db.session.rollback()
            # 在 Service 層，我們通常會重新引發異常或返回一個錯誤字典
            # 這裡我們選擇返回錯誤字典，讓 Controller 決定如何呈現
            return {
                'success': False, 
                'error': f'匯入過程發生嚴重錯誤: {str(e)}'
            }

    @staticmethod
    def get_work_orders(order_id=None, part_number=None):
        """獲取工單需求列表，支援篩選。"""
        query = WorkOrderDemand.query

        if order_id:
            query = query.filter(WorkOrderDemand.order_id.ilike(f'%{order_id}%'))

        if part_number:
            query = query.filter(WorkOrderDemand.part_number.ilike(f'%{part_number}%'))

        demands = query.order_by(WorkOrderDemand.order_id, WorkOrderDemand.part_number).all()

        result = {
            'demands': [demand.to_dict() for demand in demands],
            'total_count': len(demands)
        }
        return result
