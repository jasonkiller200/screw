# 倉庫下拉選單修復說明

## 問題檢查結果

### ✅ 所有前端倉庫下拉選單都是從資料庫拉取的

**確認結果：**
- ✅ **不是寫死的**
- ✅ 所有頁面都使用 `Warehouse.get_all()` 方法從資料庫獲取倉庫列表
- ✅ 控制器傳遞 `warehouses` 變量到模板

### 📊 當前資料庫狀態

```python
Warehouse.get_all() 返回 3 筆倉庫：
1. {'id': 1, 'code': 'WH01', 'name': '主倉庫', 'description': '主要存放倉庫'}
2. {'id': 2, 'code': 'WH02', 'name': '副倉庫', 'description': '次要存放倉庫'}
3. {'id': 3, 'code': 'WH03', 'name': '工具倉', 'description': '工具專用倉庫'}
```

**注意：** 資料庫實際只有 3 個倉庫，不是 4 個。

## 已修復的問題

### 問題 1：模板中倉庫屬性訪問方式不一致

**原因：** 部分模板使用對象屬性語法（`warehouse.id`），但 `Warehouse.get_all()` 返回字典列表

**影響範圍：**
- ❌ `templates/inventory/index.html`
- ❌ `templates/inventory/stock_in.html`
- ❌ `templates/inventory/stock_out.html`
- ❌ `templates/inventory/transactions.html`
- ❌ `templates/inventory/new_stock_count.html`

**修復：** 統一使用字典訪問語法 `warehouse['id']`, `warehouse['name']`, `warehouse['code']`

### 問題 2：倉位管理頁面看不到倉庫資訊

**原因：** 頁面只顯示倉位列表，沒有顯示倉庫摘要

**修復：** 在倉位管理頁面頂部新增倉庫摘要卡片，顯示所有倉庫資訊

## 修復內容詳情

### 1. 庫存相關模板 - 倉庫下拉選單

**修改前：**
```html
{% for warehouse in warehouses %}
<option value="{{ warehouse.id }}">{{ warehouse.name }}</option>
{% endfor %}
```

**修改後：**
```html
{% for warehouse in warehouses %}
<option value="{{ warehouse['id'] }}">{{ warehouse['name'] }}</option>
{% endfor %}
```

**修改檔案：**
- `templates/inventory/index.html`
- `templates/inventory/stock_in.html`
- `templates/inventory/stock_out.html`
- `templates/inventory/transactions.html`
- `templates/inventory/new_stock_count.html`

### 2. 倉位管理頁面 - 新增倉庫摘要區域

**新增功能：**
```html
<!-- 倉庫摘要卡片 -->
<div class="card">
    <div class="card-header">
        <h6 class="mb-0"><i class="fas fa-building me-1"></i>現有倉庫</h6>
    </div>
    <div class="card-body">
        {% for warehouse in warehouses %}
        <div class="card bg-light">
            <div class="card-body py-2">
                <h6 class="mb-0">{{ warehouse['name'] }}</h6>
                <small class="text-muted">{{ warehouse['code'] }}</small>
                <p class="mb-0 small">{{ warehouse['description'] }}</p>
            </div>
        </div>
        {% endfor %}
        總計 <strong>{{ warehouses|length }}</strong> 個倉庫
    </div>
</div>
```

**效果：**
- ✅ 在倉位管理頁面頂部顯示所有倉庫
- ✅ 顯示倉庫名稱、編號、描述
- ✅ 顯示倉庫總數

## 資料流程

### 控制器層
```python
# controllers/web_controller.py
@web_bp.route('/inventory')
def inventory():
    warehouses = Warehouse.get_all()  # 從資料庫獲取
    # ... 傳遞到模板
```

### 模型層
```python
# models/part.py - Warehouse 類別
@classmethod
def get_all(cls):
    """取得所有啟用的倉庫"""
    warehouses = cls.query.filter_by(is_active=True).all()
    return [warehouse.to_dict() for warehouse in warehouses]
```

### 視圖層
```html
<!-- 模板 -->
<select class="form-select" name="warehouse_id">
    <option value="">選擇倉庫</option>
    {% for warehouse in warehouses %}
    <option value="{{ warehouse['id'] }}">
        {{ warehouse['code'] }} - {{ warehouse['name'] }}
    </option>
    {% endfor %}
</select>
```

## 使用倉庫下拉選單的頁面清單

### ✅ 已確認從資料庫拉取

| 頁面 | 路由 | 檔案 | 狀態 |
|------|------|------|------|
| 零件表單 | `/parts/new`, `/parts/<id>/edit` | `part_form.html` | ✅ 正確 |
| 庫存管理 | `/inventory` | `inventory/index.html` | ✅ 已修復 |
| 入庫作業 | `/inventory/stock-in` | `inventory/stock_in.html` | ✅ 已修復 |
| 出庫作業 | `/inventory/stock-out` | `inventory/stock_out.html` | ✅ 已修復 |
| 交易記錄 | `/inventory/transactions` | `inventory/transactions.html` | ✅ 已修復 |
| 新增盤點 | `/inventory/stock-counts/new` | `inventory/new_stock_count.html` | ✅ 已修復 |
| 倉位管理 | `/warehouse-locations` | `warehouse_locations.html` | ✅ 已修復 |

## 如何新增倉庫

### 方法 1：倉位管理頁面（推薦）
1. 進入「倉位管理」頁面
2. 點擊「新增倉庫」按鈕
3. 填寫倉庫資訊：
   - 倉庫編號（唯一）
   - 倉庫名稱
   - 描述（選填）
4. 儲存

### 方法 2：資料庫直接新增
```python
from app import app
from extensions import db
from models.part import Warehouse

with app.app_context():
    new_wh = Warehouse(
        code='WH04',
        name='新倉庫',
        description='描述',
        is_active=True
    )
    db.session.add(new_wh)
    db.session.commit()
```

## 驗證方式

### 檢查倉庫數量
```python
from app import app
from models.part import Warehouse

with app.app_context():
    warehouses = Warehouse.get_all()
    print(f"倉庫數量: {len(warehouses)}")
    for wh in warehouses:
        print(f"  - {wh['code']}: {wh['name']}")
```

### 檢查下拉選單
1. 開啟任何包含倉庫下拉選單的頁面
2. 查看下拉選單是否顯示所有倉庫
3. 新增倉庫後，重新整理頁面確認新倉庫出現

## 注意事項

### 倉庫顯示條件
只有 `is_active=True` 的倉庫會顯示在下拉選單中。

### 倉庫編號唯一性
倉庫編號（`code`）必須唯一，新增時會檢查。

### 無法刪除有倉位的倉庫
如果倉庫下有倉位，無法直接刪除倉庫（需要先刪除或移動倉位）。

## 總結

✅ **所有倉庫下拉選單都是從資料庫動態載入的**
- 不是寫死的
- 使用 `Warehouse.get_all()` 方法
- 自動顯示所有啟用的倉庫

✅ **已修復所有模板的倉庫屬性訪問方式**
- 統一使用字典語法 `warehouse['id']`
- 修復 5 個庫存相關模板

✅ **倉位管理頁面現在顯示倉庫摘要**
- 在頁面頂部顯示所有倉庫卡片
- 包含倉庫名稱、編號、描述
- 顯示倉庫總數

✅ **當前資料庫有 3 個倉庫**
- 主倉庫 (WH01)
- 副倉庫 (WH02)
- 工具倉 (WH03)
