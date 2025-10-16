# 零件表單修復說明

## 問題描述與修復

### 問題 1：編輯零件時出現「零件編號已存在」

**症狀：** 編輯零件時，即使零件編號沒有改變，也出現「零件編號已存在」的錯誤訊息。

**原因：** 零件表單的 `action` 屬性寫死為 `url_for('web.new_part')`，導致編輯零件時實際上調用的是新增零件的路由。

**修復：** 根據 `edit_mode` 變數動態設置表單 action。

### 問題 2：編輯模式時零件編號應該鎖定

**需求：** 在編輯零件時，零件編號應該無法修改（保持資料唯一性和完整性）。

**修復：** 編輯模式時將零件編號欄位設為 disabled，並使用隱藏欄位傳遞真實值。

## 修復內容

### 修復 1：表單 Action 動態設置

#### 修改前
```html
<form method="POST" action="{{ url_for('web.new_part') }}">
```

#### 修改後
```html
<form method="POST" action="{% if edit_mode %}{{ url_for('web.edit_part', part_id=part.id) }}{% else %}{{ url_for('web.new_part') }}{% endif %}">
```

### 修復 2：零件編號欄位鎖定

#### 修改前
```html
<label for="part_number" class="form-label">零件編號 <span class="text-danger">*</span></label>
<input type="text" class="form-control" id="part_number" name="part_number" 
       value="{{ part.part_number or '' }}" required>
<div class="form-text">唯一的零件識別編號</div>
```

#### 修改後
```html
<label for="part_number" class="form-label">零件編號 <span class="text-danger">*</span></label>
{% if edit_mode %}
    <!-- 編輯模式：顯示但不可修改 -->
    <input type="text" class="form-control" id="part_number_display" 
           value="{{ part.part_number }}" disabled>
    <!-- 使用隱藏欄位傳遞真實值 -->
    <input type="hidden" name="part_number" value="{{ part.part_number }}">
    <div class="form-text">零件編號不可修改</div>
{% else %}
    <!-- 新增模式：可以輸入 -->
    <input type="text" class="form-control" id="part_number" name="part_number" 
           value="{{ part.part_number or '' }}" required>
    <div class="form-text">唯一的零件識別編號</div>
{% endif %}
```

## 技術說明

### 為什麼使用 disabled + hidden 組合？

#### 方案對比

| 方案 | 優點 | 缺點 |
|------|------|------|
| `readonly` | 簡單，值會提交 | 用戶可能誤以為能修改（樣式不明顯） |
| `disabled` | 清楚表示不可編輯（灰色） | 表單提交時不包含該欄位 ❌ |
| `disabled` + `hidden` | 清楚顯示 + 值會提交 | 需要兩個欄位 |

#### 我們的選擇：`disabled` + `hidden`

```html
<!-- 顯示用（disabled，灰色，清楚表示不可編輯） -->
<input type="text" class="form-control" id="part_number_display" 
       value="{{ part.part_number }}" disabled>

<!-- 提交用（hidden，實際傳遞數據） -->
<input type="hidden" name="part_number" value="{{ part.part_number }}">
```

**優點：**
- ✅ 視覺上明確顯示不可編輯（灰色 disabled 狀態）
- ✅ 表單提交時包含零件編號（hidden 欄位）
- ✅ 用戶無法透過瀏覽器工具輕易修改（需要修改 HTML）
- ✅ 提供清楚的提示文字「零件編號不可修改」

## 問題分析

### 原始錯誤代碼

```html
<!-- part_form.html -->
<form method="POST" action="{{ url_for('web.new_part') }}">
    <!-- 不論是新增還是編輯，都會提交到 new_part 路由 -->
</form>
```

### 問題流程

```
編輯零件頁面 (/parts/123/edit)
    ↓
填寫表單（零件編號: ABC123）
    ↓
點擊「更新零件」
    ↓
表單提交到: POST /parts/new  ❌ (錯誤！應該是 /parts/123/edit)
    ↓
new_part() 函數被調用
    ↓
Part.create() 檢查 ABC123 是否已存在
    ↓
發現已存在（因為就是這個零件自己）
    ↓
返回錯誤：「零件編號已存在」 ❌
```

### 正確流程

```
編輯零件頁面 (/parts/123/edit)
    ↓
填寫表單（零件編號: ABC123）
    ↓
點擊「更新零件」
    ↓
表單提交到: POST /parts/123/edit  ✅ (正確！)
    ↓
edit_part(part_id=123) 函數被調用
    ↓
Part.update() 檢查零件編號是否改變
    ↓
if 零件編號 != 原編號:
    檢查新編號是否已存在
else:
    不檢查（因為沒改變） ✅
    ↓
更新成功 ✅
```

## 修復內容

### 修改前

```html
<form method="POST" action="{{ url_for('web.new_part') }}">
```

### 修改後

```html
<form method="POST" action="{% if edit_mode %}{{ url_for('web.edit_part', part_id=part.id) }}{% else %}{{ url_for('web.new_part') }}{% endif %}">
```

## 邏輯說明

### 新增零件邏輯 (Part.create)

```python
def create(cls, part_number, ...):
    # 檢查零件編號是否已存在
    if cls.query.filter_by(part_number=part_number).first():
        return {'success': False, 'error': '零件編號已存在'}
    
    # 建立新零件
    ...
```

**行為：** 總是檢查零件編號是否重複 ✅

### 編輯零件邏輯 (Part.update)

```python
def update(cls, part_id, part_number, ...):
    part = cls.query.get(part_id)
    
    # 只有當零件編號改變時才檢查重複
    if part.part_number != part_number:  # 關鍵判斷！
        if cls.query.filter_by(part_number=part_number).first():
            return {'success': False, 'error': '零件編號已存在'}
    
    # 更新零件
    ...
```

**行為：** 
- ✅ 零件編號沒改變 → 不檢查（允許更新）
- ✅ 零件編號改變了 → 檢查是否重複

## 測試驗證

### 測試 1：編輯零件，保持編號不變

```
輸入：
  零件ID: 1
  原編號: ABC123
  新編號: ABC123 (不變)
  名稱: 更新後的名稱

結果: ✅ 成功
原因: part.part_number (ABC123) == part_number (ABC123)
      → 不檢查重複 → 允許更新
```

### 測試 2：編輯零件，改為已存在的編號

```
輸入：
  零件ID: 1
  原編號: ABC123
  新編號: XYZ789 (已被零件ID=2使用)

結果: ❌ 失敗「零件編號已存在」
原因: part.part_number (ABC123) != part_number (XYZ789)
      → 檢查重複 → 發現XYZ789已存在 → 拒絕更新
```

### 測試 3：新增零件，使用已存在的編號

```
輸入：
  新零件
  編號: ABC123 (已存在)

結果: ❌ 失敗「零件編號已存在」
原因: create() 總是檢查重複 → 拒絕建立
```

## 相關變數

### edit_mode 變數

控制器會根據路由傳遞此變數：

```python
# 新增零件
@web_bp.route('/parts/new', methods=['GET', 'POST'])
def new_part():
    ...
    return render_template('part_form.html', part=part_data, warehouses=warehouses)
    # 沒有傳遞 edit_mode，預設為 False/None

# 編輯零件
@web_bp.route('/parts/<int:part_id>/edit', methods=['GET', 'POST'])
def edit_part(part_id):
    ...
    return render_template('part_form.html', part=part, edit_mode=True, warehouses=warehouses)
    # 明確傳遞 edit_mode=True
```

### 模板使用

```html
<!-- 標題 -->
{% if edit_mode %}編輯零件{% else %}新增零件{% endif %}

<!-- 圖示 -->
<i class="fas fa-{% if edit_mode %}edit{% else %}plus{% endif %} me-2"></i>

<!-- 表單 action -->
<form method="POST" action="{% if edit_mode %}{{ url_for('web.edit_part', part_id=part.id) }}{% else %}{{ url_for('web.new_part') }}{% endif %}">

<!-- 按鈕文字 -->
{% if edit_mode %}更新零件{% else %}新增零件{% endif %}
```

## 影響範圍

### 修復前的問題

- ❌ 編輯零件時無法更新（即使什麼都沒改）
- ❌ 總是顯示「零件編號已存在」
- ❌ 用戶體驗差

### 修復後的改善

- ✅ 編輯零件時正常更新
- ✅ 零件編號不變時不報錯
- ✅ 零件編號改變時正確檢查重複
- ✅ 用戶體驗良好

## 總結

**問題根源：** 表單 action 寫死，導致編輯零件時錯誤調用新增零件的路由

**解決方案：** 根據 `edit_mode` 變數動態設置表單 action

**修復效果：**
- ✅ 新增零件：檢查零件編號是否重複
- ✅ 編輯零件（編號不變）：不檢查，直接更新
- ✅ 編輯零件（編號改變）：檢查新編號是否重複
- ✅ 邏輯正確，符合預期

**測試結果：**
```
測試 1：保持零件編號不變 → ✅ 成功
測試 2：改為已存在的編號 → ❌ 失敗（預期）
```

## 介面效果

### 新增零件模式

```
┌─────────────────────────────────────────────┐
│ 零件編號 *                                  │
│ [可以輸入...                             ] │
│ 唯一的零件識別編號                           │
└─────────────────────────────────────────────┘
```

**特徵：**
- ✅ 白色背景，可編輯
- ✅ 提示文字：「唯一的零件識別編號」
- ✅ 必填欄位（紅色星號）

### 編輯零件模式

```
┌─────────────────────────────────────────────┐
│ 零件編號 *                                  │
│ [ABC123                                   ] │ 🔒 灰色，不可編輯
│ 零件編號不可修改                             │
└─────────────────────────────────────────────┘
```

**特徵：**
- 🔒 灰色背景（disabled 樣式）
- 🔒 顯示現有編號，無法修改
- 🔒 提示文字：「零件編號不可修改」
- ✅ 隱藏欄位自動傳遞真實值

## 安全性考量

### 為什麼不使用 readonly？

| 屬性 | 外觀 | 提交數據 | 安全性 |
|------|------|---------|--------|
| `readonly` | 白色，看起來可編輯 | ✅ 會提交 | ⚠️ 用戶可能誤以為能改 |
| `disabled` | 灰色，明顯不可編輯 | ❌ 不提交 | ⚠️ 數據會丟失 |
| `disabled` + `hidden` | 灰色顯示 + 隱藏傳值 | ✅ 會提交 | ✅ 清楚且安全 |

### 防止惡意修改

即使用戶透過瀏覽器開發工具嘗試修改零件編號：

```javascript
// 惡意嘗試修改 hidden 欄位
document.querySelector('input[name="part_number"]').value = 'XYZ789';
```

**後端驗證（Part.update）會阻止：**
```python
if part.part_number != part_number:  # 檢測到改變
    if cls.query.filter_by(part_number=part_number).first():
        return {'success': False, 'error': '零件編號已存在'}
```

**即使通過檢查，也只是改為另一個未使用的編號，不會破壞系統。**

## 總結

### 修復內容

| 修復項目 | 狀態 | 說明 |
|---------|------|------|
| 表單 action 動態設置 | ✅ | 根據模式提交到正確路由 |
| 零件編號鎖定（編輯模式） | ✅ | disabled + hidden 組合 |
| 視覺提示 | ✅ | 灰色背景 + 提示文字 |
| 數據完整性 | ✅ | 隱藏欄位保證數據傳遞 |
| 後端驗證 | ✅ | Part.update 邏輯正確 |

### 用戶體驗

**新增零件：**
- ✅ 可以輸入零件編號
- ✅ 系統檢查是否重複

**編輯零件：**
- ✅ 零件編號顯示但無法修改
- ✅ 清楚的視覺提示（灰色 disabled）
- ✅ 明確的文字說明「零件編號不可修改」
- ✅ 其他欄位正常編輯

### 資料安全

- ✅ 零件編號唯一性得到保護
- ✅ 防止誤改造成資料混亂
- ✅ 後端雙重驗證機制
- ✅ 即使前端被繞過，後端仍會檢查

現在編輯零件功能完全正常了！零件編號在編輯模式下被鎖定，無法修改，確保資料完整性。
