# 📷 條碼掃描調試指南

## 🔍 問題：相機開啟但無法掃描條碼/QR Code

### ✅ 已完成的改進

我已經重寫了條碼掃描功能：

1. **使用 ZXing 函式庫** - 支援多種條碼格式
2. **改善掃描循環** - 每 100ms 掃描一次
3. **顯示掃描狀態** - 即時顯示掃描次數
4. **震動回饋** - 掃描成功時震動提示
5. **詳細日誌** - 在控制台顯示詳細資訊

---

## 📋 支援的條碼格式

ZXing 支援以下格式：

### **1D 條碼（一維條碼）**
- ✅ **EAN-13** - 常見商品條碼
- ✅ **EAN-8** - 短版 EAN 條碼
- ✅ **UPC-A** - 美國商品條碼
- ✅ **UPC-E** - 短版 UPC
- ✅ **Code 39** - 工業用條碼
- ✅ **Code 93** - 改進版 Code 39
- ✅ **Code 128** - 高密度條碼
- ✅ **ITF** - 交錯 2/5 碼
- ✅ **Codabar** - 圖書館、血庫用

### **2D 條碼（二維碼）**
- ✅ **QR Code** - 最常見的 QR 碼
- ✅ **Data Matrix** - 小型 2D 碼
- ✅ **Aztec** - 墨西哥風格 2D 碼
- ✅ **PDF417** - 高容量條碼

---

## 🧪 測試步驟

### **步驟 1: 訪問測試頁面**

```
https://192.168.50.171:5000/camera-test
```

這個頁面會：
- 顯示掃描次數
- 顯示條碼格式
- 提供詳細的控制台日誌

### **步驟 2: 開啟瀏覽器控制台**

**Android Chrome:**
1. 點擊右上角 ⋮ 選單
2. 選擇「更多工具」→「開發人員工具」
3. 切換到「Console」標籤

**或在電腦上遠端除錯:**
1. 電腦 Chrome 輸入: `chrome://inspect#devices`
2. 確認手機已連線（USB 偵錯）
3. 點擊 "inspect"

### **步驟 3: 測試掃描**

1. 點擊「開啟相機」
2. 查看控制台訊息：
   ```
   ✅ ZXing 載入成功
   ✅ 條碼掃描器已初始化
   Canvas 尺寸: 1280 x 720
   ```

3. 將條碼對準相機
4. 觀察控制台的掃描狀態

---

## 🎯 掃描技巧

### **光線和距離**

1. **充足光線**
   - 確保條碼有足夠照明
   - 避免陰影遮擋
   - 避免強烈反光

2. **適當距離**
   - **1D 條碼**: 距離 10-30 公分
   - **QR Code**: 距離 15-40 公分
   - 太近會模糊，太遠解析度不足

3. **保持穩定**
   - 手機和條碼都要穩定
   - 避免晃動
   - 對焦清晰

### **條碼方向**

1. **1D 條碼（一般條碼）**
   - 橫向放置（條紋是垂直的）
   - 確保整個條碼都在畫面內
   - 條碼要填滿畫面約 60-80%

2. **QR Code**
   - 正方形完全在畫面內
   - 四個角的定位標記要清楚
   - 可以任何角度旋轉

### **條碼品質**

✅ **良好條碼:**
- 清晰列印
- 對比度高
- 沒有污漬或損壞
- 沒有皺摺

❌ **問題條碼:**
- 模糊、褪色
- 對比度低（灰色背景）
- 有污漬、刮痕
- 皺摺或變形

---

## 🔧 疑難排解

### **問題 1: 控制台顯示 "NotFoundException"**

**這是正常的！**
- `NotFoundException` 表示「沒找到條碼」
- 掃描器會持續嘗試，直到找到條碼
- 如果看到很多次，表示掃描正在進行中

**解決方案：**
- 調整條碼距離和角度
- 確保光線充足
- 檢查條碼品質

### **問題 2: 看到 "正在掃描... (第 X 次)" 但沒有結果**

**可能原因：**
1. 條碼格式不支援（少見）
2. 條碼品質差
3. 光線不足
4. 距離不對

**診斷步驟：**

1. **測試已知條碼：**
   - 在電腦螢幕顯示 QR Code
   - 用手機掃描電腦螢幕
   - 螢幕亮度調高

2. **生成測試 QR Code：**
   訪問：https://www.qr-code-generator.com/
   - 輸入 "TEST123"
   - 生成 QR Code
   - 用手機掃描

3. **檢查控制台輸出：**
   ```javascript
   // 正常運作應該看到：
   ✅ ZXing 載入成功
   ✅ 條碼掃描器已初始化
   Canvas 尺寸: 1280 x 720
   🔍 正在掃描... (第 10 次)
   🔍 正在掃描... (第 20 次)
   ```

### **問題 3: 掃描速度很慢**

**正常現象：**
- 每 100ms 掃描一次（每秒 10 次）
- 這是為了平衡效能和準確度

**如果需要更快：**
在控制台執行：
```javascript
// 改為每 50ms 掃描一次
// 找到 setTimeout(scan, 100); 改為 50
```

### **問題 4: 某些條碼可以掃，某些不行**

**可能原因：**
1. 條碼格式不同
2. 條碼品質差異
3. 尺寸問題

**測試方法：**
1. 在測試頁面測試成功的條碼
2. 查看控制台顯示的格式
3. 比較不同條碼的特性

---

## 💡 除錯技巧

### **啟用詳細日誌**

在控制台執行：

```javascript
// 查看當前掃描器狀態
console.log('掃描器活動:', scannerActive);
console.log('影片串流:', videoStream);
console.log('Code Reader:', codeReader);

// 手動測試掃描一次
const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
const ctx = canvas.getContext('2d');

if (video && canvas) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    console.log('ImageData:', imageData.width, 'x', imageData.height);
    
    // 嘗試解碼
    const reader = new ZXing.BrowserMultiFormatReader();
    reader.decodeFromImageData(imageData)
        .then(result => console.log('✅ 掃描成功:', result))
        .catch(err => console.log('❌ 沒找到:', err.message));
}
```

### **檢查 Canvas 繪製**

```javascript
// 顯示 canvas 內容（用於除錯）
const canvas = document.getElementById('scanner-canvas');
canvas.style.display = 'block';
canvas.style.position = 'static';
```

這樣可以看到掃描器實際看到的畫面。

### **測試 ZXing 是否正常載入**

```javascript
console.log('ZXing 是否載入:', typeof ZXing !== 'undefined');
if (typeof ZXing !== 'undefined') {
    console.log('ZXing 版本:', ZXing);
    const reader = new ZXing.BrowserMultiFormatReader();
    console.log('支援的格式:', reader.hints);
}
```

---

## 📸 最佳實踐

### **建議的掃描環境**

1. **光線**
   - 自然光或日光燈
   - 避免直射陽光
   - 避免強烈陰影

2. **背景**
   - 乾淨、單色背景
   - 避免複雜圖案
   - 與條碼對比度高

3. **條碼**
   - 平整、無皺摺
   - 清晰列印
   - 適當尺寸

### **使用者指導**

建議在界面上顯示：

```
📷 掃描技巧：
• 保持手機穩定
• 條碼與相機距離 15-30 公分
• 確保光線充足
• 條碼平整、完整在畫面中
• 耐心等待 2-3 秒
```

---

## 🎯 效能優化

### **當前設定**

- ✅ 掃描間隔: 100ms（每秒 10 次）
- ✅ Canvas 尺寸: 自動偵測（通常 1280x720）
- ✅ 支援格式: 全部

### **如果需要提高速度**

調整掃描間隔（在 part_lookup.html 中）：

```javascript
// 更快但耗電
setTimeout(scan, 50); // 每秒 20 次

// 更慢但省電
setTimeout(scan, 200); // 每秒 5 次
```

### **如果需要限制格式**

只掃描特定格式：

```javascript
// 只掃描 QR Code
codeReader = new ZXing.BrowserQRCodeReader();

// 只掃描 EAN 條碼
codeReader = new ZXing.BrowserEAN13Reader();
```

---

## ✅ 成功檢查清單

確認以下項目：

- [ ] 使用 HTTPS 連線
- [ ] 相機權限已允許
- [ ] 控制台顯示「✅ ZXing 載入成功」
- [ ] 控制台顯示「✅ 條碼掃描器已初始化」
- [ ] 控制台顯示「Canvas 尺寸: ...」
- [ ] 看到「🔍 正在掃描...」訊息
- [ ] 條碼光線充足
- [ ] 條碼距離適當（15-30cm）
- [ ] 條碼品質良好
- [ ] 整個條碼在畫面內

---

## 🆘 仍然無法掃描？

請提供以下資訊：

1. **測試結果：**
   - 訪問 `/camera-test` 的結果：___________
   - 控制台完整訊息：___________

2. **條碼資訊：**
   - 條碼類型：1D 條碼 / QR Code / 其他
   - 條碼內容（如果知道）：___________
   - 條碼來源：列印 / 螢幕 / 商品

3. **控制台輸出：**
   ```
   貼上控制台的完整輸出
   ```

4. **測試圖片：**
   - 拍一張您嘗試掃描的條碼照片

我會根據這些資訊提供更具體的協助！
