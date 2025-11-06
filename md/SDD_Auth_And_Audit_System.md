# 主題：使用者登入機制與交易活動紀錄整合開發案 (SDD)

## 1. 總體目標

建立一套完整的使用者身份驗證系統，並確保系統中所有關鍵操作 (如出入庫、訂單申請與審查) 都能準確記錄執行人員資訊，以達到責任追溯與資料完整性的目的。

## 2. 開發進度追蹤 (Development Progress Tracker)

- [ ] **第一階段：建立核心使用者登入/登出功能**
    - [ ] 整合 `User` 模型與 `Flask-Login`
    - [ ] 為 `User` 模型加入密碼加密/驗證功能
    - [ ] 建立 `login`, `logout` 相關路由與控制器 (`auth_controller.py`)
    - [ ] 建立 `login.html` 登入頁面
    - [ ] 初始化 `Flask-Login` 並註冊 `auth` 藍圖
    - [ ] 設定全系統的登入存取控制

- [ ] **第二階段：交易活動與人員資訊綁定**
    - [ ] **庫存交易 (`InventoryTransaction`)**
        - [ ] 新增 `user_id` 欄位至資料庫模型
        - [ ] 更新出/入庫邏輯以記錄 `current_user`
    - [ ] **週期訂單申請 (`OrderRegistration`)**
        - [ ] 更新訂單申請邏輯以記錄 `current_user`
    - [ ] **訂單審查 (`OrderReviewLog`)**
        - [ ] 更新訂單審查邏輯以記錄 `current_user`
    - [ ] 建立並執行資料庫遷移腳本

- [ ] **第三階段：API 存取權杖 (Token) 機制 (未來規劃)**
    - [ ] (待規劃)

## 3. 開發階段與規格

### 第一階段：建立核心使用者登入/登出功能

*   **目標**：讓使用者能透過帳號密碼登入系統，並讓系統能識別當前操作者。
*   **規格**：
    1.  **整合現有 `User` 模型**：
        *   將 `models/weekly_order.py` 中的 `User` 模型與 `Flask-Login` 套件整合。
        *   為 `User` 模型加入安全的密碼加密 (`set_password`) 與驗證 (`check_password`) 功能。`password_hash` 欄位將被啟用。
    2.  **建立驗證路由 (Routes)**：
        *   `GET /login`：顯示登入頁面。
        *   `POST /login`：處理使用者提交的帳號密碼，驗證成功後將使用者標記為「已登入」。
        *   `GET /logout`：清除使用者登入狀態並導向登入頁面。
    3.  **建立登入頁面 (`login.html`)**：
        *   提供一個包含「使用者名稱」、「密碼」輸入框及「登入」按鈕的表單。
    4.  **全系統存取控制**：
        *   系統內所有頁面預設為「需要登入才能存取」。
        *   未登入的使用者在嘗試存取任何頁面時，將自動被重新導向到登入頁面。

### 第二階段：交易活動與人員資訊綁定

*   **目標**：在使用者登入後，系統中所有重要的資料變動都必須記錄下「是誰做的」。
*   **規格**：
    1.  **識別操作者**：一旦使用者登入，系統將透過 `current_user` 全域變數來獲取當前操作者的 `id`, `username`, `full_name` 等資訊。
    2.  **修改資料庫模型與業務邏輯**：
        *   **庫存交易 (`InventoryTransaction` 模型)**：
            *   新增 `user_id` 欄位 (Foreign Key 指向 `users.id`)。
            *   未來所有「入庫」或「出庫」操作，在建立 `InventoryTransaction` 紀錄時，必須將 `current_user.id` 存入此欄位。
        *   **週期訂單申請 (`OrderRegistration` 模型)**：
            *   現有的 `applicant_id` 和 `applicant_name` 欄位將被啟用。
            *   當使用者提交新的訂單申請時，系統將自動使用 `current_user.id` 和 `current_user.full_name` 填入這兩個欄位，取代手動輸入。
        *   **訂單審查 (`OrderReviewLog` 模型)**：
            *   現有的 `reviewer_id` 和 `reviewer_name` 欄位將被啟用。
            *   當主管進行「核准」或「駁回」等審查操作時，系統將自動使用 `current_user.id` 和 `current_user.full_name` 填入這兩個欄位。
    3.  **資料庫遷移**：
        *   建立並執行一個新的資料庫遷移腳本，將上述 `user_id` 欄位新增到現有的資料表中。

### 第三階段：API 存取權杖 (Token) 機制 (未來規劃)

*   **目標**：為未來的系統介接 (例如：其他內部系統、手機 App) 預留一個安全、標準的 API 驗證方式。
*   **規格**：
    1.  在 `User` 模型中新增 `api_token` 欄位。
    2.  提供一個機制 (例如在使用者個人資料頁) 來產生/重設 API Token。
    3.  讓所有 `/api/...` 開頭的路由能同時支援 `Session-Cookie` (給瀏覽器) 和 `API Token` (給其他程式) 兩種驗證方式。
