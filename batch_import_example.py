#!/usr/bin/env python3
"""
批量匯入盤點資料示範腳本
"""

import requests
import csv

def upload_count_data(csv_file_path, warehouse_id):
    """
    批量匯入盤點資料
    
    Args:
        csv_file_path: CSV 檔案路徑
        warehouse_id: 目標倉庫ID
    """
    url = 'http://localhost:5000/api/inventory/import-count-data'
    
    # 準備檔案和資料
    files = {'file': open(csv_file_path, 'rb')}
    data = {'warehouse_id': warehouse_id}
    
    try:
        # 發送請求
        response = requests.post(url, files=files, data=data)
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 匯入成功！")
            print(f"📋 盤點編號: {result.get('count_id')}")
            print(f"📊 處理筆數: {result.get('processed_count')}")
            print(f"📁 總筆數: {result.get('total_rows')}")
            
            if result.get('errors'):
                print("⚠️ 警告訊息:")
                for error in result['errors']:
                    print(f"   - {error}")
        else:
            print(f"❌ 匯入失敗: {response.json().get('error')}")
            
    except Exception as e:
        print(f"❌ 請求錯誤: {e}")
    finally:
        files['file'].close()

if __name__ == "__main__":
    # 示範匯入
    csv_file = "sample_count_data.csv"
    warehouse_id = 1  # 主倉庫
    
    print("🚀 開始批量匯入盤點資料...")
    upload_count_data(csv_file, warehouse_id)