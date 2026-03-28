### **軟體設計文件 (SDD): 儀表板數據服務**

**版本:** 1.1
**日期:** 2025-11-14

---

**1. 總覽 (Overview)**

*   **1.1. 目的**
    本文件旨在詳細規劃與設計一個新的後端服務 `dashboard_service.py`。此服務的核心職責是處理所有與儀表板 (`index.html`) 相關的數據計算與查詢，並透過一個專門的 API 端點提供給前端使用，以實現儀表板的動態化。

*   **1.2. 範圍**
    *   建立 `services/dashboard_service.py` 檔案，並在其中定義 `DashboardService` 類別。
    *   在 `controllers/api_controller.py` 中建立一個新的 `GET /api/dashboard` 端點，該端點能接收 `timespan` 參數。
    *   實現儀表板上所有數據指標的計算邏輯，包括 KPI、可動態調整時間範圍的圖表、和列表數據。
    *   確保 API 回傳的數據結構清晰、高效。

---

**2. 需求分析 (Requirements)**

*   **2.1. 功能性需求**
    該服務必須計算並提供以下數據：

    *   **2.1.1. 頂部關鍵指標 (KPIs)**
        *   **卡片一 (總庫存狀況):**
            *   `parts_with_location_count`: 至少設定一個儲位的總品項數量。
            *   `total_part_locations`: 零件與儲位指派的總數。
            *   `total_stock_quantity`: 所有零件的庫存總數量。
        *   **卡片二 (本週出庫):** 本週 (週一至今日) 的總出庫數量，並與上週同期比較計算趨勢百分比。
        *   **卡片三 (本週入庫):** 本週 (週一至今日) 的總入庫數量，並與上週同期比較計算趨勢百分比。
        *   **卡片四 (庫存預警):**
            *   `low_stock_count`: 庫存低於安全庫存但尚未缺貨的品項數。
            *   `out_of_stock_count`: 庫存為零的品項數。

    *   **2.1.2. 圖表與列表數據**
        *   **綜合趨勢圖:**
            *   **時間範圍:** API 需支援接收 `timespan` 參數，允許前端請求 `daily` (最近30天), `weekly` (最近26週), `monthly` (最近12個月) 的數據。預設為 `daily`。
            *   **數據系列:**
                *   **總庫存量趨勢 (主 Y 軸):** 顯示在選定時間範圍內，每個時間點 (日/週/月) 結束時的總庫存數量。應以**線圖**呈現。
                *   **每日出庫量 (副 Y 軸):** 顯示在選定時間範圍內，每個時間點的總出庫量。應以**長條圖**呈現。
                *   **每日入庫量 (副 Y 軸):** 顯示在選定時間範圍內，每個時間點的總入庫量。應以**長條圖**呈現。
        *   **出庫頻率排行:** 提供指定時間範圍內 (例如本月) 出庫次數最多的前 5 名品項。
        *   **庫存預警清單:** 提供所有低庫存與缺貨品項的詳細列表 (品名、儲位、目前庫存、安全庫存量)。

*   **2.2. 非功能性需求**
    *   **效能:** API 請求應在 1000ms 內回傳。資料庫查詢必須被優化，特別是時間序列計算，應避免在迴圈中執行查詢。
    *   **可維護性:** 程式碼應遵循 DRY 原則，結構清晰，並與專案現有風格保持一致。

---

**3. 系統設計 (System Design)**

*   **3.1. 架構流程**
    1.  **前端請求:** 前端 `dashboard.js` 向 `GET /api/dashboard?timespan=<value>` 發送請求 (`value` 可為 `daily`, `weekly`, `monthly`)。
    2.  **控制器處理:** `api_controller.py` 中的 `get_dashboard_data` 函式接收請求，並從 URL 參數中讀取 `timespan`。
    3.  **服務層計算:** 控制器呼叫 `DashboardService.get_dashboard_data(timespan=timespan)` 方法。
    4.  **數據庫查詢:** `DashboardService` 根據 `timespan` 參數，執行對應的時間分組查詢。
    5.  **數據回傳:** `DashboardService` 將所有計算結果組織成一個字典並回傳。
    6.  **JSON 響應:** 控制器將字典序列化為 JSON 格式，回傳給前端。

*   **3.2. 檔案結構**
    *   `services/dashboard_service.py` (新檔案)
    *   `controllers/api_controller.py` (修改)
    *   `md/SDD_Dashboard_Service.md` (本檔案)

---

**4. 詳細設計 (Detailed Design)**

*   **4.1. `services/dashboard_service.py` 設計**
    ```python
    # services/dashboard_service.py

    from app.models import Part, PartLocation, InventoryTransaction
    from sqlalchemy import func, case
    from datetime import datetime, timedelta

    class DashboardService:
        def get_dashboard_data(self, timespan='daily'):
            """
            主方法，協調所有數據的獲取與計算。
            """
            kpi_data = self._get_kpi_data()
            trend_data = self._get_trend_data(timespan)
            # ... 其他數據獲取 ...

            return {
                "kpi": kpi_data,
                "trend_chart": trend_data,
                # "top_checkout_items": top_items,
                # "stock_alerts": alerts
            }

        def _get_kpi_data(self):
            """計算所有頂部 KPI 卡片的數據。"""
            pass

        def _get_trend_data(self, timespan):
            """
            根據時間範圍計算趨勢數據。
            - timespan: 'daily', 'weekly', 'monthly'
            """
            # 根據 timespan 決定日期範圍和分組格式
            # 查詢 InventoryTransaction，按時間分組計算出入庫量
            # 計算每個時間點的期末總庫存量 (挑戰點)
            pass

        # ... 其他私有方法 ...
    ```

*   **4.2. `controllers/api_controller.py` 設計**
    ```python
    # controllers/api_controller.py

    from flask import Blueprint, jsonify, request
    from app.services.dashboard_service import DashboardService

    api_blueprint = Blueprint('api', __name__, url_prefix='/api')

    @api_blueprint.route('/dashboard', methods=['GET'])
    def get_dashboard_data():
        """
        提供儀表板所需的所有數據。
        可接受 timespan 查詢參數 ('daily', 'weekly', 'monthly')。
        """
        timespan = request.args.get('timespan', 'daily', type=str)
        service = DashboardService()
        data = service.get_dashboard_data(timespan=timespan)
        return jsonify(data)
    ```

---

**5. 測試策略 (Testing Strategy)**

*   **單元測試:** 針對 `_get_trend_data` 方法，需分別測試 `daily`, `weekly`, `monthly` 三種參數下的計算邏輯是否正確。
*   **整合測試:** 建立測試案例，分別呼叫 `/api/dashboard?timespan=daily`, `...=weekly`, `...=monthly`，驗證回傳的 JSON 結構與數據是否符合預期。

---
