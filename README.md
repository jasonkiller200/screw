# 螺絲五金庫存管理系統 (Screw Hardware Inventory Management System)

這是一個使用 Flask 開發的螺絲五金庫存管理系統。系統旨在簡化庫存追蹤、訂單管理和零件查詢流程。

## 主要功能

- **庫存管理**:
  - 即時庫存追蹤
  - 入庫、出庫、庫存調整功能
  - 週期盤點功能
  - 多倉儲地點支援

- **訂單管理**:
  - 建立和管理採購訂單
  - 追蹤訂單狀態
  - 歷史訂單記錄

- **週期訂單系統**:
  - 自動化管理週期性採購需求
  - 訂單審核流程
  - 供應商管理

- **零件管理**:
  - 詳細的零件資料庫，包含規格、供應商、安全庫存等資訊
  - 手機相機條碼掃描查詢功能 (使用 ZXing)

- **使用者與權限**:
  - 使用者註冊與登入
  - 基於角色的權限管理

- **工單需求**:
  - 根據工單需求分析零件缺料

- **AI 助理**:
  - 使用 Ollama 模型提供智慧查詢與分析 (建構中)

- **PWA 支援**:
  - 可將應用程式安裝至手機桌面，提供離線存取能力

## 技術棧

- **後端**: Python, Flask
- **資料庫**: SQLite, SQLAlchemy, Flask-Migrate
- **前端**: HTML, CSS, JavaScript, Bootstrap
- **非同步任務**: (mention if any, e.g., Celery)
- **其他**:
  - `ZXing`: 用於條碼掃描
  - `Ollama`: 用於 AI 功能

## 安裝與啟動

### 1. 環境準備

- 確認已安裝 Python 3.10+。
- (可選) 建議安裝 `git` 來複製專案。

### 2. 複製專案

```bash
git clone <your-repository-url>
cd screw
```

### 3. 建立並啟用虛擬環境

- **Windows**:
  ```bash
  python -m venv venv
  .\venv\Scripts\activate
  ```
- **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 4. 安裝依賴套件

```bash
pip install -r requirements.txt
```

### 5. 設定資料庫

本專案使用 `Flask-Migrate` 管理資料庫結構。執行以下指令來建立或更新資料庫：

```bash
# 設定 Flask App 環境變數
# Windows (Command Prompt)
set FLASK_APP=app.py
# Windows (PowerShell)
$env:FLASK_APP="app.py"
# macOS / Linux
export FLASK_APP=app.py

# 執行資料庫遷移
flask db upgrade
```
這將會在專案根目錄下建立一個 `hardware.db` 檔案，並設定好所有需要的資料表。

### 6. (可選) 產生 SSL 憑證以啟用 HTTPS

若要在手機上測試 PWA 或相機功能，需要啟用 HTTPS。執行以下腳本來產生自簽署憑證：

```bash
python generate_ssl_cert.py
```
這會產生 `cert.pem` 和 `cert.key` 兩個檔案。

### 7. 啟動應用程式

```bash
python app.py
```

應用程式預設會運行在 `http://0.0.0.0:5005`。如果有 SSL 憑證，則會運行在 `https://0.0.0.0:5005`。

## 專案結構

```
├── app.py                  # Flask 應用程式進入點
├── extensions.py           # Flask 擴充套件 (DB, Migrate, LoginManager)
├── requirements.txt        # 專案依賴
├── migrations/             # 資料庫遷移腳本 (Alembic)
├── models/                 # SQLAlchemy 資料庫模型
├── controllers/            # Flask 藍圖和路由定義
├── services/               # 業務邏輯服務層
├── static/                 # 靜態檔案 (JS, CSS, Images)
├── templates/              # Jinja2 網頁模板
└── hardware.db             # SQLite 資料庫檔案
```

## 注意事項

- 預設的管理員帳號/密碼，或如何建立第一個使用者，請補充於此。
- 專案的 secret key 硬編碼在 `app.py` 中，在生產環境中應改用環境變數。
