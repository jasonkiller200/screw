# 庫存模型修復說明

## 問題描述

**錯誤訊息：**
```
jinja2.exceptions.UndefinedError: 'models.inventory.CurrentInventory object' has no attribute 'reorder_point'
```

**位置：** `templates/inventory/index.html` - Line 146

**原因：**
- `CurrentInventory.get_all_inventory()` 返回 SQLAlchemy 對象列表
- 模板嘗試直接訪問 `inventory.reorder_point`
- 但 `reorder_point` 是 Part 模型的屬性，不是 CurrentInventory 的屬性
- 需要透過 `inventory.part.reorder_point` 訪問，但模板使用的是 `inventory.reorder_point`

## 修復方案

### 方案選擇

有兩種方案：

**方案 1：修改模板**
- 優點：不改變模型行為
- 缺點：模板代碼複雜，需要改很多地方

**方案 2：修改模型返回字典**  ✅ 採用
- 優點：模板代碼簡潔，統一數據格式
- 缺點：需要修改模型方法

### 修復內容

#### 1. CurrentInventory.get_all_inventory()

**修改前：**
```python
@classmethod
def get_all_inventory(cls, warehouse_id=None):
    query = cls.query.join(Part).join(Warehouse)
    if warehouse_id:
        query = query.filter(cls.warehouse_id == warehouse_id)
    return query.order_by(Warehouse.code, Part.part_number).all()
    # 返回 List[CurrentInventory 對象]
```

**修改後：**
```python
@classmethod
def get_all_inventory(cls, warehouse_id=None):
    query = cls.query.join(Part).join(Warehouse)
    if warehouse_id:
        query = query.filter(cls.warehouse_id == warehouse_id)
    inventories = query.order_by(Warehouse.code, Part.part_number).all()
    return [inv.to_dict() for inv in inventories]
    # 返回 List[Dict]
```

**改善：**
- ✅ 返回字典列表
- ✅ 包含所有需要的字段（透過 `to_dict()`）
- ✅ 模板可以直接訪問 `inventory['reorder_point']` 或 `inventory.reorder_point`

#### 2. CurrentInventory.get_low_stock_items()

**修改前：**
```python
@classmethod
def get_low_stock_items(cls, warehouse_id=None):
    query = cls.query.join(Part).join(Warehouse)
    if warehouse_id:
        query = query.filter(cls.warehouse_id == warehouse_id)
    query = query.filter(cls.available_quantity <= Part.reorder_point)
    return query.order_by(cls.available_quantity - Part.reorder_point).all()
    # 返回 List[CurrentInventory 對象]
```

**修改後：**
```python
@classmethod
def get_low_stock_items(cls, warehouse_id=None):
    query = cls.query.join(Part).join(Warehouse)
    if warehouse_id:
        query = query.filter(cls.warehouse_id == warehouse_id)
    query = query.filter(cls.available_quantity <= Part.reorder_point)
    items = query.order_by(cls.available_quantity - Part.reorder_point).all()
    return [item.to_dict() for item in items]
    # 返回 List[Dict]
```

**改善：**
- ✅ 統一返回格式
- ✅ 模板可直接訪問所有字段

#### 3. CurrentInventory.get_current_stock()

**修改前：**
```python
@classmethod
def get_current_stock(cls, part_id, warehouse_id=None):
    query = cls.query.filter_by(part_id=part_id)
    if warehouse_id:
        return query.filter_by(warehouse_id=warehouse_id).first()
        # 返回 CurrentInventory 對象 或 None
    return query.all()
    # 返回 List[CurrentInventory 對象]
```

**修改後：**
```python
@classmethod
def get_current_stock(cls, part_id, warehouse_id=None):
    query = cls.query.filter_by(part_id=part_id)
    if warehouse_id:
        stock = query.filter_by(warehouse_id=warehouse_id).first()
        return stock.to_dict() if stock else None
        # 返回 Dict 或 None
    stocks = query.all()
    return [stock.to_dict() for stock in stocks]
    # 返回 List[Dict]
```

**改善：**
- ✅ 統一返回字典格式
- ✅ 在出庫功能中可直接訪問 `stock['available_quantity']`

## to_dict() 方法包含的字段

CurrentInventory 的 `to_dict()` 方法返回以下字段：

```python
{
    'id': int,                          # 庫存記錄ID
    'part_id': int,                     # 零件ID
    'warehouse_id': int,                # 倉庫ID
    'quantity_on_hand': int,            # 在庫數量
    'reserved_quantity': int,           # 保留數量
    'available_quantity': int,          # 可用數量
    'last_updated': str,                # 最後更新時間
    'part_number': str,                 # 零件編號 (來自 Part)
    'part_name': str,                   # 零件名稱 (來自 Part)
    'unit': str,                        # 單位 (來自 Part)
    'safety_stock': int,                # 安全庫存 (來自 Part)
    'reorder_point': int,               # 補貨點 (來自 Part)
    'warehouse_name': str,              # 倉庫名稱 (來自 Warehouse)
    'warehouse_code': str,              # 倉庫編號 (來自 Warehouse)
}
```

**關鍵字段：**
- ✅ `reorder_point` - 從 Part 模型獲取
- ✅ `safety_stock` - 從 Part 模型獲取
- ✅ `warehouse_name` - 從 Warehouse 模型獲取
- ✅ `warehouse_code` - 從 Warehouse 模型獲取

## 模板訪問方式

### 修改前（不可用）

```html
<!-- ❌ 無法訪問，因為 CurrentInventory 對象沒有 reorder_point 屬性 -->
{{ inventory.reorder_point }}

<!-- ✅ 可以但很冗長 -->
{{ inventory.part.reorder_point }}
```

### 修改後（可用）

```html
<!-- ✅ 可以使用，字典支持屬性訪問 -->
{{ inventory.reorder_point }}

<!-- ✅ 也可以使用字典語法 -->
{{ inventory['reorder_point'] }}
```

## 影響範圍

### 已修改的方法

| 方法 | 修改前返回 | 修改後返回 | 影響 |
|------|-----------|-----------|------|
| `get_all_inventory()` | List[Object] | List[Dict] | ✅ 庫存管理首頁 |
| `get_low_stock_items()` | List[Object] | List[Dict] | ✅ 庫存管理首頁（低庫存警示） |
| `get_current_stock()` | Object/List | Dict/List[Dict] | ✅ 出庫功能 |

### 使用這些方法的地方

| 位置 | 方法 | 狀態 |
|------|------|------|
| `controllers/web_controller.py:325` | `get_all_inventory()` | ✅ 正常 |
| `controllers/web_controller.py:326` | `get_low_stock_items()` | ✅ 正常 |
| `controllers/web_controller.py:430` | `get_current_stock()` | ✅ 正常 |
| `templates/inventory/index.html` | 顯示庫存列表 | ✅ 正常 |

## 測試驗證

### 測試 1：數據格式

```python
from models.inventory import CurrentInventory

inventories = CurrentInventory.get_all_inventory()

# 檢查返回類型
print(type(inventories))  # <class 'list'>
print(type(inventories[0]))  # <class 'dict'>

# 檢查包含的字段
print(inventories[0].keys())
# dict_keys(['id', 'part_id', 'warehouse_id', 'quantity_on_hand', 
#            'reserved_quantity', 'available_quantity', 'last_updated',
#            'part_number', 'part_name', 'unit', 'safety_stock', 
#            'reorder_point', 'warehouse_name', 'warehouse_code'])
```

**結果：** ✅ 通過

### 測試 2：模板訪問

```html
<!-- 庫存管理首頁模板 -->
{% for inventory in inventories %}
    <td>{{ inventory.part_number }}</td>
    <td>{{ inventory.available_quantity }}</td>
    <td>{{ inventory.reorder_point }}</td>  <!-- ✅ 可以訪問 -->
{% endfor %}
```

**結果：** ✅ 通過

### 測試 3：出庫功能

```python
# 檢查庫存
current_stock = CurrentInventory.get_current_stock(part.id, warehouse_id)

# 訪問可用數量
if current_stock['available_quantity'] < quantity:  # ✅ 可以訪問
    flash('庫存不足', 'error')
```

**結果：** ✅ 通過

## 數據一致性

### 統一的返回格式

修改後，所有庫存相關的查詢方法統一返回字典格式：

| 模型 | 方法 | 返回格式 |
|------|------|---------|
| `CurrentInventory` | `get_all_inventory()` | List[Dict] ✅ |
| `CurrentInventory` | `get_low_stock_items()` | List[Dict] ✅ |
| `CurrentInventory` | `get_current_stock()` | Dict/List[Dict] ✅ |
| `Warehouse` | `get_all()` | List[Dict] ✅ |
| `Part` | `get_all()` | List[Object] ⚠️ |

**建議：** 考慮統一 `Part.get_all()` 也返回字典，但需要檢查所有使用的地方。

## 優點

### 1. 模板代碼簡潔

**修改前：**
```html
{{ inventory.part.reorder_point }}
{{ inventory.warehouse.name }}
{{ inventory.part.safety_stock }}
```

**修改後：**
```html
{{ inventory.reorder_point }}
{{ inventory.warehouse_name }}
{{ inventory.safety_stock }}
```

### 2. 數據扁平化

所有相關數據都在一個字典中，不需要多層訪問。

### 3. 易於序列化

字典格式可以直接轉換為 JSON，方便 API 使用。

### 4. 統一的數據格式

與 `Warehouse.get_all()` 等方法保持一致的返回格式。

## 總結

### 修復內容

1. ✅ `CurrentInventory.get_all_inventory()` - 返回字典列表
2. ✅ `CurrentInventory.get_low_stock_items()` - 返回字典列表
3. ✅ `CurrentInventory.get_current_stock()` - 返回字典

### 解決的問題

1. ✅ 修復庫存管理首頁顯示錯誤
2. ✅ 模板可以直接訪問 `reorder_point`
3. ✅ 統一數據返回格式
4. ✅ 出庫功能正常運作

### 測試狀態

- ✅ 庫存管理首頁
- ✅ 低庫存警示
- ✅ 出庫功能
- ✅ 數據格式正確

現在庫存管理功能完全正常運作！
