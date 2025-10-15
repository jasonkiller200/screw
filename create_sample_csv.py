#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv

# 建立正確編碼的 CSV 檔案
with open('sample_count_data_fixed.csv', 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['part_number', 'part_name', 'unit', 'system_quantity', 'counted_quantity', 'notes'])
    writer.writerow(['P001', '螺絲 M6x20', '個', '100', '98', '實盤少2個'])
    writer.writerow(['P002', '墊片 φ6', '個', '50', '52', '實盤多2個'])
    writer.writerow(['P003', '螺帽 M6', '個', '80', '80', '數量正確'])
    writer.writerow(['P004', '彈簧墊片 M6', '個', '30', '28', '實盤少2個'])
    writer.writerow(['P005', '平墊片 M8', '個', '60', '60', '數量正確'])

print('✅ 正確編碼的 CSV 檔案已建立：sample_count_data_fixed.csv')