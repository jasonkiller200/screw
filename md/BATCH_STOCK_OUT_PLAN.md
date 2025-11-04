# 批量出庫功能 (Batch Stock-Out) - 規格驅動開發藍圖

本文件描述了實現批量出庫功能的開發計畫。

## 總體目標

將現有的單一零件出庫流程，改造為支援多品項一次性出庫的批量操作模式，以提升倉管人員的工作效率，並確保資料的一致性。

---

## 第一階段：後端 API 化

**狀態: 已完成**

### 1. 新增批量出庫服務 (`services/inventory_service.py`)

-   **任務**: 建立一個新的服務函式 `perform_batch_stock_out(data)`.
-   **輸入**:
    -   `transaction_type`: 交易類型 (e.g., 'OUT_WORK_ORDER').
    -   `notes`: 備註.
    -   `work_order_id`: 工單號 (可選).
    -   `items`: 一個包含多個出庫品項的列表，每個品項為一個字典，格式如下：
        ```json
        {
          "part_id": 123,
          "warehouse_location_id": 45,
          "quantity": 10
        }
        ```
-   **核心邏輯**:
    -   遍歷 `items` 列表。
    -   對每個品項執行庫存驗證（例如，檢查可用庫存是否足夠）。
    -   呼叫 `CurrentInventory.update_stock()` 更新庫存並產生交易紀錄。
-   **事務處理**:
    -   整個批量操作必須包裹在一個資料庫事務 (Transaction) 中。
    -   如果任何一個品項驗證失敗或更新失敗，整個事務將被回滾 (Rollback)，以確保資料的原子性與一致性。
-   **狀態**: `[x] 完成`

### 2. 建立新的 API 端點 (`controllers/api_controller.py`)

-   **任務**: 建立一個新的 API 路由 `/api/inventory/batch-stock-out`。
-   **方法**: `POST`
-   **功能**:
    -   接收前端傳來的 JSON 格式的批量出庫資料。
    -   呼叫 `InventoryService.perform_batch_stock_out()` 服務來處理業務邏輯。
    -   回傳 JSON 格式的結果（成功訊息或錯誤細節）。
-   **狀態**: `[x] 完成`

---

## 第二階段：前端介面改造

**狀態: 已完成**

### 1. 建立新的批量出庫頁面 (`templates/inventory/batch_stock_out.html`)

-   **任務**: 建立一個全新的 HTML 檔案作為批量出庫的操作介面。
-   **介面佈局**:
    -   **頂部 - 基礎資料區**:
        -   `[x]` 來源倉庫 (下拉選單)。
        -   `[x]` 出庫類型 (下拉選單)。
        -   `[x]` 工單編號 (輸入框，可選)。
        -   `[x]` 備註 (文字區)。
    -   **中部 - 零件清單區**:
        -   `[x]` 選擇倉庫後，透過 AJAX 載入該倉庫的庫存品項。
        -   `[x]` 表格顯示品項，包含：核取方塊、零件編號、零件名稱、可用庫存、出庫數量輸入框。
    -   **底部 - 操作區**:
        -   `[x]` 「確認批量出庫」按鈕。
-   **狀態**: `[x] 完成`

### 2. 編寫對應的 JavaScript (`static/js/inventory/batch_stock_out.js`)

-   **任務**: 建立新的 JS 檔案來處理前端互動邏輯。
-   **核心功能**:
    -   `[x]` 監聽倉庫下拉選單的變更事件，觸發 AJAX 請求以獲取庫存清單。
    -   `[x]` 將獲取到的庫存資料動態渲染到表格中。
    -   `[x]` 提供客戶端驗證（例如，出庫數量不能超過可用庫存）。
    -   `[x]` 監聽「確認批量出庫」按鈕的點擊事件。
    -   `[x]` 收集基礎資料和所有被勾選的品項及其出庫數量，打包成 JSON。
    -   `[x]` 使用 `fetch` API 將 JSON 資料 POST 到 `/api/inventory/batch-stock-out`。
    -   `[x]` 處理 API 的回傳結果，並在頁面上顯示成功或失敗的提示訊息。
-   **狀態**: `[x] 完成`

---

## 第三階段：整合與替換

**狀態: 已完成**

### 1. 新增 Web 路由 (`controllers/web_controller.py`)

-   **任務**: 新增一個路由 `/inventory/batch-stock-out`。
-   **方法**: `GET`
-   **功能**: 渲染 `batch_stock_out.html` 頁面。
-   **狀態**: `[x] 完成`

### 2. 修改庫存主頁 (`templates/inventory/index.html`)

-   **任務**: 將「快捷功能」中的「出庫」按鈕的連結進行修改。
-   **修改內容**:
    -   `[x]` 將 `href` 從 `url_for('web.stock_out')` 改為 `url_for('web.batch_stock_out')`。
-   **狀態**: `[x] 完成`

---
