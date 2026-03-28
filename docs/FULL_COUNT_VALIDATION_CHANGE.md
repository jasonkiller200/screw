# 全盤點必填驗證功能實作

## 📋 修改摘要

### 目的
確保「全盤點」類型的盤點必須填寫所有項目的實盤數量（可填寫 0），不允許空白項目。

### 影響範圍
- ✅ **全盤點 (full)**：必須填寫所有項目
- ⏸️ **循環盤點 (cycle)**：維持原有彈性，可部分填寫
- ⏸️ **抽點 (spot)**：維持原有彈性，可部分填寫

---

## 🔧 修改內容

### 1. 後端驗證 (models/inventory.py)

**檔案**：`models/inventory.py`
**方法**：`StockCount.complete_count()`
**行數**：562-600

#### 修改前
```python
def complete_count(cls, count_id, verified_by='', apply_adjustments=False, user_id=None):
    count = cls.query.get(count_id)
    if not count:
        return False
    
    count.status = 'completed'
    # ... 繼續處理
    return True
```

#### 修改後
```python
def complete_count(cls, count_id, verified_by='', apply_adjustments=False, user_id=None):
    count = cls.query.get(count_id)
    if not count:
        return False, '找不到盤點記錄'
    
    # ✨ 新增：全盤點必須填寫所有項目
    if count.count_type == 'full':
        uncounted = StockCountDetail.query.filter_by(
            stock_count_id=count_id
        ).filter(StockCountDetail.counted_quantity.is_(None)).count()
        
        if uncounted > 0:
            return False, f'全盤點必須填寫所有項目的實盤數量（可填寫 0），還有 {uncounted} 項未填寫'
    
    count.status = 'completed'
    # ... 繼續處理
    return True, '盤點完成成功'
```

**改變**：
- ✅ 返回值從 `bool` 改為 `(bool, str)` tuple
- ✅ 針對全盤點加入完整性檢查
- ✅ 返回明確的錯誤訊息

---

### 2. API Controller 更新 (controllers/inventory_controller.py)

**檔案**：`controllers/inventory_controller.py`
**路由**：`/api/inventory/stock-counts/<int:count_id>/complete`
**行數**：351-366

#### 修改前
```python
success = StockCount.complete_count(count_id, verified_by, apply_adjustments, user_id=current_user.id)

if success:
    message = 'Stock count completed successfully'
    if apply_adjustments:
        message += ' and adjustments applied'
    return jsonify({'success': True, 'message': message})
else:
    return jsonify({'error': 'Failed to complete stock count'}), 500
```

#### 修改後
```python
success, message = StockCount.complete_count(count_id, verified_by, apply_adjustments, user_id=current_user.id)

if success:
    if apply_adjustments:
        message += '，差異調整已套用'
    return jsonify({'success': True, 'message': message})
else:
    return jsonify({'error': message}), 400  # 改為 400 更合適
```

**改變**：
- ✅ 接收 tuple 返回值
- ✅ 使用後端返回的訊息
- ✅ HTTP 狀態碼從 500 改為 400（客戶端錯誤）

---

### 3. 前端提示 (templates/inventory/stock_count_detail.html)

**檔案**：`templates/inventory/stock_count_detail.html`
**位置**：盤點明細卡片上方

#### 新增提示區塊
```html
{% if count_info.status == 'counting' and count_info.count_type == 'full' %}
<div class="alert alert-warning alert-dismissible fade show" role="alert">
    <i class="fas fa-exclamation-triangle me-2"></i>
    <strong>全盤點提醒：</strong>完成盤點前，必須填寫所有項目的實盤數量（可填寫 0）。未填寫的項目將無法完成盤點。
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>
{% endif %}
```

**改變**：
- ✅ 針對全盤點顯示警告提示
- ✅ 明確說明填寫要求
- ✅ 可關閉的提示框

---

### 4. 前端驗證 (static/js/inventory/stock_count_detail.js)

**檔案**：`static/js/inventory/stock_count_detail.js`
**函數**：`completeCounting()`
**行數**：397-449

#### 修改內容
```javascript
function completeCounting() {
    const stockCountCard = document.getElementById('stock-count-card');
    const countId = stockCountCard.dataset.countId;
    const countType = stockCountCard.dataset.countType;
    
    // ✨ 新增：全盤點前端預檢查
    if (countType === 'full') {
        const inputs = document.querySelectorAll('.count-input');
        let emptyCount = 0;
        inputs.forEach(input => {
            if (input.value === '' || input.value === null) {
                emptyCount++;
            }
        });
        
        if (emptyCount > 0) {
            alert(`全盤點必須填寫所有項目的實盤數量（可填寫 0）。\n目前還有 ${emptyCount} 項未填寫，請先完成填寫。`);
            return;
        }
    }
    
    // ... 繼續完成盤點流程
}
```

**改變**：
- ✅ 加入前端預檢查，避免無效 API 請求
- ✅ 提示具體未填寫數量
- ✅ 改善錯誤處理和訊息顯示

---

### 5. 說明文字更新

#### new_stock_count.html
```html
<strong class="text-primary">全盤點</strong>
<p class="small text-muted mb-0">盤點所選倉庫內的所有零件庫存，適用於年度或季度盤點。</p>
<p class="small text-danger mb-2">
    <i class="fas fa-exclamation-circle me-1"></i>
    <strong>注意：全盤點必須填寫所有項目的實盤數量（可填寫 0）</strong>
</p>
```

#### edit_stock_count.html
同樣的說明文字更新

**改變**：
- ✅ 在建立/編輯盤點頁面加入說明
- ✅ 使用紅色警告文字突顯要求

---

## 🧪 測試場景

### 場景 1：全盤點完整填寫（成功）
1. 建立全盤點
2. 填寫所有項目的實盤數量（包括填 0）
3. 點擊「完成盤點」
4. ✅ **預期結果**：成功完成盤點

### 場景 2：全盤點部分空白（失敗）
1. 建立全盤點
2. 只填寫部分項目的實盤數量
3. 點擊「完成盤點」
4. ❌ **預期結果**：
   - 前端立即提示：「還有 X 項未填寫」
   - 如果繞過前端檢查，後端返回：「全盤點必須填寫所有項目的實盤數量（可填寫 0），還有 X 項未填寫」

### 場景 3：循環盤點部分空白（成功）
1. 建立循環盤點
2. 只填寫部分項目的實盤數量
3. 點擊「完成盤點」
4. ✅ **預期結果**：成功完成盤點（維持原有彈性）

### 場景 4：抽點部分空白（成功）
1. 建立抽點
2. 只填寫部分項目的實盤數量
3. 點擊「完成盤點」
4. ✅ **預期結果**：成功完成盤點（維持原有彈性）

---

## 📊 驗證邏輯流程

```
使用者點擊「完成盤點」
    ↓
前端檢查 (JavaScript)
    ├─ 是全盤點？
    │   ├─ 是 → 檢查是否有空白項目
    │   │   ├─ 有空白 → 顯示錯誤，阻止提交
    │   │   └─ 無空白 → 繼續
    │   └─ 否 → 直接繼續
    ↓
發送 API 請求
    ↓
後端驗證 (Python)
    ├─ 盤點記錄存在？
    │   └─ 否 → 返回錯誤
    ↓
    ├─ 是全盤點？
    │   ├─ 是 → 查詢未填寫項目數量
    │   │   ├─ 有未填寫 → 返回錯誤訊息
    │   │   └─ 全部填寫 → 繼續
    │   └─ 否 → 直接繼續
    ↓
更新盤點狀態為「已完成」
    ↓
是否應用調整？
    ├─ 是 → 更新庫存
    └─ 否 → 只記錄
    ↓
返回成功訊息
```

---

## 📝 資料庫查詢

### 檢查未填寫項目數量
```python
uncounted = StockCountDetail.query.filter_by(
    stock_count_id=count_id
).filter(StockCountDetail.counted_quantity.is_(None)).count()
```

### SQL 等效語句
```sql
SELECT COUNT(*) 
FROM stock_count_details 
WHERE stock_count_id = ? 
  AND counted_quantity IS NULL
```

---

## 🔍 相容性說明

### 向後相容
- ✅ 循環盤點和抽點功能不受影響
- ✅ API 返回格式保持一致（JSON）
- ✅ 現有盤點記錄不受影響

### 破壞性變更
- ⚠️ `StockCount.complete_count()` 返回值從 `bool` 改為 `(bool, str)`
- ⚠️ 所有調用此方法的代碼都需要更新

---

## 📦 修改檔案清單

1. ✅ `models/inventory.py` - 後端驗證邏輯
2. ✅ `controllers/inventory_controller.py` - API 處理更新
3. ✅ `templates/inventory/stock_count_detail.html` - 提示訊息
4. ✅ `static/js/inventory/stock_count_detail.js` - 前端驗證
5. ✅ `templates/inventory/new_stock_count.html` - 說明文字
6. ✅ `templates/inventory/edit_stock_count.html` - 說明文字

---

## 🚀 部署注意事項

1. **資料庫無需變更** - 只是業務邏輯調整
2. **無需資料遷移** - 現有資料結構不變
3. **建議測試流程**：
   - 測試全盤點必填驗證
   - 測試循環盤點和抽點不受影響
   - 測試錯誤訊息顯示正確
4. **回滾計劃**：如有問題可直接回滾代碼，無資料庫變更風險

---

## 📖 使用說明

### 給使用者的說明
1. **全盤點**必須填寫所有項目的實盤數量
2. 如果某項目實際數量為 0，請填寫 0（不可留空）
3. 完成盤點前系統會檢查是否所有項目都已填寫
4. **循環盤點**和**抽點**維持彈性，可只填寫需要的項目

### 常見問題
**Q: 全盤點項目太多，可以分批填寫嗎？**  
A: 可以，但必須在點擊「完成盤點」前填寫完所有項目。建議使用「批量儲存」功能定期保存進度。

**Q: 某個零件真的是 0，要怎麼填？**  
A: 直接填寫數字 0 即可，不可留空。

**Q: 如果忘記填某幾項就點完成會怎樣？**  
A: 系統會阻止完成，並提示還有幾項未填寫。

**Q: 循環盤點和抽點也要全部填寫嗎？**  
A: 不用，這兩種類型維持彈性，可以只填寫需要盤點的項目。
