# 零件查詢功能修復說明

## 修復日期
2025-10-15

## 修復的問題

### 1. `openOrderModal` 函數未定義錯誤
**問題描述：**
- 在零件查詢頁面點擊「建立訂單」按鈕時出現錯誤：`Uncaught ReferenceError: openOrderModal is not defined`
- 原因是函數定義在 `DOMContentLoaded` 事件處理器內部，但在 HTML 的 `onclick` 屬性中被調用

**修復方案：**
- 將 `openOrderModal` 函數移到全域作用域，使其可以被 inline HTML 調用
- 修改位置：`templates/part_lookup.html` 第 300 行之前

### 2. 零件查詢頁面缺少各儲位庫存資訊
**問題描述：**
- 零件查詢頁面只顯示零件的基本資訊，但沒有顯示各儲位的實際庫存數量
- 建立訂單時無法參考當前庫存量

**修復方案：**
1. **後端 API 修改** (`controllers/api_controller.py`)：
   - 在 `/api/part/<part_number>` API 中增加查詢 `CurrentInventory` 的邏輯
   - 返回每個儲位的可用庫存數量
   - 包含倉庫名稱、儲位編號和可用數量

2. **前端顯示修改** (`templates/part_lookup.html`)：
   - 在零件資訊卡片中增加「各儲位庫存」表格
   - 顯示倉庫、儲位和可用數量
   - 如果沒有庫存資訊則顯示提示訊息

### 3. 零件 030200332800 倉位清除
**問題描述：**
- 零件編號 030200332800 需要清除其關聯的倉位

**修復方案：**
- 創建並執行臨時腳本清除該零件的所有倉位關聯
- 已成功清除

## 修改的檔案

### 1. templates/part_lookup.html
- 將 `openOrderModal` 函數移到全域作用域
- 在 `showResults` 函數中增加庫存資訊顯示
- 增加庫存表格的 HTML 結構

### 2. controllers/api_controller.py
- 修改 `get_part_details` 函數
- 增加導入 `CurrentInventory` 模型
- 查詢並返回各儲位的庫存資訊
- 改進錯誤訊息為中文

## API 響應格式

### GET /api/part/{part_number}
```json
{
  "part_info": {
    "id": 1,
    "part_number": "010000033800",
    "name": "零件名稱",
    "description": "零件描述",
    "unit": "個",
    "quantity_per_box": 100,
    "safety_stock": 0,
    "reorder_point": 0,
    "standard_cost": 0.0,
    "is_active": true,
    "created_at": "2025-10-15T12:00:00+08:00",
    "locations": [
      {
        "warehouse_name": "倉庫名稱",
        "location_code": "A-1-01"
      }
    ]
  },
  "order_history": [
    {
      "order_date": "2025-10-15",
      "quantity_ordered": 100,
      "status": "confirmed"
    }
  ],
  "inventories": [
    {
      "warehouse_id": 1,
      "warehouse_name": "主倉庫",
      "location_id": 1,
      "location_code": "A-1-01",
      "available_quantity": 500
    }
  ]
}
```

## 測試建議

1. **零件查詢功能測試**：
   - 輸入零件編號進行查詢
   - 確認零件資訊正確顯示
   - 確認各儲位庫存正確顯示
   - 點擊「建立訂單」按鈕，確認模態框正常開啟

2. **條碼掃描測試**：
   - 開啟條碼掃描器
   - 掃描零件條碼
   - 確認自動查詢並顯示結果

3. **庫存資訊測試**：
   - 查詢有多個儲位的零件
   - 確認所有儲位和對應的庫存數量都正確顯示
   - 查詢沒有庫存的零件，確認顯示提示訊息

## 注意事項

1. **Service Worker 警告**：
   - 控制台中可能會出現 Service Worker 註冊失敗的警告
   - 這不影響功能運作，屬於 PWA 相關功能
   - 如需完全移除警告，需要檢查 `sw.js` 檔案的內容

2. **庫存資料依賴**：
   - 庫存資訊來自 `CurrentInventory` 表
   - 需要確保庫存資料正確同步
   - 如果零件沒有庫存記錄，會顯示「暫無庫存資訊」

3. **錯誤處理**：
   - API 返回 404 時顯示「找不到零件」
   - 網路錯誤時顯示友好的錯誤訊息
   - 所有錯誤都會在控制台輸出詳細資訊供除錯使用
