# 專案進度與工單整合升級計畫

## 一、目前進度總結

### 1. JavaScript 外部化重構 (已完成)
已將所有 HTML 模板中的內嵌 JavaScript 程式碼，根據其特性和對後端資料的依賴程度，分別外部化到 `static/js/` 目錄下的獨立 `.js` 檔案中。這提升了程式碼的組織性、可維護性及瀏覽器快取效率。

**已處理檔案列表：**
*   `parts.html` -> `static/js/parts.js`
*   `orders.html` -> `static/js/orders.js`
*   `inventory/index.html` -> `static/js/inventory/index.js`
*   `part_lookup.html` -> `static/js/part_lookup.js`
*   `inventory/new_stock_count.html` -> `static/js/inventory/new_stock_count.js`
*   `inventory/stock_counts.html` -> `static/js/inventory/stock_counts.js`
*   `inventory/stock_in.html` -> `static/js/inventory/stock_in.js`
*   `inventory/stock_out.html` -> `static/js/inventory/stock_out.js`
*   `base.html` -> `static/js/pwa.js`
*   `camera_test.html` -> `static/js/camera_test.js`
*   `pwa_install.html` -> `static/js/pwa_install.js`
*   `pwa_test.html` -> `static/js/pwa_test.js`
*   `part_form.html` -> `static/js/part_form.js`
*   `inventory/stock_count_detail.html` -> `static/js/inventory/stock_count_detail.js`
*   `warehouse_locations.html` -> `static/js/warehouse_locations.js`
*   `inventory/transactions.html` -> `static/js/inventory/transactions.js`

### 2. 零件列表分頁與優化 (已完成)
*   為 `/parts` 頁面實作了分頁功能，以提升處理大量資料時的效能。
*   新增了可配置的「每頁顯示筆數」選擇器 (50, 100, 150, 200)。
*   修改了 `Part.get_all` 方法，使其支援分頁，並能同時依零件編號或名稱進行搜尋。
*   更新了 `web_controller.py` 以處理分頁參數。
*   建立了 `_pagination.html` 宏，用於可重用的分頁控制項。
*   修正了 `_pagination.html` 中 `pagination.offset` 導致的 `UndefinedError`。

### 3. 出入庫表單優化 (已完成)
*   在 `/inventory/stock-in` 和 `/inventory/stock-out` 頁面：
    *   在零件編號輸入框旁新增了零件名稱顯示，以方便使用者確認。
    *   「目標/來源倉庫」下拉選單現在會根據所選零件，只顯示與該零件相關聯的倉庫，避免選錯。
*   修正了 `TypeError: Object of type Undefined is not JSON serializable` 錯誤，確保 `part.locations` 在傳遞給 JavaScript 時能正確序列化。

### 4. 盤點編輯功能 (已完成)
*   實作了缺失的「編輯盤點」功能。
*   在 `models/inventory.py` 中新增了 `StockCount.update_count` 方法。
*   在 `web_controller.py` 中新增了 `/inventory/stock-counts/<id>/edit` 路由。
*   建立了 `edit_stock_count.html` 模板。
*   更新了 `stock_counts.js` 以導向至編輯頁面。

### 5. API 增強 (已完成)
*   在 `api_controller.py` 中新增了 `/api/warehouses` 端點，用於獲取所有活躍倉庫列表。
*   在 `api_controller.py` 中新增了 `/api/parts/search` 端點，用於依零件編號或名稱搜尋零件。

## 二、工單整合升級計畫 (待處理)

### 1. 目標
*   將實際的出庫記錄與原始工單需求進行比對，以掌握領料進度。
*   讓作業人員在處理工單時，能即時看到該工單所需的零件清單。

### 2. `screw.xlsx` 檔案分析 (更新)
*   檔案提供工單的原始需求資料，包含 `訂單`、`物料`、`需求數量`、`物料說明`、`需求日期` 等。
*   **重要變更**：此檔案不包含 `領料數量` 和 `未結數量`。這表示這些追蹤資訊需要由系統內部維護。

### 3. 調整後的初步整合方案

#### a. 資料庫設計
*   **建立新的資料庫表格 `WorkOrderDemand`**：
    *   包含 `order_id` (訂單), `part_number` (物料), `required_quantity` (需求數量), `material_description` (物物料說明), `operation_description` (作業說明), `parent_material_description` (上層物料說明), `required_date` (需求日期), `bulk_material` (散裝物料)。
    *   **暫時不包含** `requisitioned_quantity` (已領料數量) 和 `outstanding_quantity` (未結數量) 欄位，這些將在後續階段加入。
    *   設定 `(order_id, part_number)` 為唯一約束，以確保每個工單的每個物料需求是唯一的。

#### b. 資料匯入功能
*   開發一個功能，可以將 `screw.xlsx` 檔案匯入到 `WorkOrderDemand` 表格中。
*   匯入時，系統會根據 Excel 提供的 `order_id` 和 `part_number` 進行判斷：
    *   如果記錄不存在，則新增。
    *   如果記錄已存在，則更新 `required_quantity` 及其他相關資訊。

#### c. 出庫流程改造 (未來階段)
*   在出庫介面中新增『工單領用』的異動類型。
*   使用者選擇工單後，系統顯示該工單的零件需求清單。
*   記錄實際領料數量，並在系統內部追蹤 `requisitioned_quantity` 和 `outstanding_quantity`。

#### d. 採購建議 (未來階段)
*   根據 `required_date` 和系統內部追蹤的 `outstanding_quantity` 提供採購建議。

## 三、當前阻礙：Alembic 遷移問題

### 問題描述
在嘗試為 `WorkOrderDemand` 模型生成資料庫遷移腳本時，Alembic 持續回報 `INFO [alembic.env] No changes in schema detected.`。這表示 Alembic 未能偵測到 `WorkOrderDemand` 模型，導致無法生成遷移腳本。

### 已嘗試的解決方案
1.  確認 `WorkOrderDemand` 模型已定義在 `models/work_order.py`。
2.  在 `models/__init__.py` 中匯入 `WorkOrderDemand`。
3.  在 `app.py` 中匯入 `WorkOrderDemand`。
4.  在 `migrations/alembic.ini` 中設定 `script_location = migrations`。
5.  修改 `migrations/env.py`，使其在 `app.app_context()` 中執行相關邏輯，以確保 Flask 應用程式上下文可用，並明確匯入所有模型。
6.  執行 Alembic 命令時，已設定 `FLASK_APP=app.py` 和 `PYTHONPATH=.`。

### 待解決
儘管已採取上述所有步驟，Alembic 仍未能偵測到 `WorkOrderDemand` 模型。這表示 `db.metadata` 仍未正確收集到 `WorkOrderDemand` 模型。我們需要進一步調查為何模型未被 Alembic 偵測到。
