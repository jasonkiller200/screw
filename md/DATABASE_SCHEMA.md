# 資料庫結構表與關聯說明 (Database Schema and Relationship Description)

本文件詳細說明了專案中使用的所有資料庫表格及其欄位、資料類型、約束和相互關係。

---

## 1. `parts` (零件)

*   **模型檔案 (Model File):** `models/part.py`
*   **說明 (Description):** 儲存所有零件的基本資訊。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `part_number`          | String(100)          | Unique, Not Null   | 零件編號 (Part Number) |
| `name`                 | String(255)          | Not Null           | 零件名稱 (Part Name) |
| `description`          | Text                 | Nullable           | 描述 (Description) |
| `unit`                 | String(50)           | Not Null, Default='個' | 單位 (Unit) |
| `quantity_per_box`     | Integer              | Not Null           | 每盒數量 (Quantity Per Box) |
| `safety_stock`         | Integer              | Default=0          | 安全庫存 (Safety Stock) |
| `reorder_point`        | Integer              | Default=0          | 補貨點 (Reorder Point) |
| `standard_cost`        | Numeric(10, 2)       | Default=0          | 標準成本 (Standard Cost) |
| `is_active`            | Boolean              | Default=True       | 是否啟用 (Is Active) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |

*   **關聯性 (Relationships):**
    *   **`PartWarehouseLocation` (多對多):** 一個零件可存放在多個倉位，一個倉位可存放多個零件。
    *   **`CurrentInventory` (一對多):** 一個零件有多個庫存記錄 (在不同倉庫)。
    *   **`Order` (一對多):** 一個零件有多個訂單歷史記錄。
    *   **`InventoryTransaction` (一對多):** 一個零件有多個庫存交易記錄。
    *   **`StockCountDetail` (一對多):** 一個零件有多個盤點明細記錄。

---

## 2. `warehouses` (倉庫)

*   **模型檔案 (Model File):** `models/part.py`
*   **說明 (Description):** 儲存所有倉庫的基本資訊。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `code`                 | String(50)           | Unique, Not Null   | 倉庫代碼 (Warehouse Code) |
| `name`                 | String(100)          | Not Null           | 倉庫名稱 (Warehouse Name) |
| `description`          | String(255)          | Nullable           | 描述 (Description) |
| `is_active`            | Boolean              | Default=True       | 是否啟用 (Is Active) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |

*   **關聯性 (Relationships):**
    *   **`WarehouseLocation` (一對多):** 一個倉庫有多個倉位。
    *   **`CurrentInventory` (一對多):** 一個倉庫有多個庫存記錄 (包含不同零件)。
    *   **`Order` (一對多):** 一個倉庫有多個訂單歷史記錄。
    *   **`InventoryTransaction` (一對多):** 一個倉庫有多個庫存交易記錄。
    *   **`StockCount` (一對多):** 一個倉庫有多個盤點記錄。

---

## 3. `warehouse_locations` (倉位)

*   **模型檔案 (Model File):** `models/part.py`
*   **說明 (Description):** 儲存每個倉庫下的具體儲存位置資訊。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `warehouse_id`         | Integer              | Foreign Key (`warehouses.id`), Not Null | 倉庫ID (Warehouse ID) |
| `location_code`        | String(100)          | Not Null           | 倉位代碼 (Location Code) |
| `description`          | String(255)          | Nullable           | 描述 (Description) |

*   **約束 (Constraints):**
    *   `_warehouse_location_uc`: `(warehouse_id, location_code)` 組合必須唯一。
*   **關聯性 (Relationships):**
    *   **`Warehouse` (多對一):** 多個倉位屬於一個倉庫。
    *   **`PartWarehouseLocation` (一對多):** 一個倉位可關聯多個零件。

---

## 4. `part_locations` (零件倉位關聯)

*   **模型檔案 (Model File):** `models/part.py`
*   **說明 (Description):** 記錄零件與倉位之間的多對多關聯。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `part_id`              | Integer              | Foreign Key (`parts.id`), Primary Key | 零件ID (Part ID) |
| `warehouse_location_id`| Integer              | Foreign Key (`warehouse_locations.id`), Primary Key | 倉位ID (Warehouse Location ID) |

*   **關聯性 (Relationships):**
    *   **`WarehouseLocation` (多對一):** 關聯到一個具體的倉位。
    *   **`Part` (多對一):** 關聯到一個具體的零件。

---

## 5. `order_history` (訂單歷史)

*   **模型檔案 (Model File):** `models/order.py`
*   **說明 (Description):** 儲存所有零件的訂單歷史記錄。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `part_id`              | Integer              | Foreign Key (`parts.id`), Not Null | 零件ID (Part ID) |
| `warehouse_id`         | Integer              | Foreign Key (`warehouses.id`), Default=1 | 倉庫ID (Warehouse ID) |
| `location_code`        | String(100)          | Nullable           | 儲位代碼 (Location Code) |
| `order_date`           | DateTime             | Default, Not Null  | 訂單日期 (Order Date) |
| `quantity_ordered`     | Integer              | Not Null           | 訂購數量 (Quantity Ordered) |
| `quantity_received`    | Integer              | Default=0          | 已收數量 (Quantity Received) |
| `unit_cost`            | Numeric(10, 2)       | Default=0          | 單價 (Unit Cost) |
| `status`               | String(50)           | Not Null, Default='pending' | 狀態 (Status) |
| `supplier`             | String(255)          | Nullable           | 供應商 (Supplier) |
| `expected_date`        | DateTime             | Nullable           | 預計到貨日期 (Expected Date) |
| `received_date`        | DateTime             | Nullable           | 實際收貨日期 (Received Date) |
| `notes`                | Text                 | Nullable           | 備註 (Notes) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |

*   **關聯性 (Relationships):**
    *   **`Part` (多對一):** 多個訂單歷史記錄關聯到一個零件。
    *   **`Warehouse` (多對一):** 多個訂單歷史記錄關聯到一個倉庫。

---

## 6. `current_inventory` (目前庫存)

*   **模型檔案 (Model File):** `models/inventory.py`
*   **說明 (Description):** 儲存每個零件在每個倉庫的即時庫存資訊。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `part_id`              | Integer              | Foreign Key (`parts.id`), Not Null | 零件ID (Part ID) |
| `warehouse_id`         | Integer              | Foreign Key (`warehouses.id`), Not Null | 倉庫ID (Warehouse ID) |
| `quantity_on_hand`     | Integer              | Default=0          | 現有庫存量 (Quantity On Hand) |
| `reserved_quantity`    | Integer              | Default=0          | 保留數量 (Reserved Quantity) |
| `available_quantity`   | Integer              | Default=0          | 可用數量 (Available Quantity) |
| `last_updated`         | DateTime             | Default, OnUpdate  | 最後更新時間 (Last Updated) |

*   **約束 (Constraints):**
    *   `_part_warehouse_uc`: `(part_id, warehouse_id)` 組合必須唯一。
*   **關聯性 (Relationships):**
    *   **`Part` (多對一):** 多個庫存記錄關聯到一個零件。
    *   **`Warehouse` (多對一):** 多個庫存記錄關聯到一個倉庫。

---

## 7. `inventory_transactions` (庫存交易記錄)

*   **模型檔案 (Model File):** `models/inventory.py`
*   **說明 (Description):** 記錄所有庫存的進出交易。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `part_id`              | Integer              | Foreign Key (`parts.id`), Not Null | 零件ID (Part ID) |
| `warehouse_id`         | Integer              | Foreign Key (`warehouses.id`), Not Null | 倉庫ID (Warehouse ID) |
| `transaction_type`     | String(50)           | Not Null           | 交易類型 (Transaction Type) |
| `quantity`             | Integer              | Not Null           | 交易數量 (Quantity) |
| `unit_cost`            | Numeric(10, 2)       | Default=0          | 單價 (Unit Cost) |
| `reference_type`       | String(50)           | Nullable           | 參考類型 (Reference Type) |
| `reference_id`         | Integer              | Nullable           | 參考ID (Reference ID) |
| `notes`                | Text                 | Nullable           | 備註 (Notes) |
| `transaction_date`     | DateTime             | Not Null           | 交易日期 (Transaction Date) |
| `created_by`           | String(100)          | Default='system'   | 建立者 (Created By) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |

*   **關聯性 (Relationships):**
    *   **`Part` (多對一):** 多個交易記錄關聯到一個零件。
    *   **`Warehouse` (多對一):** 多個交易記錄關聯到一個倉庫。

---

## 8. `stock_counts` (盤點記錄)

*   **模型檔案 (Model File):** `models/inventory.py`
*   **說明 (Description):** 儲存每次盤點作業的總體記錄。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `count_number`         | String(100)          | Unique, Not Null   | 盤點編號 (Count Number) |
| `warehouse_id`         | Integer              | Foreign Key (`warehouses.id`), Not Null | 倉庫ID (Warehouse ID) |
| `count_date`           | DateTime             | Not Null           | 盤點日期 (Count Date) |
| `status`               | String(50)           | Not Null, Default='planning' | 狀態 (Status) |
| `count_type`           | String(50)           | Not Null, Default='full' | 盤點類型 (Count Type) |
| `description`          | Text                 | Nullable           | 描述 (Description) |
| `counted_by`           | String(100)          | Nullable           | 盤點人 (Counted By) |
| `verified_by`          | String(100)          | Nullable           | 驗證人 (Verified By) |
| `total_items`          | Integer              | Default=0          | 總項目數 (Total Items) |
| `variance_items`       | Integer              | Default=0          | 差異項目數 (Variance Items) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |
| `completed_at`         | DateTime             | Nullable           | 完成時間 (Completed At) |

*   **關聯性 (Relationships):**
    *   **`Warehouse` (多對一):** 多個盤點記錄關聯到一個倉庫。
    *   **`StockCountDetail` (一對多):** 一個盤點記錄有多個盤點明細。

---

## 9. `stock_count_details` (盤點明細)

*   **模型檔案 (Model File):** `models/inventory.py`
*   **說明 (Description):** 儲存每次盤點作業中每個零件的詳細盤點數據。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `stock_count_id`       | Integer              | Foreign Key (`stock_counts.id`), Not Null | 盤點ID (Stock Count ID) |
| `part_id`              | Integer              | Foreign Key (`parts.id`), Not Null | 零件ID (Part ID) |
| `system_quantity`      | Integer              | Not Null           | 系統數量 (System Quantity) |
| `counted_quantity`     | Integer              | Nullable           | 實盤數量 (Counted Quantity) |
| `variance_quantity`    | Integer              | Default=0          | 差異數量 (Variance Quantity) |
| `notes`                | Text                 | Nullable           | 備註 (Notes) |
| `counted_at`           | DateTime             | Nullable           | 盤點時間 (Counted At) |

*   **約束 (Constraints):**
    *   `_stock_count_part_uc`: `(stock_count_id, part_id)` 組合必須唯一。
*   **關聯性 (Relationships):**
    *   **`StockCount` (多對一):** 多個盤點明細關聯到一個盤點記錄。
    *   **`Part` (多對一):** 多個盤點明細關聯到一個零件。

---

## 10. `weekly_order_cycles` (週期申請表)

*   **模型檔案 (Model File):** `models/weekly_order.py`
*   **說明 (Description):** 管理每週的申請週期，定義申請的開始和截止時間。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `cycle_name`           | String(100)          | Not Null           | 申請週期名稱 (Application Cycle Name) |
| `start_date`           | DateTime             | Not Null           | 申請開始日期 (Application Start Date) |
| `deadline`             | DateTime             | Not Null           | 申請截止日期 (Application Deadline) |
| `status`               | String(20)           | Not Null, Default='active' | 狀態 (Status) |
| `created_by`           | Integer              | Nullable           | 建立者ID (Creator ID) |
| `reviewed_by`          | Integer              | Nullable           | 審查者ID (Reviewer ID) |
| `reviewed_at`          | DateTime             | Nullable           | 審查時間 (Review Time) |
| `excel_generated`      | Boolean              | Default=False      | 是否已生成Excel (Excel Generated) |
| `excel_path`           | String(500)          | Nullable           | Excel檔案路徑 (Excel File Path) |
| `notes`                | Text                 | Nullable           | 備註 (Notes) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |
| `updated_at`           | DateTime             | Default, OnUpdate  | 更新時間 (Updated At) |

*   **關聯性 (Relationships):**
    *   **`OrderRegistration` (一對多):** 一個週期有多個申請登記項目。
    *   **`OrderReviewLog` (一對多):** 一個週期有多個審查記錄。

---

## 11. `order_registrations` (申請登記表)

*   **模型檔案 (Model File):** `models/weekly_order.py`
*   **說明 (Description):** 儲存每個週期申請中的個別零件申請項目。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `cycle_id`             | Integer              | Foreign Key (`weekly_order_cycles.id`), Not Null | 週期ID (Cycle ID) |
| `item_sequence`        | Integer              | Not Null           | 項次 (Item Sequence) |
| `part_number`          | String(100)          | Not Null           | 品號 (Part Number) |
| `material_nature`      | String(50)           | Nullable           | 物料性質 (Material Nature) |
| `part_name`            | String(200)          | Not Null           | 品名 (Part Name) |
| `specifications`       | String(200)          | Nullable           | 規格 (Specifications) |
| `quantity`             | Integer              | Not Null           | 數量 (Quantity) |
| `unit`                 | String(20)           | Not Null           | 單位 (Unit) |
| `category`             | String(50)           | Nullable           | 種類 (Category) |
| `required_date`        | DateTime             | Nullable           | 需用日期 (Required Date) |
| `priority`             | String(20)           | Not Null, Default='normal' | 申請優先級 (Priority) |
| `purpose_notes`        | String(200)          | Nullable           | 台份用/備註 (Purpose Notes) |
| `applicant_name`       | String(50)           | Not Null           | 申請人 (Applicant Name) |
| `applicant_id`         | Integer              | Nullable           | 申請人ID (Applicant ID) |
| `department`           | String(100)          | Nullable           | 申請單位 (Department) |
| `status`               | String(20)           | Not Null, Default='registered' | 狀態 (Status) |
| `admin_notes`          | Text                 | Nullable           | 主管備註 (Admin Notes) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |
| `updated_at`           | DateTime             | Default, OnUpdate  | 更新時間 (Updated At) |

*   **關聯性 (Relationships):**
    *   **`WeeklyOrderCycle` (多對一):** 多個申請登記項目屬於一個週期。

---

## 12. `users` (用戶表)

*   **模型檔案 (Model File):** `models/weekly_order.py`
*   **說明 (Description):** 儲存系統用戶資訊，為未來的登入和權限管理準備。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `username`             | String(50)           | Not Null, Unique   | 用戶名 (Username) |
| `email`                | String(100)          | Nullable, Unique   | Email (Email) |
| `full_name`            | String(100)          | Not Null           | 全名 (Full Name) |
| `department`           | String(100)          | Nullable           | 部門 (Department) |
| `role`                 | String(20)           | Not Null, Default='user' | 角色 (Role) |
| `password_hash`        | String(128)          | Nullable           | 密碼雜湊 (Password Hash) |
| `is_active`            | Boolean              | Default=True       | 是否啟用 (Is Active) |
| `last_login`           | DateTime             | Nullable           | 最後登入時間 (Last Login Time) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |
| `updated_at`           | DateTime             | Default, OnUpdate  | 更新時間 (Updated At) |

*   **關聯性 (Relationships):**
    *   目前未明確定義，但未來可與 `WeeklyOrderCycle` (建立者/審查者) 或 `OrderRegistration` (申請人) 建立關聯。

---

## 13. `order_review_logs` (申請單審查記錄表)

*   **模型檔案 (Model File):** `models/weekly_order.py`
*   **說明 (Description):** 記錄申請單的審查歷史，包括審查人、操作和狀態變更。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `cycle_id`             | Integer              | Foreign Key (`weekly_order_cycles.id`), Not Null | 週期ID (Cycle ID) |
| `registration_id`      | Integer              | Foreign Key (`order_registrations.id`), Nullable | 登記項目ID (Registration ID) |
| `reviewer_id`          | Integer              | Nullable           | 審查人ID (Reviewer ID) |
| `reviewer_name`        | String(50)           | Not Null           | 審查人姓名 (Reviewer Name) |
| `action`               | String(20)           | Not Null           | 操作 (Action) |
| `old_status`           | String(20)           | Nullable           | 原狀態 (Old Status) |
| `new_status`           | String(20)           | Nullable           | 新狀態 (New Status) |
| `notes`                | Text                 | Nullable           | 審查備註 (Review Notes) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |

*   **關聯性 (Relationships):**
    *   **`WeeklyOrderCycle` (多對一):** 多個審查記錄關聯到一個週期。
    *   **`OrderRegistration` (多對一):** 多個審查記錄可關聯到一個具體的申請登記項目。

---

## 14. `work_order_demand` (工單需求)

*   **模型檔案 (Model File):** `models/work_order.py`
*   **說明 (Description):** 儲存工單對物料的需求資訊。
*   **欄位 (Columns):**

| 欄位名稱 (Column Name) | 資料類型 (Data Type) | 約束 (Constraints) | 說明 (Description) |
| :--------------------- | :------------------- | :----------------- | :----------------- |
| `id`                   | Integer              | Primary Key        | 唯一識別碼 (Unique Identifier) |
| `order_id`             | String(100)          | Not Null           | 訂單 (Order ID) |
| `part_number`          | String(100)          | Not Null           | 物料 (Part Number) |
| `required_quantity`    | Float                | Not Null           | 需求數量 (Required Quantity) |
| `material_description` | String(255)          | Nullable           | 物料說明 (Material Description) |
| `operation_description`| String(255)          | Nullable           | 作業說明 (Operation Description) |
| `parent_material_description` | String(255)     | Nullable           | 上層物料說明 (Parent Material Description) |
| `required_date`        | DateTime             | Not Null           | 需求日期 (Required Date) |
| `bulk_material`        | String(10)           | Nullable           | 散裝物料 (Bulk Material) |
| `created_at`           | DateTime             | Default            | 建立時間 (Created At) |

*   **約束 (Constraints):**
    *   `_order_part_uc`: `(order_id, part_number)` 組合必須唯一。
*   **關聯性 (Relationships):**
    *   目前未明確定義，但 `part_number` 可隱含地與 `parts.part_number` 關聯。

---
