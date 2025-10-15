# 系統更新摘要

## 更新日期: 2025-10-15

## 主要修改項目

### 1. 資料庫遷移
- ✅ 完成資料庫遷移初始化
- ✅ 新增 `location_code` 欄位到 `order_history` 表
- 執行命令: `flask db migrate` 和 `flask db upgrade`

### 2. Order 模型更新
**檔案**: `models/order.py`
- 新增 `location_code` 欄位（String(100), nullable=True）
- 更新 `to_dict()` 方法，包含 location_code
- 更新 `create()` 方法，接受 location_code 參數

### 3. API 控制器修復
**檔案**: `controllers/api_controller.py`

#### `/api/part/<part_number>` (零件查詢)
- ✅ 修復 order_history 序列化問題
- 確保返回字典列表而非 Order 對象
- 添加空列表檢查：`order_history_data = [order.to_dict() for order in order_history] if order_history else []`

#### `/api/order` (建立訂單)
- 接受新參數 `location_code`
- 調用 `Order.create()` 時傳遞 location_code

### 4. 零件查詢頁面增強
**檔案**: `templates/part_lookup.html`

#### 訂單模態框更新
- 新增儲位選擇下拉選單
- 顯示零件所有儲位供選擇
- HTML 結構:
  ```html
  <select class="form-select" id="orderLocation" required>
      <option value="">請選擇儲位</option>
  </select>
  ```

#### JavaScript 更新
- 新增全局變數 `currentPartLocations` 保存當前零件儲位
- `openOrderModal()` 函數：動態填充儲位選項
- `showResults()` 函數：保存查詢結果中的儲位資訊
- `submitOrder` 事件：提交時包含 location_code

#### 庫存顯示增強
- 在零件查詢結果中顯示各倉庫的倉位資訊
- 表格新增「倉位」欄位

### 5. 訂單管理頁面更新
**檔案**: `templates/orders.html`

#### 待處理訂單表格
- 新增「倉庫」欄位
- 新增「儲位」欄位
- 顯示 `order.warehouse_name` 和 `order.location_code`

#### 所有訂單歷史表格
- 同樣新增「倉庫」和「儲位」欄位
- 無資料時顯示 '-'

### 6. 功能說明

#### 建立訂單時選擇儲位
1. 在零件查詢頁面搜尋零件
2. 點擊「建立訂單」按鈕
3. 選擇訂購數量
4. **從下拉選單選擇目標儲位**（必填）
5. 確認訂購

#### 訂單管理查看儲位
- 待處理訂單列表顯示每個訂單的目標倉庫和儲位
- 所有訂單歷史同樣顯示完整儲位資訊
- 便於識別哪個儲位需要補貨

## API 變更

### POST /api/order
**新增請求參數**:
```json
{
  "part_number": "010000033800",
  "quantity_ordered": 100,
  "location_code": "A1-01-02"  // 新增
}
```

### GET /api/part/{part_number}
**回應格式** (無變更，但確保正確序列化):
```json
{
  "part_info": {
    "part_number": "...",
    "locations": [
      {
        "warehouse_id": 1,
        "warehouse_name": "主倉庫",
        "location_code": "A1-01-02"
      }
    ]
  },
  "inventories": [...],
  "order_history": [...]  // 確保為陣列而非對象
}
```

## 資料庫 Schema 變更

### order_history 表
```sql
ALTER TABLE order_history ADD COLUMN location_code VARCHAR(100);
```

## 測試檢查清單

- [x] 資料庫遷移執行成功
- [x] 應用正常啟動 (https://192.168.6.119:5005)
- [ ] 零件查詢功能正常
- [ ] 建立訂單時可選擇儲位
- [ ] 訂單列表顯示儲位資訊
- [ ] 匯出盤點清單為 Excel 格式
- [ ] Excel 欄寬自動調整

## 已知問題修復

1. ✅ **Order 對象序列化錯誤** - 已修復 API 返回格式
2. ✅ **location_code 欄位不存在** - 已透過資料庫遷移添加
3. ✅ **訂單缺少儲位資訊** - 已在模型和模板中添加

## 後續建議

1. 考慮在訂單確認時驗證儲位是否仍然屬於該零件
2. 可添加儲位庫存不足警告
3. 建議在訂單列表添加篩選功能（依倉庫/儲位）
4. 考慮添加儲位使用率統計

## 相關文件
- PART_LOOKUP_FIX.md - 零件查詢修復文檔
- WAREHOUSE_LOCATION_GUIDE.md - 倉庫位置指南
- INVENTORY_ROUTES_CHECK.md - 庫存路由檢查
