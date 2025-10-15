#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os
sys.path.append('.')

from models.inventory import Transaction

# 檢查交易記錄
print('📊 檢查交易記錄資料...')
transactions = Transaction.get_transactions(limit=3)

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