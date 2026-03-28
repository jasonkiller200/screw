# 零件倉位顯示修復說明

## 問題描述

### 問題 1：零件清單頁面看不到儲存位置
- **頁面**：`/parts` (零件管理)
- **症狀**：倉位欄位顯示「無儲存位置」，即使在倉位管理中有新增資料

### 問題 2：編輯零件時已新增的倉位沒有導入
- **頁面**：`/parts/<id>/edit` (編輯零件)
- **症狀**：編輯零件時，現有的倉位資料沒有顯示在表單中

## 原因分析

### 數據結構不匹配

**控制器返回的數據：**
```python
# Part.get_all() 返回 SQLAlchemy 對象列表
parts = Part.query.all()

# Part 對象的關聯結構：
part.location_associations  # PartWarehouseLocation 對象列表
    └─ assoc.warehouse_location  # WarehouseLocation 對象
        ├─ warehouse_location.warehouse  # Warehouse 對象
        │   └─ warehouse.name
        └─ warehouse_location.location_code
```

**模板期望的數據：**
```python
# 模板期望直接訪問 part.locations
part.locations  # ❌ 不存在
    └─ location.warehouse_name  # ❌ 不存在
    └─ location.location_code   # ❌ 不存在
```

## 修復內容

### 修復 1：零件清單頁面 (parts.html)

#### 修改前
```html
<td>
    {% for location in part.locations %}
        {{ location.warehouse_name }} - {{ location.location_code }}
        {% if not loop.last %}<br>{% endif %}
    {% else %}
        無儲存位置
    {% endfor %}
</td>
```

**問題：**
- `part.locations` 不存在，實際是 `part.location_associations`
- `location.warehouse_name` 不存在，需要透過關聯訪問

#### 修改後
```html
<td>
    {% if part.location_associations %}
        {% for assoc in part.location_associations %}
            {{ assoc.warehouse_location.warehouse.name }} - {{ assoc.warehouse_location.location_code }}
            {% if not loop.last %}<br>{% endif %}
        {% endfor %}
    {% else %}
        <span class="text-muted">無儲存位置</span>
    {% endif %}
</td>
```

**改善：**
- ✅ 正確訪問 `part.location_associations`
- ✅ 透過關聯鏈正確獲取倉庫名稱和位置代碼
- ✅ 無倉位時顯示灰色提示文字

### 修復 2：編輯零件表單 (part_form.html)

#### 修改前
```html
{% if part and part.locations %}
    {% for location in part.locations %}
        <select>
            {% for warehouse in warehouses %}
                <option {{ 'selected' if location.warehouse_id == warehouse['id'] }}>
                    {{ warehouse['name'] }}
                </option>
            {% endfor %}
        </select>
        <input value="{{ location.location_code }}">
    {% endfor %}
{% else %}
    <!-- 空白表單 -->
{% endif %}
```

**問題：**
- `part.locations` 不存在
- `location.warehouse_id` 和 `location.location_code` 訪問錯誤

#### 修改後
```html
{% if part and part.location_associations %}
    {% for assoc in part.location_associations %}
        <select>
            {% for warehouse in warehouses %}
                <option {{ 'selected' if assoc.warehouse_location.warehouse_id == warehouse['id'] }}>
                    {{ warehouse['name'] }}
                </option>
            {% endfor %}
        </select>
        <input value="{{ assoc.warehouse_location.location_code }}">
    {% endfor %}
{% else %}
    <!-- 空白表單 -->
{% endif %}
```

**改善：**
- ✅ 正確訪問 `part.location_associations`
- ✅ 透過 `assoc.warehouse_location.warehouse_id` 獲取倉庫ID
- ✅ 透過 `assoc.warehouse_location.location_code` 獲取位置代碼
- ✅ 編輯零件時正確預填倉位資料

## 數據關聯結構圖

```
Part (零件)
    │
    └─ location_associations (多對多關聯)
            │
            └─ PartWarehouseLocation (關聯表)
                    │
                    ├─ part_id (外鍵 → Part)
                    │
                    └─ warehouse_location_id (外鍵 → WarehouseLocation)
                            │
                            └─ WarehouseLocation (倉位)
                                    │
                                    ├─ warehouse_id (外鍵 → Warehouse)
                                    │       │
                                    │       └─ Warehouse (倉庫)
                                    │               ├─ id
                                    │               ├─ code
                                    │               └─ name
                                    │
                                    └─ location_code (位置代碼)
```

## 模板訪問路徑

### 零件清單頁面

```python
# 獲取倉庫名稱
part.location_associations[0].warehouse_location.warehouse.name
      ↓                        ↓                   ↓
關聯列表                    倉位對象             倉庫對象

# 獲取位置代碼
part.location_associations[0].warehouse_location.location_code
      ↓                        ↓                   ↓
關聯列表                    倉位對象           位置代碼
```

### 編輯零件表單

```python
# 獲取倉庫ID（用於下拉選單預選）
assoc.warehouse_location.warehouse_id
  ↓        ↓                ↓
關聯對象  倉位對象        倉庫ID

# 獲取位置代碼（用於輸入框預填）
assoc.warehouse_location.location_code
  ↓        ↓                ↓
關聯對象  倉位對象        位置代碼
```

## 測試驗證

### 測試結果
```
零件: 030200332800 - 保護膜_50*50cm (黑色)
倉位關聯數: 1
倉位列表:
  - 倉庫: 龍 (WH01)
    位置: TEST-LOC-001

✓ 關聯數據正確
✓ 可以訪問倉庫名稱
✓ 可以訪問位置代碼
```

## 顯示效果

### 零件清單頁面

**有倉位的零件：**
```
零件編號        名稱              儲存位置
ABC123         螺絲-M6           龍 - A-01
                                筆 - B-02
```

**無倉位的零件：**
```
零件編號        名稱              儲存位置
XYZ789         螺絲-M8           無儲存位置 (灰色)
```

### 編輯零件表單

**有倉位的零件：**
```
儲存位置 *
┌──────────────────────────────────────┐
│ [龍        ▼] [A-01        ] [X]    │
│ [筆        ▼] [B-02        ] [X]    │
└──────────────────────────────────────┘
[+ 新增儲存位置]
```

**無倉位的零件：**
```
儲存位置 *
┌──────────────────────────────────────┐
│ [選擇倉庫   ▼] [位置代碼...  ]      │
└──────────────────────────────────────┘
[+ 新增儲存位置]
```

## 相關檔案

| 檔案 | 修改內容 |
|------|---------|
| `templates/parts.html` | 修復倉位顯示邏輯 |
| `templates/part_form.html` | 修復倉位預填邏輯 |
| `models/part.py` | 數據模型（無需修改） |
| `controllers/web_controller.py` | 控制器（無需修改） |

## 總結

### 問題根源
模板使用了不存在的屬性路徑訪問關聯數據

### 解決方案
根據實際的 SQLAlchemy 關聯結構修正模板中的數據訪問路徑

### 修復效果
- ✅ 零件清單正確顯示所有倉位
- ✅ 編輯零件時正確預填現有倉位
- ✅ 支援一個零件有多個倉位
- ✅ 正確顯示倉庫名稱和位置代碼

### 注意事項
- 確保在倉位管理中先建立倉庫和倉位
- 零件必須關聯到已存在的倉位
- 關聯是通過 `PartWarehouseLocation` 中間表實現的

現在零件清單和編輯零件頁面都能正確顯示倉位資訊了！
