import csv
import io
from models.inventory import StockCount, get_taipei_time
from models.part import Part, Warehouse
from extensions import db

class InventoryService:
    @staticmethod
    def import_stock_count_data(warehouse_id, file_stream):
        """
        Handles the batch import of stock count data from a CSV file.
        Returns a dictionary with success status, count_id, processed counts, and errors.
        """
        try:
            # Read the file content and try decoding with multiple encodings
            file_content = file_stream.read()
            encodings = ['utf-8-sig', 'utf-8', 'big5', 'gbk', 'cp950']
            csv_content = None
            
            for encoding in encodings:
                try:
                    csv_content = file_content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            
            if csv_content is None:
                return {'success': False, 'error': '無法解碼 CSV 檔案。請儲存為 UTF-8 格式。'}
            
            stream = io.StringIO(csv_content, newline=None)
            csv_reader = csv.DictReader(stream)
            
            count_data = []
            for row in csv_reader:
                count_data.append(row)
            
            # First, create a new stock count
            count_id = StockCount.create_count(
                warehouse_id=warehouse_id,
                count_type='full',
                description='批量匯入盤點資料',
                counted_by='系統匯入'
            )
            
            if not count_id:
                return {'success': False, 'error': '無法建立盤點記錄'}
            
            # Import data into the stock count
            success_count, error_list = StockCount.import_count_data(count_id, count_data)
            
            return {
                'success': True,
                'count_id': count_id,
                'processed_count': success_count,
                'total_rows': len(count_data),
                'errors': error_list
            }
            
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'error': f'處理檔案時發生錯誤: {str(e)}'}
