# 專案 MVC 架構評估與重構計畫

## 1. 現有架構評估

目前專案已具備良好的模組化結構，大致符合 MVC (Model-View-Controller) 模式：

*   **Models (模型)**: 位於 `models/` 目錄，包含 SQLAlchemy 模型定義 (e.g., `part.py`, `inventory.py`, `order.py`)，負責資料庫互動和部分業務邏輯。
*   **Views (視圖)**: 位於 `templates/` 目錄，包含 Jinja2 模板 (e.g., `index.html`, `parts.html`)，負責呈現使用者介面。
*   **Controllers (控制器)**: 位於 `controllers/` 目錄，包含 Flask 藍圖 (e.g., `api_controller.py`, `web_controller.py`, `inventory_controller.py`)，負責處理請求、呼叫模型方法並準備回應。
*   **靜態資源**: 位於 `static/` 目錄，包含 CSS、JavaScript 和圖片等。
*   **應用程式核心**: `app.py` 作為應用程式工廠，負責初始化 Flask 應用、資料庫擴展 (SQLAlchemy, Migrate) 並註冊藍圖。

**優點:**

*   清晰的職責分離，有助於程式碼組織和理解。
*   藍圖的使用使得路由管理模組化。
*   模型層已包含部分業務邏輯，減少控制器負擔。

**待改進點:**

*   部分控制器仍包含較複雜的業務邏輯，特別是涉及多個模型或外部資源的操作 (e.g., `web_controller.py` 中的 Excel 匯入邏輯)。這類邏輯應進一步抽象到服務層。
*   錯誤處理機制雖然存在，但可進一步標準化，確保 API 回應和網頁提示的一致性。

## 2. 詳細 MVC 重構計畫

本計畫旨在進一步強化現有 MVC 架構，提升程式碼的可維護性、可測試性和擴展性。

### 目標

*   確保控制器保持輕量，僅負責請求分派和回應處理。
*   將複雜的業務邏輯從控制器中抽離，移至模型或新的服務層。
*   維持清晰的路由結構，並確保其一致性。
*   標準化錯誤處理機制。

### 實施步驟

1.  **建立服務層 (Service Layer)**
    *   **目的**: 處理跨多個模型或複雜的業務邏輯，保持控制器和模型層的職責單一。
    *   **行動**:
        *   建立 `services/` 目錄。
        *   將 `web_controller.py` 中 `import_parts` 函數的 Excel 檔案解析、資料驗證和零件建立等複雜邏輯，抽離到 `services/part_service.py` 中的 `PartService.import_parts_from_excel` 靜態方法。
        *   更新 `web_controller.py` 中的 `import_parts` 路由，使其呼叫 `PartService.import_parts_from_excel` 並處理其回傳結果。
        *   評估其他控制器中是否存在類似的複雜業務邏輯，並逐步將其移至對應的服務 (e.g., `InventoryService`, `OrderService`)。

2.  **精簡控制器 (Controllers)**
    *   **目的**: 確保控制器只負責接收請求、呼叫服務/模型、準備回應 (渲染模板或返回 JSON)。
    *   **行動**:
        *   審查 `controllers/api_controller.py`, `controllers/web_controller.py`, `controllers/inventory_controller.py` 中的每個路由。
        *   移除所有非必要的業務邏輯，將其委派給模型或服務層。
        *   確保 API 控制器僅返回 JSON 格式的回應。
        *   確保 Web 控制器僅渲染 HTML 模板或執行重定向。

3.  **強化模型層 (Models)**
    *   **目的**: 確保模型層包含所有與資料庫互動和資料實體相關的業務規則。
    *   **行動**:
        *   確認 `models/` 目錄中的每個模型都定義了其資料結構、關聯和資料庫操作方法 (CRUD)。
        *   現有的 `Part.create` 和 `Part.update` 方法中處理倉位衝突的邏輯是良好的實踐，應繼續保持此類業務規則在模型內部。

4.  **路由結構維護與文件化**
    *   **目的**: 維持清晰的路由結構，並提供簡要文件。
    *   **行動**:
        *   `app.py` 將繼續作為藍圖註冊的中心點。
        *   **API 路由**:
            *   通用 API: `/api/...` (由 `controllers/api_controller.py` 管理)
            *   庫存 API: `/api/inventory/...` (由 `controllers/inventory_controller.py` 管理)
        *   **Web 路由**:
            *   網頁介面: `/...` (由 `controllers/web_controller.py` 管理)
        *   確保路由命名一致且具描述性。

5.  **標準化錯誤處理**
    *   **目的**: 提供一致且有用的錯誤訊息給使用者和 API 消費者。
    *   **行動**:
        *   對於 API 錯誤，統一使用 `jsonify({'error': '錯誤訊息'})` 並搭配適當的 HTTP 狀態碼 (e.g., 400 Bad Request, 404 Not Found, 500 Internal Server Error)。
        *   對於 Web 介面錯誤，統一使用 Flask 的 `flash()` 訊息機制，並確保模板能正確顯示這些訊息。

## 3. 實施進度追蹤

以下是本次重構的初步待辦事項清單：

*   [ ] 建立 `services` 目錄 (已完成)
*   [ ] 將 `web_controller.py` 中的 `import_parts` 邏輯移至 `services/part_service.py`
*   [ ] 更新 `web_controller.py` 以使用 `part_service`
*   [ ] 審查並精簡其他控制器中的業務邏輯
*   [ ] 強化模型層的業務規則封裝
*   [ ] 文件化路由結構
*   [ ] 標準化錯誤處理機制
