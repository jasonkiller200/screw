# 🔍 PWA 快速檢查清單

## 📋 立即檢查這些項目

### 1️⃣ **在手機瀏覽器中開啟開發者工具 (Console)**

**Android Chrome:**
1. 在電腦 Chrome 中開啟: `chrome://inspect#devices`
2. 確認手機已連線 (需開啟 USB 偵錯)
3. 點擊手機上的網頁旁的 "inspect"
4. 查看 Console 訊息

**或者使用電腦瀏覽器模擬:**
1. 在電腦 Chrome 開啟: `http://192.168.50.171:5000`
2. 按 `F12` 開啟開發者工具
3. 點擊左上角的 "Toggle device toolbar" (手機圖示) 或按 `Ctrl+Shift+M`
4. 檢查以下項目

---

### 2️⃣ **檢查 Manifest (應用程式配置)**

在開發者工具中：
1. 切換到 **Application** 標籤
2. 左側選單點擊 **Manifest**
3. 確認看到：

```
✅ Name: 五金零件庫存管理系統
✅ Short name: 庫存管理
✅ Start URL: /
✅ Display: standalone
✅ Theme color: #0d6efd
✅ Icons:
   - icon-192.png (192x192)
   - icon-512.png (512x512)
```

**如果有錯誤，可能的原因：**
- ❌ JSON 格式錯誤
- ❌ 圖示路徑錯誤
- ❌ manifest.json 無法載入

---

### 3️⃣ **檢查 Service Worker**

在開發者工具中：
1. **Application** 標籤 → **Service Workers**
2. 確認看到：

```
✅ Source: /sw.js
✅ Status: activated and is running
✅ Updated: (時間戳記)
```

**如果沒有 Service Worker：**
- 檢查 Console 是否有錯誤訊息
- 確認 `/sw.js` 路徑可存取
- 在瀏覽器輸入: `http://192.168.50.171:5000/sw.js` 應該看到 JavaScript 程式碼

---

### 4️⃣ **檢查圖示檔案**

在瀏覽器中測試這些網址：

1. **Icon 192:** 
   ```
   http://192.168.50.171:5000/static/icon-192.png
   ```
   應該看到藍色工具箱圖示 ✅

2. **Icon 512:** 
   ```
   http://192.168.50.171:5000/static/icon-512.png
   ```
   應該看到更大的藍色工具箱圖示 ✅

3. **Favicon:**
   ```
   http://192.168.50.171:5000/static/favicon.ico
   ```
   應該看到小圖示 ✅

**如果看不到圖示：**
```bash
cd D:\456
python generate_icons.py
```

---

### 5️⃣ **檢查安裝條件**

PWA 需要滿足這些條件才會顯示「安裝」提示：

#### ✅ **已滿足的條件：**
- ✅ 有效的 `manifest.json`
- ✅ 註冊的 Service Worker
- ✅ 使用 HTTPS 或 localhost (開發環境)
- ✅ 至少有一個圖示 (192x192 或更大)
- ✅ `start_url` 已設定
- ✅ `display` 設為 `standalone` 或 `fullscreen`

#### ⚠️ **可能的問題：**
- ⚠️ 瀏覽器不支援 PWA (必須用 Chrome/Edge)
- ⚠️ 之前已拒絕安裝 (需清除瀏覽器資料)
- ⚠️ 網站已經安裝過了
- ⚠️ 使用隱私/無痕模式

---

### 6️⃣ **強制顯示安裝提示 (測試用)**

如果一直沒有出現安裝提示，可以在開發者工具中手動觸發：

1. 按 `F12` → **Application** 標籤
2. 左側選單 → **Manifest**
3. 點擊 **"Add to home screen"** 按鈕
4. 應該會跳出安裝對話框

---

### 7️⃣ **檢查 Console 訊息**

開啟 Console 標籤，應該看到：

```
✅ Service Worker 已註冊: ServiceWorkerRegistration
```

**如果看到錯誤：**
```
❌ Service Worker 註冊失敗: [錯誤訊息]
```

常見錯誤：
- `Failed to register: The script has an unsupported MIME type` 
  → sw.js 的 Content-Type 不正確
- `Failed to register: Service worker script does not exist`
  → /sw.js 路徑找不到

---

### 8️⃣ **清除快取並重試**

如果更改了 PWA 配置但沒有生效：

1. **清除所有快取：**
   - 按 `F12` → **Application** 標籤
   - 左側 **Storage** → **Clear site data**
   - 勾選所有項目
   - 點擊 **Clear site data**

2. **重新載入頁面：**
   - 按 `Ctrl+Shift+R` (強制重新整理)

3. **重新註冊 Service Worker：**
   - **Application** → **Service Workers**
   - 點擊 **Unregister**
   - 重新整理頁面

---

## 🎯 安裝提示觸發條件

### **Android Chrome 會在以下情況顯示「安裝」橫幅：**

1. ✅ 使用者訪問網站至少 **2 次**
2. ✅ 兩次訪問間隔至少 **5 分鐘**
3. ✅ 使用者在網站上有一定的互動 (點擊、滑動等)
4. ✅ 滿足所有 PWA 基本條件

### **繞過等待時間 (開發測試):**

方法 1: 使用開發者工具強制安裝 (如上述第 6 點)

方法 2: 啟用 Chrome Flags
1. 在 Chrome 輸入: `chrome://flags/#bypass-app-banner-engagement-checks`
2. 設定為 **Enabled**
3. 重新啟動 Chrome
4. 現在會立即顯示安裝提示

---

## 📱 現在請執行這些步驟：

### **在手機上測試：**

1. **清除瀏覽器資料** (如果之前訪問過)
   - Chrome → 設定 → 隱私權 → 清除瀏覽資料
   - 選擇「快取圖片和檔案」
   - 清除

2. **開啟網站**
   ```
   http://192.168.50.171:5000
   ```

3. **等待 5-10 秒**
   - 在網站上點擊幾個連結
   - 滑動頁面
   - 觸發互動

4. **查看安裝提示**
   - 應該會在底部出現橫幅
   - 或在網頁中央彈出提示
   - 或在瀏覽器選單中出現「安裝應用程式」選項

5. **手動安裝 (如果沒有自動提示)**
   - Chrome 選單 ⋮ → **安裝應用程式**
   - 或 **加入主畫面**

---

## 🐛 如果還是沒有出現...

請回報以下資訊：

1. **手機型號和作業系統：** _______________
2. **瀏覽器版本：** _______________
3. **Console 錯誤訊息：** _______________
4. **Manifest 狀態：** ✅ / ❌
5. **Service Worker 狀態：** ✅ / ❌
6. **圖示是否顯示：** ✅ / ❌

我會根據這些資訊進一步協助您！
