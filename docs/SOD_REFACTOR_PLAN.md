# 職責分離 (SOD) 重構藍圖計畫

**版本:** 1.0
**日期:** 2025-11-01
**狀態:** 已完成今日工作，明日繼續

## 0. 今日進度總結 (2025-11-02)

今天我們繼續了 `api_controller.py` 和 `weekly_order_controller.py` 的重構，並完成了第二階段和第三階段的所有任務。

**已完成的重構任務:**
- **第一階段 (`web_controller.py`):** 全部完成 (任務 1.1 ~ 1.6)。
- **第二階段 (`api_controller.py`):** 全部完成 (任務 2.1 ~ 2.4)。
- **第三階段 (`weekly_order_controller.py`):** 全部完成 (任務 3.1 ~ 3.5)。

**今日工作總結：** 已完成第二階段和第三階段的所有重構任務。接下來將執行最終測試並提交 Git Commit。

---

## 1. 目標

本計畫旨在對 `screw` 專案的 `controllers` 層進行全面重構，嚴格遵循 Model-Controller-Service (M-C-S) 架構原則。目標是將所有業務邏輯、資料庫操作和檔案處理邏輯從控制器 (Controller) 中移除，遷移至對應的服務層 (Service)，實現「瘦控制器，胖服務 (Thin Controller, Fat Service)」的架構模式。

## 2. 重構原則

- **控制器 (Controller):** 只負責解析 HTTP 請求、基本輸入驗證、調用服務層方法，以及將服務層的結果轉換為 HTTP 回應 (渲染模板或 JSON)。
- **服務 (Service):** 負責處理所有核心業務邏輯、複雜驗證、資料庫交易、檔案生成/解析，以及與模型層 (Model) 的所有互動。
- **模型 (Model):** 只負責定義資料結構和提供最基本的 CRUD (Create, Read, Update, Delete) 操作。

## 3. 重構階段與進度

我們將分階段進行重構，以便於追蹤和測試。

---

### **第一階段：`web_controller.py` 重構**

- **目標:** 處理這個最複雜的控制器，將其內部的業務邏輯徹底分離。
- **狀態:** `已完成`

| 任務 | 描述 | 目標 Service | 狀態 |
| :--- | :--- | :--- | :--- |
| 1.1 | 建立 `WorkOrderService` 和 `ReportService` | `N/A` | `已完成` |
| 1.2 | 遷移工單匯入邏輯 (`import_work_order_demands`) | `WorkOrderService` | `已完成` |
| 1.3 | 遷移零件表單處理邏輯 (`new_part`, `edit_part`) | `PartService` | `已完成` |
| 1.4 | 遷移零件差異報告邏輯 (`_get_parts_comparison_report_data`, `export_parts_comparison`) | `ReportService` | `已完成` |
| 1.5 | 遷移庫存操作邏輯 (`stock_in`, `stock_out`) | `InventoryService` | `已完成` |
    - **說明:**
        - **問題:** 網頁表單和快速操作傳遞 `warehouse_id`，但底層 `CurrentInventory.update_stock` 和 `CurrentInventory.get_current_stock` 需要 `warehouse_location_id`。
        - **修正:**
            - 在 `InventoryService.perform_stock_in_from_form` 和 `InventoryService.perform_stock_out_from_form` 中，加入邏輯將 `warehouse_id` 轉換為 `warehouse_location_id` (透過零件的倉位關聯)。
            - 修正 `models/inventory.py` 中 `CurrentInventory.get_current_stock` 函式，使其正確地使用 `warehouse_location_id` 進行查詢，解決了「可用數量為0但實際有庫存」的問題。
            - **出庫功能增強:**
                - 「一般出庫」和「快速出庫」的「出庫類型」預設為「工單領用」。
                - 當選擇「工單領用」時，顯示「工單編號」輸入框，預設值為 `20000`。
                - 移除前端對工單編號的即時驗證，工單編號會記錄在庫存異動的 `notes` 欄位中。
| 1.6 | 遷移倉儲/倉位管理邏輯 (add/edit/delete) | `PartService` | `已完成` |

---

### **第二階段：`api_controller.py` 重構**

- **目標:** 清理 API 控制器中的業務邏輯和檔案生成程式碼。
- **狀態:** `已完成`

| 任務 | 描述 | 目標 Service | 狀態 |
| :--- | :--- | :--- | :--- |
| 2.1 | 遷移 Excel 匯出邏輯 (庫存、低庫存、零件) | `InventoryService`, `PartService` | `已完成` |
| 2.2 | 遷移跨模型資料聚合邏輯 (`get_part_details`) | `PartService` | `已完成` |
| 2.3 | 遷移資料庫查詢邏輯 (`parts_autocomplete`, `get_work_orders`) | `PartService`, `WorkOrderService` | `已完成` |
| 2.4 | 遷移庫存策略更新邏輯 (`update_inventory_policy`) | `InventoryService` | `已完成` |

---

### **第三階段：`weekly_order_controller.py` 重構**

- **目標:** 將週期訂單的業務邏輯封裝到 Service 中。
- **狀態:** `已完成`

| 任務 | 描述 | 目標 Service | 狀態 |
| :--- | :--- | :--- | :--- |
| 3.1 | 建立 `WeeklyOrderService` | `N/A` | `已完成` |
| 3.2 | 遷移 Excel 匯出邏輯 (`export_excel`) | `WeeklyOrderService` | `已完成` |
| 3.3 | 遷移審查邏輯 (`review_registration`, `batch_review`) | `WeeklyOrderService` | `已完成` |
| 3.4 | 遷移訂單登記邏輯 (register, batch_register) | `WeeklyOrderService` | `已完成` |
| 3.5 | 遷移入庫操作邏輯 (`inbound_item`, `batch_inbound_items`) | `InventoryService` | `已完成` |

---

### **第四階段：完成與提交**

- **目標:** 所有重構完成並通過測試後，提交到 Git 倉儲。
- **狀態:** `未開始`

| 任務 | 描述 | 狀態 |
| :--- | :--- | :--- |
| 4.1 | 執行最終測試 | `未開始` |
| 4.2 | 提交 Git Commit | `未開始` |
