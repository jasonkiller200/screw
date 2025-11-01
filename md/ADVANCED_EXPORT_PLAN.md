# 「進階匯出」功能規劃書

**版本:** 1.0
**日期:** 2025-11-01
**狀態:** 規劃中

## 1. 目標

本功能旨在提供一個強大且靈活的「進階匯出」工具，允許使用者自訂匯出的庫存報告。使用者將能夠自由選擇要匯出的欄位、設定多樣化的篩選條件、指定排序方式以及選擇匯出格式（如 Excel 或 CSV）。

## 2. 功能設計

### 2.1 使用者介面 (UI)

當使用者點擊「庫存清單」頁面上的「進階匯出選項」按鈕時，會彈出一個「進階匯出」的設定視窗 (Modal)。

**視窗佈局:**

- **標題:** 進階匯出選項
- **內容將分為三大區塊：**

    1.  **欄位選擇 (Columns):**
        - 以多選核取方塊 (Checkboxes) 的形式，列出所有可供匯出的欄位。
        - 預設勾選常用欄位。
        - **可選欄位範例:**
            - [x] 零件編號
            - [x] 零件名稱
            - [ ] 零件描述
            - [x] 倉庫名稱
            - [x] 儲位代碼
            - [x] 現有庫存
            - [x] 可用庫存
            - [ ] 預留數量
            - [x] 安全庫存
            - [x] 補貨點
            - [ ] 單位
            - [ ] 零件類型
            - [ ] 最後更新時間

    2.  **篩選條件 (Filters):**
        - **倉庫:** 多選下拉選單，可選擇一個或多個倉庫。
        - **零件類型:** 多選下拉選單，可篩選特定零件類型。
        - **庫存狀態:** 下拉選單（全部、正常、低庫存、缺貨）。
        - **可用庫存:** 範圍輸入框（例如：`可用庫存介於 [ 10 ] 到 [ 100 ] 之間`）。

    3.  **排序與格式 (Sorting & Format):**
        - **排序欄位:** 下拉選單，可選擇任一已選的欄位進行排序。
        - **排序方式:** 單選按鈕（`遞增` / `遞減`）。
        - **匯出格式:** 單選按鈕（`Excel (.xlsx)` / `CSV (.csv)`）。

- **按鈕:**
    - `取消`
    - `產生報告`

### 2.2 後端設計 (Backend)

1.  **API 端點:**
    - 建立一個新的 API 端點：`POST /api/inventory/advanced-export`
    - 此端點接收一個 JSON 物件，包含前端 UI 上所有的使用者選項。

2.  **請求 Payload 結構範例:**
    ```json
    {
      "columns": ["part_number", "part_name", "quantity_on_hand"],
      "filters": {
        "warehouse_ids": [1, 3],
        "stock_status": "low_stock",
        "available_quantity_min": 10,
        "available_quantity_max": 100
      },
      "sorting": {
        "sort_by": "quantity_on_hand",
        "sort_order": "asc"
      },
      "format": "xlsx"
    }
    ```

3.  **服務層 (Service Layer):**
    - 在 `InventoryService` 中建立一個新方法：`generate_advanced_export(options)`。
    - **職責:**
        - 接收包含所有選項的 `options` 物件。
        - **動態建立查詢:** 根據 `options.filters` 中的條件，使用 SQLAlchemy 動態建立資料庫查詢。
        - **動態排序:** 根據 `options.sorting` 設定 `order_by()`。
        - **執行查詢:** 從資料庫獲取資料。
        - **格式化資料:** 使用 `pandas` 建立 DataFrame，並只保留 `options.columns` 中指定的欄位。
        - **生成檔案:** 根據 `options.format` 的值，將 DataFrame 轉換為 Excel 或 CSV 格式的位元組流 (bytes)。
        - **返回結果:** 返回一個包含 (檔案內容, 檔名) 的元組 (tuple)。

4.  **控制器層 (Controller Layer):**
    - `api_controller.py` 中的 `/api/inventory/advanced-export` 路由函式負責：
        - 接收請求並驗證 JSON payload。
        - 呼叫 `InventoryService.generate_advanced_export()`。
        - 接收服務層返回的檔案內容和檔名，並將其作為檔案下載回應給使用者。

## 3. 實作階段

1.  **第一階段 (後端):**
    - [ ] 在 `InventoryService` 中實作 `generate_advanced_export` 方法的核心邏輯。
    - [ ] 在 `api_controller.py` 中建立新的 API 端點，並串接服務。

2.  **第二階段 (前端):**
    - [ ] 在 `templates/inventory/index.html` 中建立「進階匯出」的 Modal HTML 結構。
    - [ ] 在 `static/js/inventory/index.js` 中撰寫 JavaScript 邏輯：
        - [ ] 處理 Modal 的顯示。
        - [ ] 處理「產生報告」按鈕的點擊事件。
        - [ ] 收集所有使用者選項，組成 JSON payload。
        - [ ] 呼叫後端 API 並觸發檔案下載。

3.  **第三階段 (測試與整合):**
    - [ ] 全面測試各種欄位、篩選、排序和格式組合的正確性。
    - [ ] 確認下載的檔案內容符合使用者設定。
