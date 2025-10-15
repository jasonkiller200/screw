# 📱 PWA (Progressive Web App) 安裝指南

## ✅ PWA 檢查清單

### 已完成項目：
- ✅ **manifest.json** - PWA 配置檔案
- ✅ **sw.js** - Service Worker (離線支援)
- ✅ **icon-192.png** - 應用程式圖示 (192x192)
- ✅ **icon-512.png** - 應用程式圖示 (512x512)
- ✅ **favicon.ico** - 瀏覽器標籤圖示
- ✅ **PWA Meta 標籤** - 在 base.html 中
- ✅ **Service Worker 註冊** - JavaScript 自動註冊
- ✅ **HTTPS 或 localhost** - 開發環境使用 localhost
- ✅ **安裝提示** - 自動顯示安裝橫幅

---

## 📱 安裝步驟

### **Android (Chrome/Edge)**

1. 用 **Chrome** 或 **Edge** 瀏覽器開啟：
   ```
   http://192.168.50.171:5000
   ```

2. 瀏覽器會自動顯示「安裝應用程式」的橫幅
   - 點擊 **「安裝」** 按鈕

3. 或者手動安裝：
   - 點擊瀏覽器右上角的 **⋮** (選單)
   - 選擇 **「安裝應用程式」** 或 **「加入主畫面」**
   - 點擊 **「安裝」**

4. 安裝完成後：
   - 主畫面會出現應用程式圖示 📦
   - 點擊圖示直接開啟應用程式
   - 享受全螢幕、無瀏覽器列的體驗

### **iOS (iPhone/iPad) - Safari**

1. 用 **Safari** 瀏覽器開啟：
   ```
   http://192.168.50.171:5000
   ```

2. 點擊底部工具列的 **「分享」** 按鈕 📤

3. 向下滾動，找到 **「加入主畫面」**

4. 點擊 **「新增」**

5. 主畫面會出現應用程式圖示 📦

> ⚠️ **注意**: iOS 的 PWA 功能有限制：
> - Service Worker 在 iOS 上支援較有限
> - 部分離線功能可能無法使用
> - 建議使用 Android 獲得完整 PWA 體驗

---

## 🎯 PWA 功能特色

### ✨ **安裝後的優勢**

1. **📲 獨立應用程式圖示**
   - 直接從手機主畫面啟動
   - 不需要開啟瀏覽器

2. **⚡ 快速啟動**
   - 啟動速度更快
   - 全螢幕顯示，無位址列

3. **🚀 快捷功能** (長按圖示)
   - 📦 庫存管理
   - ➕ 入庫作業
   - ➖ 出庫作業
   - 🔍 零件查詢

4. **💾 離線支援**
   - 基本頁面可離線存取
   - 資料會在背景同步

5. **📱 原生體驗**
   - 看起來像原生 APP
   - 沒有瀏覽器的干擾元素

---

## 🔍 驗證 PWA 是否正常運作

### **檢查 Manifest**
開啟瀏覽器開發者工具：
1. Chrome: 按 `F12` → **Application** 標籤 → **Manifest**
2. 確認看到：
   - ✅ Name: 五金零件庫存管理系統
   - ✅ Icons: 192x192, 512x512

### **檢查 Service Worker**
開啟瀏覽器開發者工具：
1. Chrome: 按 `F12` → **Application** 標籤 → **Service Workers**
2. 確認看到：
   - ✅ Status: activated and running
   - ✅ Source: /sw.js

### **檢查安裝提示**
1. 如果沒有自動顯示安裝提示，檢查瀏覽器控制台 (Console)
2. 看到訊息：`✅ Service Worker 已註冊`

---

## 🛠️ 疑難排解

### **問題 1: 沒有顯示「安裝應用程式」提示**

**解決方法：**
1. 確認使用 **Chrome** 或 **Edge** (Firefox 不支援完整 PWA)
2. 確認網址是 `http://192.168.50.171:5000` (不是 127.0.0.1)
3. 按 `F12` 開啟控制台，查看是否有錯誤訊息
4. 檢查 Service Worker 是否正常註冊
5. 清除瀏覽器快取後重新載入 (`Ctrl+Shift+R`)

### **問題 2: Service Worker 註冊失敗**

**解決方法：**
1. 確認 `/sw.js` 路徑可以存取
2. 在瀏覽器中直接開啟: `http://192.168.50.171:5000/sw.js`
3. 應該看到 JavaScript 程式碼
4. 檢查控制台錯誤訊息

### **問題 3: 圖示沒有顯示**

**解決方法：**
1. 確認圖示檔案存在：
   - `static/icon-192.png`
   - `static/icon-512.png`
2. 在瀏覽器中測試圖示路徑：
   - `http://192.168.50.171:5000/static/icon-192.png`
3. 如果看不到圖示，重新執行 `python generate_icons.py`

### **問題 4: iOS Safari 安裝後沒有圖示**

**解決方法：**
1. iOS 使用 `apple-touch-icon` meta 標籤
2. 確認 `base.html` 中有：
   ```html
   <link rel="apple-touch-icon" href="/static/icon-192.png">
   ```
3. 重新加入主畫面

### **問題 5: 安裝後點擊圖示沒有反應**

**解決方法：**
1. 確認 Flask 伺服器正在運行
2. 確認手機和電腦在同一個 Wi-Fi 網路
3. 卸載 PWA 後重新安裝
4. 重新啟動 Flask 伺服器

---

## 🔧 開發者指令

### **重新生成圖示**
```bash
python generate_icons.py
```

### **檢查 PWA 配置**
在瀏覽器中開啟：
- Manifest: `http://192.168.50.171:5000/static/manifest.json`
- Service Worker: `http://192.168.50.171:5000/sw.js`
- Icon 192: `http://192.168.50.171:5000/static/icon-192.png`
- Icon 512: `http://192.168.50.171:5000/static/icon-512.png`

### **測試 PWA 安裝**
1. Chrome → 按 `F12` → **Application** 標籤
2. 左側選單: **Manifest**
3. 點擊 **"Add to home screen"** 測試安裝

---

## 📊 PWA 評分工具

使用 **Lighthouse** 檢查 PWA 品質：

1. 在 Chrome 中開啟網站
2. 按 `F12` → **Lighthouse** 標籤
3. 選擇 **Progressive Web App**
4. 點擊 **Generate report**
5. 查看評分和建議

---

## 🌐 瀏覽器支援

| 瀏覽器 | PWA 支援 | 建議度 |
|--------|---------|--------|
| Chrome (Android) | ✅ 完整支援 | ⭐⭐⭐⭐⭐ 強烈推薦 |
| Edge (Android) | ✅ 完整支援 | ⭐⭐⭐⭐⭐ 強烈推薦 |
| Safari (iOS) | ⚠️ 部分支援 | ⭐⭐⭐ 可用但功能有限 |
| Firefox | ❌ 不支援安裝提示 | ⭐⭐ 僅作為網頁使用 |
| Samsung Internet | ✅ 完整支援 | ⭐⭐⭐⭐ 推薦 |

---

## 🎉 享受 PWA 體驗！

現在您的庫存管理系統已經是一個功能完整的 **Progressive Web App**！

您可以：
- 📱 像原生 APP 一樣使用
- ⚡ 快速存取常用功能
- 💾 享受基本的離線支援
- 🚀 獲得更流暢的使用體驗

如有任何問題，請查看疑難排解章節或聯絡開發團隊。
