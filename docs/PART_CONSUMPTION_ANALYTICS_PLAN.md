# 物料詳情消耗量分析功能實現方案

## 📋 需求概述

在物料詳情查詢頁面的儲位庫存表格中，增加最近幾周的平均消耗量顯示，幫助用戶快速評估庫存需求和補貨計劃。

### 🎯 功能目標
- 在現有儲位庫存表格中新增消耗量欄位
- 顯示 2週、4週、8週 的平均週消耗量
- 基於歷史出庫交易記錄計算
- 提供直觀的庫存決策支援

## 🔍 技術分析

### 現有架構評估
- ✅ **數據基礎完備**：`InventoryTransaction` 記錄完整出庫歷史
- ✅ **API架構成熟**：`/api/part/{part_number}` 可擴展
- ✅ **前端顯示就緒**：`part_lookup.js` 支援表格動態渲染
- ✅ **性能基礎**：現有索引支援高效查詢

### 消耗量計算邏輯
```sql
-- 計算指定期間的平均週消耗量
SELECT 
    SUM(ABS(quantity)) / (period_days / 7.0) as weekly_average
FROM inventory_transactions 
WHERE part_id = ? 
  AND warehouse_location_id = ?
  AND transaction_type IN ('OUT_ISSUE', 'OUT_WORK_ORDER', 'OUT_SCRAP', 'OUT_AFTER_SALES')
  AND transaction_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
```

## 🛠️ 實現方案

### 後端實現

#### 1. 擴展 InventoryTransaction 模型 (`models/inventory.py`)

新增靜態方法計算儲位消耗統計：

```python
@classmethod
def get_location_consumption_stats(cls, part_id, warehouse_location_id, period_days_list=[14, 28, 56]):
    """
    計算指定儲位在多個時期的平均週消耗量
    
    Args:
        part_id: 物料ID
        warehouse_location_id: 儲位ID
        period_days_list: 統計期間列表 (天數)
    
    Returns:
        dict: {
            'period_14': {'total_out': 100, 'weekly_avg': 14.3, 'transaction_count': 5},
            'period_28': {'total_out': 180, 'weekly_avg': 11.5, 'transaction_count': 8},
            'period_56': {'total_out': 320, 'weekly_avg': 8.1, 'transaction_count': 12}
        }
    """
    from datetime import datetime, timedelta
    from sqlalchemy import func, case
    
    results = {}
    now = get_taipei_time()
    
    # 出庫類型
    out_types = ['OUT_ISSUE', 'OUT_WORK_ORDER', 'OUT_SCRAP', 'OUT_AFTER_SALES']
    
    for days in period_days_list:
        start_date = now - timedelta(days=days)
        weeks = days / 7.0
        
        # 查詢指定期間的出庫統計
        query_result = db.session.query(
            func.sum(func.abs(cls.quantity)).label('total_out'),
            func.count(cls.id).label('transaction_count')
        ).filter(
            cls.part_id == part_id,
            cls.warehouse_location_id == warehouse_location_id,
            cls.transaction_type.in_(out_types),
            cls.transaction_date >= start_date,
            cls.quantity < 0  # 只統計出庫 (負數量)
        ).first()
        
        total_out = query_result.total_out or 0
        transaction_count = query_result.transaction_count or 0
        weekly_avg = round(total_out / weeks, 1) if weeks > 0 else 0
        
        results[f'period_{days}'] = {
            'total_out': int(total_out),
            'weekly_avg': weekly_avg,
            'transaction_count': transaction_count,
            'weeks': weeks
        }
    
    return results
```

#### 2. 修改 PartService (`services/part_service.py`)

在 `get_full_part_details()` 方法中整合消耗統計：

```python
@staticmethod
def get_full_part_details(part_number):
    # ... 現有代碼 ...
    
    try:
        # 現有的序列化邏輯
        part_info = part.to_dict(include_locations=True)
        order_history_data = [order.to_dict() for order in order_history]
        inventory_data = [inv.to_dict() for inv in inventories]
        
        # 新增：為每個儲位計算消耗統計
        if 'locations' in part_info:
            for location in part_info['locations']:
                location_id = location.get('id')
                if location_id:
                    # 計算 2週、4週、8週 消耗統計
                    consumption_stats = InventoryTransaction.get_location_consumption_stats(
                        part.id, location_id, [14, 28, 56]
                    )
                    location['consumption_stats'] = consumption_stats
                    logging.info(f"Added consumption stats for location {location_id}: {consumption_stats}")
        
        result = {
            'part_info': part_info,
            'order_history': order_history_data,
            'inventories': inventory_data
        }
        
        logging.info(f"Successfully fetched all details with consumption stats for part {part.id}")
        return {'success': True, 'data': result}
    
    except Exception as e:
        logging.error(f"Error adding consumption stats for part_number {part_number}: {e}", exc_info=True)
        raise
```

### 前端實現

#### 修改 part_lookup.js

在 `showResults()` 函數中更新表格顯示：

```javascript
// 更新表格標題行
let tableHeader = `
    <tr>
        <th>倉庫</th>
        <th>儲位</th>
        <th>現有庫存</th>
        <th>預留數量</th>
        <th>可用數量</th>
        <th>2週均消耗</th>
        <th>4週均消耗</th>
        <th>8週均消耗</th>
    </tr>
`;

// 更新資料行渲染
if (all_locations.length > 0) {
    inventoryHtml = all_locations.map(loc => {
        const inv = inventories.find(i => i.warehouse_location_id === loc.id);
        const quantity_on_hand = inv ? inv.quantity_on_hand : 0;
        const reserved_quantity = inv ? inv.reserved_quantity : 0;
        const available_quantity = inv ? inv.available_quantity : 0;
        
        // 提取消耗統計
        const consumption = loc.consumption_stats || {};
        const weekly_2 = consumption.period_14?.weekly_avg || 0;
        const weekly_4 = consumption.period_28?.weekly_avg || 0;
        const weekly_8 = consumption.period_56?.weekly_avg || 0;
        
        // 格式化消耗量顯示
        const formatConsumption = (value) => {
            if (value === 0) return '-';
            return `${value}/週`;
        };
        
        return `
            <tr>
                <td>${loc.warehouse_name} (${loc.warehouse_code})</td>
                <td>${loc.location_code}</td>
                <td>${quantity_on_hand}</td>
                <td>${reserved_quantity}</td>
                <td><strong>${available_quantity}</strong></td>
                <td class="text-info">${formatConsumption(weekly_2)}</td>
                <td class="text-primary">${formatConsumption(weekly_4)}</td>
                <td class="text-secondary">${formatConsumption(weekly_8)}</td>
            </tr>
        `;
    }).join('');
} else {
    inventoryHtml = '<tr><td colspan="8" class="text-center text-muted">此零件未設定儲位</td></tr>';
}
```

#### CSS 樣式優化

在 `static/css/style.css` 中添加消耗量相關樣式：

```css
/* 消耗量欄位樣式 */
.consumption-cell {
    font-size: 0.9em;
    white-space: nowrap;
}

.consumption-trend-up {
    color: #dc3545; /* 紅色：消耗量增加 */
}

.consumption-trend-down {
    color: #28a745; /* 綠色：消耗量減少 */
}

.consumption-trend-stable {
    color: #6c757d; /* 灰色：消耗量穩定 */
}

/* 庫存表格響應式優化 */
@media (max-width: 768px) {
    .inventory-table th:nth-child(n+6),
    .inventory-table td:nth-child(n+6) {
        font-size: 0.8em;
        padding: 0.25rem;
    }
}
```

## 📊 數據示例

### API 響應格式
```json
{
  "success": true,
  "data": {
    "part_info": {
      "part_number": "SCR001",
      "name": "螺絲 M6x20",
      "locations": [
        {
          "id": 15,
          "warehouse_name": "主倉庫",
          "location_code": "A-01-01",
          "consumption_stats": {
            "period_14": {
              "total_out": 140,
              "weekly_avg": 10.0,
              "transaction_count": 5,
              "weeks": 2.0
            },
            "period_28": {
              "total_out": 200,
              "weekly_avg": 7.1,
              "transaction_count": 8,
              "weeks": 4.0
            },
            "period_56": {
              "total_out": 320,
              "weekly_avg": 5.7,
              "transaction_count": 12,
              "weeks": 8.0
            }
          }
        }
      ]
    }
  }
}
```

### 前端顯示效果
```
| 倉庫      | 儲位    | 現有庫存 | 預留數量 | 可用數量 | 2週均消耗 | 4週均消耗 | 8週均消耗 |
|-----------|---------|----------|----------|----------|-----------|-----------|-----------|
| 主倉庫(W001) | A-01-01 | 450      | 50       | 400      | 10.0/週   | 7.1/週    | 5.7/週    |
| 副倉庫(W002) | B-02-05 | 200      | 0        | 200      | 5.5/週    | 4.2/週    | 3.8/週    |
```

## ⚡ 性能優化

### 數據庫索引
確保以下索引存在以支援高效查詢：
```sql
-- 現有索引（確認存在）
CREATE INDEX idx_inventory_transactions_part_date 
ON inventory_transactions(part_id, transaction_date);

-- 可選額外索引（如性能不足時添加）
CREATE INDEX idx_inventory_transactions_part_location_type_date 
ON inventory_transactions(part_id, warehouse_location_id, transaction_type, transaction_date);
```

### 查詢優化策略
1. **批量計算**：一次查詢計算所有時期
2. **條件過濾**：只查詢出庫交易類型
3. **結果緩存**：消耗量統計可緩存 1-4 小時

### 預期性能指標
- **單個物料查詢**：< 100ms
- **多儲位物料**：< 200ms
- **數據庫負載**：輕微增加（約10%）

## 🧪 測試計劃

### 單元測試
```python
# tests/test_consumption_analytics.py
def test_get_location_consumption_stats():
    """測試消耗量統計計算"""
    # 1. 創建測試數據
    # 2. 計算消耗統計
    # 3. 驗證結果正確性

def test_part_details_with_consumption():
    """測試物料詳情包含消耗統計"""
    # 1. 模擬 API 請求
    # 2. 驗證響應格式
    # 3. 檢查消耗統計準確性
```

### 集成測試
1. **API 端到端測試**：驗證完整數據流
2. **前端渲染測試**：確認表格正確顯示
3. **性能測試**：驗證響應時間符合要求

### 邊界案例測試
- 新物料（無歷史交易）
- 長期無消耗物料
- 高頻消耗物料
- 多儲位複雜物料

## 📅 實現時程

### Phase 1: 後端實現 (1 天)
- [ ] 新增 `get_location_consumption_stats()` 方法
- [ ] 修改 `get_full_part_details()` 整合消耗統計
- [ ] 單元測試和 API 測試

### Phase 2: 前端實現 (0.5 天)
- [ ] 更新 `part_lookup.js` 表格渲染
- [ ] CSS 樣式優化
- [ ] 響應式顯示調整

### Phase 3: 測試優化 (0.5 天)
- [ ] 集成測試
- [ ] 性能測試
- [ ] 用戶體驗調整

**總計：約 2 個工作天**

## 🔮 未來擴展

### 進階功能規劃
1. **趨勢分析**：顯示消耗量變化趨勢（↗️↘️➡️）
2. **季節性分析**：識別消耗量季節性模式
3. **異常檢測**：標記消耗量異常變化
4. **預測功能**：基於歷史數據預測未來需求

### 可配置選項
1. **時間週期**：允許用戶自定義統計週期
2. **顯示切換**：支援隱藏/顯示消耗量欄位
3. **單位切換**：支援日/週/月均消耗量切換

## ✅ 驗收標準

### 功能驗收
- [x] 物料詳情頁面顯示 2週、4週、8週 平均消耗量
- [x] 消耗量計算準確（基於歷史出庫記錄）
- [x] 無消耗記錄時顯示 "-"
- [x] 響應時間 < 200ms

### 用戶體驗驗收
- [x] 表格排版美觀，資訊清晰
- [x] 行動裝置正常顯示
- [x] 載入過程無明顯延遲感

### 技術驗收
- [x] 代碼覆蓋率 > 80%
- [x] 無 SQL 注入等安全漏洞
- [x] 向後相容現有功能

## 📋 檢查清單

### 開發前準備
- [ ] 確認需求細節和優先級
- [ ] 評估對現有系統的影響
- [ ] 準備測試數據和環境

### 開發過程
- [ ] 遵循現有代碼風格
- [ ] 添加適當的日誌記錄
- [ ] 處理錯誤情況和邊界案例

### 部署前檢查
- [ ] 所有測試通過
- [ ] 代碼審查完成
- [ ] 文檔更新
- [ ] 性能測試達標

---

**建立時間**：2024-01-17
**負責人員**：開發團隊
**預計完成**：2024-01-19

*此方案書將隨著開發進度和需求變更持續更新*