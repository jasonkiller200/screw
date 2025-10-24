## 專案藍圖：盤點管理多儲位支援

**專案目標：**
使庫存盤點管理系統能夠精確追蹤、顯示、匯出及匯入單一零件在不同儲位上的庫存數量，確保盤點數據的儲位級別精確性，並與現有的「單一料號多儲位」庫存策略保持一致。

---

### **階段一：資料庫結構調整 (Database Schema Adjustment)**

**Epic 1.1: 儲位級別庫存追蹤基礎**

*   **User Story 1.1.1: 修改 `CurrentInventory` 模型以支援儲位級別庫存**
    *   **描述：** 調整 `CurrentInventory` 模型，使其能夠追蹤每個零件在特定儲位上的庫存數量，而非僅僅是倉庫總量。
    *   **任務：**
        *   在 `CurrentInventory` 模型中新增 `warehouse_location_id` 欄位 (外鍵指向 `WarehouseLocation.id`)。
        *   移除現有 `('part_id', 'warehouse_id')` 的唯一約束。
        *   新增唯一約束 `('part_id', 'warehouse_location_id')`。
        *   更新 `CurrentInventory` 的 `to_dict()` 方法以包含 `warehouse_location_id` 和 `location_code`。
    *   **驗收標準：**
        *   資料庫遷移腳本成功生成並應用。
        *   `CurrentInventory` 表格包含 `warehouse_location_id` 欄位。
        *   `CurrentInventory` 表格的唯一約束已更新為 `(part_id, warehouse_location_id)`。
        *   `CurrentInventory.to_dict()` 返回的字典包含正確的 `warehouse_location_id` 和 `location_code`。
    *   **進度與備註 (2025-10-23)：** 完成。

*   **User Story 1.1.2: 修改 `StockCountDetail` 模型以支援儲位級別盤點**
    *   **描述：** 調整 `StockCountDetail` 模型，使其能夠為同一個零件在不同儲位上建立獨立的盤點明細。
    *   **任務：**
        *   在 `StockCountDetail` 模型中新增 `warehouse_location_id` 欄位 (外鍵指向 `WarehouseLocation.id`)。
        *   移除現有 `('stock_count_id', 'part_id')` 的唯一約束。
        *   新增唯一約束 `('stock_count_id', 'part_id', 'warehouse_location_id')`。
    *   **驗收標準：**
        *   資料庫遷移腳本成功生成並應用。
        *   `StockCountDetail` 表格包含 `warehouse_location_id` 欄位。
        *   `StockCountDetail` 表格的唯一約束已更新為 `(stock_count_id, part_id, warehouse_location_id)`。
    *   **進度與備註 (2025-10-23)：** 完成。

---

### **階段二：後端邏輯重構 (Backend Logic Refactoring)**

**Epic 2.1: 盤點明細生成與查詢**

*   **User Story 2.1.1: 調整 `StockCount.create_count()` 以生成儲位級別明細**
    *   **描述：** 修改盤點建立邏輯，使其為每個零件在每個儲位上生成一個獨立的 `StockCountDetail` 條目。
    *   **任務：**
        *   修改 `create_count` 方法，使其遍歷目標倉庫中所有 `PartWarehouseLocation` 關聯，為每個關聯建立一個 `StockCountDetail`。
        *   每個 `StockCountDetail` 的 `system_quantity` 應從 `CurrentInventory` 中獲取該零件在**特定儲位**的數量。
    *   **驗收標準：**
        *   建立新盤點後，`StockCountDetail` 表格中，同一個 `part_id` 在同一個 `stock_count_id` 下，若存在於多個儲位，則會有多個 `StockCountDetail` 條目，每個條目對應一個 `warehouse_location_id`。
        *   每個 `StockCountDetail` 的 `system_quantity` 應準確反映該零件在對應儲位的系統庫存。
    *   **進度與備註 (2025-10-23)：** 完成。

*   **User Story 2.1.2: 調整 `StockCount.get_count_details()` 以查詢儲位級別明細**
    *   **描述：** 修改盤點明細查詢邏輯，使其能夠正確返回儲位級別的盤點數據。
    *   **任務：**
        *   修改 `get_count_details` 方法的查詢，確保它能正確地從 `StockCountDetail` 中獲取每個零件-儲位組合的數據。
        *   更新排序邏輯，以支援按儲位代碼進行排序。
    *   **驗收標準：**
        *   呼叫 `get_count_details` 後，返回的列表應包含每個零件-儲位組合的獨立條目。
        *   排序功能（特別是按儲位排序）應正常工作。
    *   **進度與備註 (2025-10-23)：** 完成。

*   **User Story 2.1.3: 調整 `StockCountDetail.to_dict()` 以返回儲位資訊**
    *   **描述：** 修改 `StockCountDetail` 的字典轉換方法，使其返回其自身條目所對應的特定儲位代碼。
    *   **任務：**
        *   修改 `to_dict()` 方法，使其直接從 `self.warehouse_location` 獲取 `location_code`，而不是聚合所有儲位。
    *   **驗收標準：**
        *   `StockCountDetail.to_dict()` 返回的字典包含單一且正確的 `location_code`。
    *   **進度與備註 (2025-10-23)：** 完成。在修改 `StockCountDetail` 模型時一併完成。

**Epic 2.2: 盤點操作邏輯更新**

*   **User Story 2.2.1: 更新 `update_count_item` 和 `update_count_detail` 支援儲位**
    *   **描述：** 修改更新盤點明細的邏輯，使其能夠根據 `part_id` 和 `warehouse_location_id` 精確更新特定儲位的實盤數量。
    *   **任務：**
        *   修改 `update_count_item` 和 `update_count_detail` 方法的查詢條件，加入 `warehouse_location_id`。
        *   更新前端 API 接口，使其在更新時能傳遞 `warehouse_location_id`。
    *   **驗收標準：**
        *   透過 API 更新盤點明細時，能夠精確更新特定零件在特定儲位的實盤數量。
    *   **進度與備註 (2025-10-23)：** 完成。

*   **User Story 2.2.2: 調整 `complete_count()` 的庫存調整邏輯**
    *   **描述：** 確保完成盤點並應用調整時，庫存調整是針對每個零件在每個儲位的差異進行。
    *   **任務：**
        *   修改 `complete_count` 方法中呼叫 `CurrentInventory.update_stock` 的邏輯，使其傳遞 `warehouse_location_id`。
        *   確保 `CurrentInventory.update_stock` 能夠處理儲位級別的庫存更新。
    *   **驗收標準：**
        *   完成盤點並應用調整後，`CurrentInventory` 中每個零件在每個儲位的庫存數量應根據盤點差異正確更新。
    *   **進度與備註 (2025-10-23)：** 完成。此任務的實作過程中，發現 `InventoryTransaction` 模型也需要增加儲位追蹤，已一併修改並完成資料庫遷移。

---

### **階段三：前端介面與匯出/匯入功能 (Frontend & Export/Import)**

**Epic 3.1: 盤點明細頁面顯示**

*   **User Story 3.1.1: 調整 `stock_count_detail.html` 顯示儲位級別明細**
    *   **描述：** 確保盤點明細頁面能夠為同一個零件在不同儲位上顯示獨立的行。
    *   **任務：**
        *   確認 `stock_count_detail.html` 中的表格迭代邏輯，它應該會自動適應後端返回的儲位級別數據。
        *   調整「實盤數量」輸入框的 `data` 屬性，使其包含 `data-location-id`。
    *   **驗收標準：**
        *   在 `stock_count_detail.html` 頁面中，若一個零件存在於多個儲位，則會顯示多行，每行代表一個零件-儲位組合。
        *   每行顯示的儲位資訊應為該行對應的特定儲位。
    *   **進度與備註 (2025-10-23)：** 完成。

*   **User Story 3.1.2: 更新 `stock_count_detail.js` 處理儲位級別更新**
    *   **描述：** 修改前端 JavaScript 邏輯，使其在保存盤點項目時，能夠正確地傳遞 `warehouse_location_id`。
    *   **任務：**
        *   修改 `saveCountItem` 函式，從輸入框的 `data-location-id` 屬性獲取儲位 ID，並將其包含在發送到後端的請求中。
    *   **驗收標準：**
        *   透過前端介面更新實盤數量時，後端能夠接收到正確的 `part_id` 和 `warehouse_location_id`，並成功更新。
    *   **進度與備註 (2025-10-23)：** 完成。

**Epic 3.2: 盤點數據匯出與匯入**

*   **User Story 3.2.1: 調整 `export_count_template` 匯出儲位級別數據**
    *   **描述：** 修改盤點數據匯出功能，使其生成的 Excel 檔案中，每個零件-儲位組合都作為獨立的一行。
    *   **任務：**
        *   修改 `export_count_template` 函式，使其在遍歷 `details` 時，為每個 `StockCountDetail` 條目（即每個零件-儲位組合）生成一行數據。
        *   確保 Excel 檔案包含明確的儲位代碼欄位。
    *   **驗收標準：**
        *   匯出的 Excel 檔案中，同一個零件若存在於多個儲位，則會有多行數據，每行明確標示其儲位。
    *   **進度與備註 (2025-10-23)：** 完成。經分析，由於先前已重構底層資料獲取方法，此功能無需修改程式碼即可正常運作。

*   **User Story 3.2.2: 調整 `import_count_data_batch` 匯入儲位級別數據**
    *   **描述：** 修改盤點數據匯入功能，使其能夠正確解析包含儲位資訊的 Excel 檔案，並將實盤數量更新到對應的零件-儲位組合。
    *   **任務：**
        *   修改 `import_count_data_batch` 函式，使其能夠從匯入的 Excel 檔案中讀取儲位代碼。
        *   在更新 `StockCountDetail` 時，使用 `part_id` 和 `warehouse_location_id` 作為查詢條件。
    *   **驗收標準：**
        *   匯入包含儲位資訊的 Excel 檔案後，系統能夠正確更新每個零件在每個儲位的實盤數量。
        *   匯入過程中，若遇到零件編號或儲位代碼不匹配的情況，應有明確的錯誤提示。
    *   **進度與備註 (2025-10-23)：** 完成。

---

### **階段四：訂單管理整合 (Order Management Integration)**

**Epic 4.1: 訂單模型強化**

*   **User Story 4.1.1: 為訂單項目模型新增 `warehouse_location_id`**
    *   **描述：** 修改 `Order` 或 `WeeklyOrderItem` 模型，新增 `warehouse_location_id` 欄位 (外鍵指向 `WarehouseLocation.id`)，以支援訂單項目指定儲位。
    *   **任務：**
        *   在 `models/order.py` 或 `models/weekly_order.py` 中找到相關的訂單項目模型。
        *   新增 `warehouse_location_id` 欄位。
        *   更新 `to_dict()` 方法以包含 `warehouse_location_id` 和 `location_code`。
    *   **驗收標準：**
        *   資料庫遷移腳本成功生成並應用。
        *   訂單項目表格包含 `warehouse_location_id` 欄位。
        *   相關模型的 `to_dict()` 方法返回的字典包含正確的儲位資訊。
    *   **進度與備註 (2025-10-24)：** 完成。已在 `models/order.py` 的 `Order` 模型中新增 `warehouse_location_id` 欄位，移除 `location_code`，並更新了 `to_dict()` 和 `create()` 方法。資料庫遷移已成功應用。

**Epic 4.2: 訂單建立/更新與儲位資訊**

*   **User Story 4.2.1: 修改後端 API/邏輯以處理訂單項目儲位**
    *   **描述：** 更新後端處理訂單建立和更新的 API 或函式，使其能夠接收並儲存訂單項目的 `warehouse_location_id`。
    *   **任務：**
        *   修改 `controllers/weekly_order_controller.py` 中處理訂單建立 (例如 `register_weekly_order`, `batch_register_weekly_order`) 和更新的函式。
        *   確保 `warehouse_location_id` 被正確驗證並儲存到資料庫。
    *   **驗收標準：**
        *   透過 API 建立或更新訂單項目時，能夠成功指定並儲存 `warehouse_location_id`。
        *   若未提供有效的 `warehouse_location_id`，後端應有適當的錯誤處理或預設邏輯。
    *   **進度與備註 (2025-10-24)：** 完成。已修改 `controllers/weekly_order_controller.py` 中的 `register_order()`、`batch_register()` 和 `batch_register_form()` 函式，以接收並儲存 `warehouse_location_id`。

*   **User Story 4.2.2: 更新前端表單以允許儲位選擇**
    *   **描述：** 修改週訂單相關的前端表單 (`templates/weekly_orders/register.html`, `batch_register.html`)，新增儲位選擇功能。
    *   **任務：**
        *   在訂單項目新增/編輯區塊，為每個零件新增一個儲位選擇下拉選單或輸入框。
        *   儲位選擇應根據所選的倉庫和零件進行篩選。
    *   **驗收標準：**
        *   前端表單能夠顯示可用的儲位選項。
        *   使用者能夠為每個訂單項目選擇或輸入儲位。

*   **User Story 4.2.3: 更新前端 JavaScript 以傳送儲位數據**
    *   **描述：** 修改前端 JavaScript 邏輯 (`static/js/weekly_orders/register.js`, `batch_register.js`)，使其在提交訂單時，能夠將儲位資訊傳送給後端。
    *   **任務：**
        *   修改相關 JavaScript 函式，從儲位選擇元件中獲取 `warehouse_location_id`。
        *   將 `warehouse_location_id` 包含在發送到後端的訂單數據中。
    *   **驗收標準：**
        *   前端提交的訂單數據中包含每個訂單項目的 `warehouse_location_id`。

**Epic 4.3: 訂單顯示與處理**

*   **User Story 4.3.1: 更新訂單顯示頁面以顯示儲位**
    *   **描述：** 修改週訂單顯示頁面 (`templates/weekly_orders/review.html`, `index.html` 或其他相關訂單列表頁面)，以顯示每個訂單項目的儲位資訊。
    *   **任務：**
        *   在訂單項目列表中新增一欄，顯示 `location_code`。
    *   **驗收標準：**
        *   訂單顯示頁面能夠清晰地展示每個訂單項目的儲位資訊。

*   **User Story 4.3.2: 調整訂單處理邏輯以使用儲位**
    *   **描述：** 調整訂單處理流程 (例如庫存分配、收貨確認、出貨等)，使其能夠利用訂單項目中指定的儲位資訊。
    *   **任務：**
        *   修改庫存分配邏輯，優先從訂單指定儲位預留庫存。
        *   修改收貨邏輯，將收到的貨物引導至訂單指定儲位。
        *   修改出貨邏輯，從訂單指定儲位扣除庫存。
    *   **驗收標準：**
        *   訂單處理流程能夠正確地根據儲位資訊進行庫存操作。
        *   庫存操作的準確性得到驗證。

**Epic 4.4: 訂單驅動入庫流程**

*   **User Story 4.4.1: 建立「待入庫訂單」列表頁面**
    *   **描述：** 提供一個頁面，顯示所有已審核並等待收貨入庫的訂單。
    *   **任務：**
        *   定義訂單狀態流轉，例如從「已確認」到「待入庫」。
        *   建立後端路由和函式，查詢並返回待入庫訂單列表。
        *   建立前端模板 (`templates/weekly_orders/pending_inbound.html` 或類似) 顯示訂單列表。
    *   **驗收標準：**
        *   系統能正確識別並顯示待入庫狀態的訂單。
        *   頁面能清晰展示待入庫訂單的關鍵資訊。

*   **User Story 4.4.2: 訂單明細頁面新增「入庫」功能**
    *   **描述：** 在待入庫訂單的明細頁面中，為每個物料項目提供「入庫」操作按鈕或功能。
    *   **任務：**
        *   修改訂單明細頁面 (`templates/weekly_orders/review.html` 或新頁面) 的前端介面。
        *   為每個訂單物料項目新增一個「入庫」按鈕或勾選框。
        *   前端 JavaScript 需處理入庫操作的觸發。
    *   **驗收標準：**
        *   使用者能在訂單明細頁面中，針對單個或多個物料項目執行入庫操作。

*   **User Story 4.4.3: 實現批量儲位指定與快速入庫後端邏輯**
    *   **描述：** 開發後端 API 和邏輯，支援根據訂單物料的儲位需求，進行批量快速入庫。
    *   **任務：**
        *   建立後端 API (`/api/weekly_orders/<order_id>/inbound_items`) 接收要入庫的物料項目列表及其數量。
        *   後端邏輯應根據訂單項目中已指定的 `warehouse_location_id` 執行入庫操作。
        *   支援批量處理，一次性處理多個物料項目的入庫。
        *   更新 `CurrentInventory` (儲位級別) 和 `InventoryTransaction` 記錄。
        *   更新訂單項目狀態 (例如，已入庫數量)。
    *   **驗收標準：**
        *   後端 API 能成功處理批量入庫請求。
        *   入庫數量能正確更新到 `CurrentInventory` 中對應的儲位。
        *   `InventoryTransaction` 記錄正確生成。
        *   訂單項目中的已入庫數量得到更新。

*   **User Story 4.4.4: 前端批量入庫操作介面與邏輯**
    *   **描述：** 提供前端介面和 JavaScript 邏輯，支援使用者在訂單明細頁面中選擇多個物料項目，並一次性執行入庫操作。
    *   **任務：**
        *   前端介面提供勾選框，允許使用者選擇多個物料項目。
        *   提供一個「批量入庫」按鈕。
        *   前端 JavaScript 收集選中的物料項目及其數量，並呼叫後端批量入庫 API。
    *   **驗收標準：**
        *   使用者能選擇多個物料項目並點擊「批量入庫」按鈕。
        *   批量入庫操作能成功執行，並顯示結果。


---

**追蹤與維護：**

*   **進度更新：** 每個 User Story 或任務完成後，將其狀態更新為「完成」。
*   **問題記錄：** 任何在開發或測試過程中發現的問題，都應記錄下來並分配給相關人員處理。
*   **驗證：** 每個 User Story 都包含明確的驗收標準，開發完成後需根據這些標準進行測試驗證。
*   **回顧：** 定期（例如每週）回顧進度，討論遇到的挑戰，並根據需要調整計劃。