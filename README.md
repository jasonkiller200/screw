# 螺絲五金庫存管理系統 (Screw Hardware Inventory Management System)

使用 Flask 開發的螺絲五金庫存管理系統，涵蓋庫存追蹤、零件管理、週期訂單、工單缺料分析、站內通知與 AI 助理，並支援手機 PWA 與條碼掃描。

## 主要功能

- **庫存管理**
  - 即時庫存追蹤、入庫 / 出庫 / 調整
  - 週期盤點 (StockCount)
  - 多倉庫、多儲位支援 (Warehouse / WarehouseLocation)
  - 出庫範本 (StockOutTemplate) 可重複套用

- **零件管理**
  - 零件資料庫：規格、供應商、安全庫存等
  - 手機相機條碼掃描查詢 (ZXing)
  - 零件批次匯入 (Excel)

- **訂單管理**
  - 採購訂單建立、狀態追蹤與歷史記錄

- **週期訂單系統**
  - 週期性採購需求登記 (WeeklyOrderCycle / OrderRegistration)
  - 審核流程與審核紀錄 (OrderReviewLog)
  - 供應商管理

- **工單需求**
  - 依工單需求分析零件缺料

- **報表與儀表板**
  - 儀表板統計、報表產生 (reportlab / pandas / openpyxl)

- **通知系統**
  - 站內通知，透過 Flask-SocketIO 即時推送
  - 線上使用者顯示

- **使用者與權限**
  - 註冊 / 登入 (Flask-Login、bcrypt 密碼雜湊)
  - 基於角色的權限管理
  - 管理員後台 (使用者管理、系統管理)

- **AI 助理**
  - 透過 Ollama 模型提供智慧查詢與分析

- **PWA 支援**
  - 可安裝至手機桌面；搭配 HTTPS 支援 iOS Service Worker 與相機

## 技術棧

| 類別 | 技術 |
| --- | --- |
| 後端 | Python 3.10+, Flask 3.1, Flask-CORS |
| 資料庫 | SQLite, Flask-SQLAlchemy, Flask-Migrate (Alembic) |
| 認證 | Flask-Login, bcrypt |
| 即時通訊 | Flask-SocketIO, gevent, gevent-websocket |
| 資料 / 報表 | pandas, openpyxl, reportlab |
| 前端 | HTML, CSS, JavaScript, Bootstrap |
| 其他 | ZXing (條碼)、Ollama (AI)、httpx |

## 安裝與啟動

### 1. 環境準備

- Python 3.10 以上
- (可選) git

### 2. 取得專案

```bash
git clone <your-repository-url>
cd screw
```

### 3. 建立並啟用虛擬環境

- **Windows**
  ```powershell
  python -m venv venv
  .\venv\Scripts\activate
  ```
- **macOS / Linux**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 4. 安裝依賴

```bash
pip install -r requirements.txt
```

### 5. 設定資料庫

使用 Flask-Migrate 管理資料庫結構：

```powershell
# Windows PowerShell
$env:FLASK_APP="app.py"
flask db upgrade
```

```bash
# macOS / Linux
export FLASK_APP=app.py
flask db upgrade
```

SQLite 資料庫為 `hardware.db`（由 Flask-SQLAlchemy 建立於 `instance/` 目錄）。
初始化或匯入資料的輔助腳本位於 [scripts/](scripts/)，例如 `database_setup.py`、`import_parts_from_excel.py`。

### 6. (可選) 產生 SSL 憑證以啟用 HTTPS

在手機上測試 PWA 或相機功能需要 HTTPS：

```bash
python scripts/generate_ssl_cert.py
```

請確認產生的 `cert.pem` 與 `cert.key` 位於專案根目錄。

### 7. 啟動應用程式

```bash
python app.py
```

Windows 也可直接執行 `start_server.ps1`，它會自動啟用虛擬環境並啟動伺服器。

預設監聽 `0.0.0.0:5005`：有憑證時為 `https://`，否則為 `http://`。
應用程式使用 gevent 非同步模式 (`socketio.run`)。

## 環境變數

| 變數 | 說明 | 預設值 |
| --- | --- | --- |
| `SECRET_KEY` | Flask session 金鑰，**正式環境務必設定** | 開發用預設值 |
| `CORS_ORIGINS` | 允許的跨域來源，以逗號分隔 | 內網 IP 與 localhost:5005 |

## 專案結構

```
├── app.py                  # 應用程式工廠 (create_app) 與進入點
├── extensions.py           # 擴充套件 (db, migrate, login_manager, socketio)
├── requirements.txt        # 專案依賴
├── start_server.ps1        # Windows 啟動腳本
├── alembic.ini / migrations/   # 資料庫遷移 (Alembic)
├── controllers/            # Blueprint 與路由
│   ├── web_controller.py           # 網頁頁面
│   ├── api_controller.py           # 通用 API
│   ├── inventory_controller.py     # 庫存 API
│   ├── weekly_order_controller.py  # 週期訂單
│   ├── auth_controller.py          # 登入 / 註冊 / 登出
│   ├── user_controller.py          # 使用者管理
│   ├── admin_controller.py         # 管理員後台
│   ├── notification_controller.py  # 通知
│   ├── online_users_controller.py  # 線上使用者 (SocketIO)
│   └── ai_controller.py            # AI 助理
├── services/               # 業務邏輯層 (inventory / part / report / dashboard /
│                           #   weekly_order / work_order / notification / ai / auth / template)
├── models/                 # SQLAlchemy 模型 (part / inventory / order / weekly_order /
│                           #   work_order / template / notification / user)
├── utils/                  # 共用工具 (datetime_utils)
├── templates/              # Jinja2 模板
├── static/                 # 靜態資源 (JS, CSS, 圖片, PWA)
├── scripts/                # 資料庫設定、匯入、憑證產生等輔助腳本
├── docs/                   # 文件
├── data/ / instance/       # 資料與 SQLite 資料庫
├── logs/                   # 應用程式日誌 (app.log，輪替 10MB x 5)
└── backup/                 # 備份
```

## 分層架構

`Controller (路由 / 驗證輸入)` → `Service (業務邏輯)` → `Model (資料存取)`

## 注意事項

- 首次使用請透過註冊頁面或 `scripts/` 內的腳本建立第一個管理員帳號，並依實際情況調整角色。
- 正式環境請以環境變數設定 `SECRET_KEY`，勿使用預設值。
- SQLite 已設定 `timeout=30` 以減少多人同時操作時的 `database locked`。
- 登入工作階段有效期為 8 小時。
- `logs/`、`instance/`、`venv/` 與憑證檔不應提交至版本控制。
