#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
sys.path.append(os.path.dirname(__file__))

from models.inventory import Transaction
import sqlite3

# 檢查交易記錄
print('📊 檢查交易記錄資料...')
transactions = Transaction.get_transactions(limit=5)

if transactions:
    print(f'✅ 找到 {len(transactions)} 筆交易記錄')
    for i, trans in enumerate(transactions, 1):
        print(f'交易 {i}:')
        print(f'  - 零件: {trans.get("part_number")} ({trans.get("part_name")})')
        print(f'  - 倉庫: {trans.get("warehouse_name")}')
        print(f'  - 數量: {trans.get("quantity")}')
        print(f'  - 類型: {trans.get("transaction_type")}')
        print(f'  - 時間: {trans.get("transaction_date")}')
        print()
else:
    print('❌ 沒有找到交易記錄')
    
    # 檢查是否有庫存記錄
    conn = sqlite3.connect('inventory_management.db')
    cursor = conn.cursor()
    
    # 檢查交易表
    cursor.execute('SELECT COUNT(*) FROM inventory_transactions')
    count = cursor.fetchone()[0]
    print(f'資料庫中有 {count} 筆交易記錄')
    
    if count > 0:
        cursor.execute('SELECT * FROM inventory_transactions LIMIT 3')
        raw_records = cursor.fetchall()
        print('原始記錄:')
        for record in raw_records:
            print(f'  {record}')
    
    conn.close()