# 部署說明 - AI資料庫查詢系統 v1.0

## 📋 本次更新內容 (Commit: cda7aa8)

### 🤖 新增功能：AI資料庫查詢系統
- **自然語言查詢**: 用中文問問題，AI自動生成SQL查詢
- **對話記憶**: 支援延續性對話，理解上下文
- **動態模型選擇**: 自動檢測可用的AI模型
- **智慧格式化**: AI自動整理查詢結果

### 📱 改進功能：條碼掃描器
- **智慧相機選擇**: 自動優先使用後置相機
- **真正的相機切換**: 支援前後鏡頭循環切換
- **手機優化**: 更好的移動設備使用體驗

## 🚀 部署步驟

### 1. 安裝Ollama (必需)
```bash
# Windows
# 下載並安裝 Ollama from https://ollama.com/download

# 驗證安裝
ollama --version
```

### 2. 下載AI模型 (建議)
```bash
# 推薦使用 Llama 3.1 8B
ollama pull llama3.1:8b

# 或使用其他模型
ollama pull qwen:4b
ollama pull gemma:7b
```

### 3. 安裝Python依賴
```bash
# 激活虛擬環境
.\venv\Scripts\activate

# 安裝新依賴
pip install -r requirements.txt
```

### 4. 啟動系統
```bash
# 方式1: 使用快速啟動腳本
.\start_ai_system.bat

# 方式2: 手動啟動
python app.py
```

## 🔗 新增頁面

1. **AI資料庫查詢**: `/reports/ai-query`
   - 主導航 → 報表分析 → AI資料庫查詢

2. **相機測試頁面**: `/static/camera_test.html`
   - 用於測試和調試相機功能

## 📊 使用示例

### AI查詢範例
- "最近一週有哪些入庫記錄？"
- "庫存不足的零件有哪些？"
- "工單需求量最高的前10個零件是什麼？"

### 延續性對話
```
用戶: "查詢零件表中有多少筆記錄"
AI: "零件表中有3720筆記錄"
用戶: "那麼倉庫表呢？"
AI: "倉庫表中有5筆記錄"
```

## 🛠️ 故障排除

### AI服務問題
1. **檢查Ollama服務**:
   ```bash
   ollama ps
   ```

2. **檢查模型**:
   ```bash
   ollama list
   ```

### 相機問題
1. 訪問 `/static/camera_test.html` 檢測相機
2. 確保使用HTTPS (相機權限需求)
3. 檢查瀏覽器相機權限設定

## 📁 新增檔案清單

```
controllers/
├── ai_controller.py          # AI查詢API控制器

services/
├── ai_service.py             # AI查詢核心服務

templates/reports/
├── ai_query.html             # AI查詢界面

md/
├── AI_Query_Manual.md        # 詳細使用說明

static/
├── camera_test.html          # 相機測試頁面

根目錄/
├── start_ai_system.bat       # 快速啟動腳本
```

## 📈 技術規格

- **Python版本**: 3.8+
- **AI框架**: Ollama
- **推薦模型**: Llama 3.1 8B
- **硬體需求**: 8GB+ RAM
- **瀏覽器**: 支援WebRTC的現代瀏覽器

## ✅ 測試確認

- [ ] Ollama服務正常運行
- [ ] AI模型已下載並可用
- [ ] AI查詢界面正常載入
- [ ] 條碼掃描器相機切換正常
- [ ] 手機上後置相機優先選擇

---

**部署時間**: 2025-10-27 14:38
**版本**: v1.0 (commit cda7aa8)
**負責人**: Ralf