# 內網離線環境修復指南

## 問題描述
在沒有外網存取權限的內網環境中，網站會出現以下錯誤：

1. **DevTools failed to load SourceMap** - Bootstrap CSS/JS 的 source map 檔案 404 錯誤
2. **quickStockIn/quickStockOut is not defined** - JavaScript 函數未定義錯誤
3. **Socket.IO 連線超時** - 無法從 CDN 載入 Socket.IO
4. **io is not defined** - Socket.IO 物件不存在

## 解決方案

### 1. 替換 Socket.IO CDN 為本地檔案
已將 `templates/base.html` 中的：
```html
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
```
修改為：
```html
<script src="{{ url_for('static', filename='vendor/socket.io.min.js') }}"></script>
```

### 2. 創建本地 Socket.IO 替代方案
已創建 `static/vendor/socket.io.min.js` 提供基本的 Socket.IO 兼容性：
- 模擬 Socket.IO 客戶端連線
- 提供基本的事件系統 (on/emit)
- 模擬線上人數功能
- 防止 JavaScript 錯誤

### 3. 創建 Source Map 空檔案
已創建空的 source map 檔案以防止 404 錯誤：
- `static/vendor/bootstrap/css/bootstrap.min.css.map`
- `static/vendor/bootstrap/js/bootstrap.bundle.min.js.map`

## 檔案結構
```
static/
├── vendor/
│   ├── socket.io.min.js          # 新增：本地 Socket.IO 替代方案
│   └── bootstrap/
│       ├── css/
│       │   ├── bootstrap.min.css
│       │   └── bootstrap.min.css.map  # 新增：空 source map
│       └── js/
│           ├── bootstrap.bundle.min.js
│           └── bootstrap.bundle.min.js.map  # 新增：空 source map
└── js/
    └── inventory/
        └── index.js              # 確認存在且包含 quickStock 函數
```

## 測試方式

1. **使用測試頁面**：
   在瀏覽器中開啟 `http://your-server:5005/tmp_rovodev_test_offline_fix.html`
   
2. **檢查控制台**：
   - 應該看到 "Socket.IO 離線替代方案已載入"
   - 不應該有 404 錯誤
   - 不應該有 "is not defined" 錯誤

3. **功能測試**：
   - 快速入庫/出庫按鈕應該可以點擊
   - 線上人數應該顯示 "1"
   - Bootstrap 樣式應該正常顯示

## 注意事項

1. **功能限制**：
   - Socket.IO 替代方案僅提供基本功能
   - 無法進行真實的即時通訊
   - 線上人數為模擬數據

2. **效能考量**：
   - 本地檔案載入速度較快
   - 減少外網依賴
   - 提高系統穩定性

3. **維護建議**：
   - 定期檢查 JavaScript 檔案完整性
   - 監控控制台錯誤訊息
   - 測試關鍵功能是否正常

## 故障排除

### 如果仍有 quickStock 函數錯誤：
1. 檢查 `static/js/inventory/index.js` 是否存在
2. 確認檔案權限正確
3. 檢查瀏覽器快取，清除後重新載入

### 如果 Socket.IO 仍有問題：
1. 確認 `static/vendor/socket.io.min.js` 檔案完整
2. 檢查瀏覽器控制台是否有載入錯誤
3. 重啟應用程式服務

## 部署檢查清單

- [ ] 確認所有 source map 檔案已創建
- [ ] 確認 Socket.IO 本地檔案存在
- [ ] 確認 base.html 已更新為使用本地 Socket.IO
- [ ] 測試頁面功能正常
- [ ] 清除瀏覽器快取
- [ ] 重啟應用程式服務
- [ ] 驗證錯誤訊息已消失