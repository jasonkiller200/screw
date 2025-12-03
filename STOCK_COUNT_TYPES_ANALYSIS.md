# 盤點類型分析與限制說明

## 目前系統狀態分析

### 📊 三種盤點類型

#### 1. 全盤點 (full)
- **說明**：盤點所選倉庫內的所有零件庫存，適用於年度或季度盤點
- **建立時範圍**：會自動建立該倉庫內所有零件-儲位組合的盤點明細
- **目前限制**：
  - ❌ **無強制要求填寫所有實盤數量**
  - ⚠️ 可以只填寫部分零件的實盤數量
  - ⚠️ 可以直接完成盤點（即使有空白項目）

#### 2. 循環盤點 (cycle)
- **說明**：按計劃定期盤點特定零件，適用於高價值或重要零件的定期檢查
- **建立時範圍**：目前與全盤點相同，會建立該倉庫內所有零件-儲位組合的盤點明細
- **目前限制**：
  - ❌ **無選擇特定零件的功能**
  - ⚠️ 與全盤點功能相同，沒有差異化處理

#### 3. 抽點 (spot)
- **說明**：隨機抽查部分零件庫存，適用於日常檢查或異常調查
- **建立時範圍**：目前與全盤點相同，會建立該倉庫內所有零件-儲位組合的盤點明細
- **目前限制**：
  - ❌ **無隨機抽選功能**
  - ⚠️ 與全盤點功能相同，沒有差異化處理

---

## 🔍 當前程式碼驗證

### 建立盤點 (create_count)
**檔案位置**：`models/inventory.py` 第 361-415 行

```python
def create_count(cls, warehouse_id, count_type='full', description='', counted_by=''):
    # ...建立盤點單
    
    # 獲取該倉庫的所有零件-儲位組合
    part_locations_query = db.session.query(
        PartWarehouseLocation.part_id,
        PartWarehouseLocation.warehouse_location_id
    ).join(WarehouseLocation).filter(WarehouseLocation.warehouse_id == warehouse_id)
    
    # 註解：For 'spot' counts, we might only want locations with stock.
    # For now, we'll include all assigned locations as per the plan's main goal.
    
    part_locations = part_locations_query.all()
    
    for part_id, location_id in part_locations:
        # 建立盤點明細，counted_quantity 初始為 None
        detail = StockCountDetail(
            stock_count_id=new_count.id,
            part_id=part_id,
            warehouse_location_id=location_id,
            system_quantity=system_quantity,
            counted_quantity=None  # 明確設為 null
        )
```

**結論**：
- ✅ `count_type` 參數有被接收和儲存
- ❌ **三種類型沒有差異化處理邏輯**
- ❌ 所有類型都建立相同的盤點明細清單

---

### 完成盤點 (complete_count)
**檔案位置**：`models/inventory.py` 第 562-592 行

```python
def complete_count(cls, count_id, verified_by='', apply_adjustments=False, user_id=None):
    count = cls.query.get(count_id)
    if not count:
        return False
    
    count.status = 'completed'
    count.verified_by = verified_by
    count.completed_at = get_taipei_time()
    
    if apply_adjustments:
        for detail in count.details:
            # 只調整有差異的項目
            if detail.variance_quantity != 0 and detail.warehouse_location_id is not None:
                CurrentInventory.update_stock(...)
    
    db.session.commit()
    return True
```

**結論**：
- ❌ **無檢查實盤數量是否全部填寫**
- ⚠️ 允許 `counted_quantity` 為 `None` 的項目存在
- ⚠️ 只調整有填寫且有差異的項目

---

### 更新盤點明細 (update_count_detail)
**檔案位置**：`models/inventory.py` 第 533-560 行

```python
def update_count_detail(cls, detail_id, counted_quantity, notes=''):
    detail = StockCountDetail.query.get(detail_id)
    if detail:
        try:
            detail.counted_quantity = counted_quantity
            detail.variance_quantity = counted_quantity - detail.system_quantity
            detail.notes = notes
            detail.counted_at = get_taipei_time()
            
            db.session.commit()
            return True, detail.to_dict()
        except Exception as e:
            db.session.rollback()
            return False, None
    return False, None
```

**結論**：
- ✅ 可以逐筆更新盤點數量
- ❌ 無驗證 `counted_quantity` 是否為必填

---

## 📋 目前系統行為總結

### ✅ 已實現功能
1. 可以建立三種類型的盤點單（full, cycle, spot）
2. 盤點類型會被儲存在資料庫
3. 可以批量或逐筆更新實盤數量
4. 可以匯入 Excel 更新實盤數量
5. 完成盤點時可選擇是否應用差異調整
6. 只有填寫實盤數量的項目才會計算差異

### ❌ 未實現功能/限制
1. **全盤點**沒有強制要求填寫所有項目
2. **循環盤點**沒有選擇特定零件的功能
3. **抽點**沒有隨機抽選功能
4. 三種類型的處理邏輯完全相同
5. 無完成盤點前的完整性檢查

---

## 💡 建議改進方向

### 方案 A：加入完整性驗證（適用於全盤點）
```python
def complete_count(cls, count_id, verified_by='', apply_adjustments=False, user_id=None):
    count = cls.query.get(count_id)
    if not count:
        return False
    
    # 針對全盤點，檢查是否所有項目都已填寫
    if count.count_type == 'full':
        uncounted = StockCountDetail.query.filter_by(
            stock_count_id=count_id
        ).filter(StockCountDetail.counted_quantity.is_(None)).count()
        
        if uncounted > 0:
            return False, f'全盤點必須填寫所有項目，還有 {uncounted} 項未盤點'
    
    # ... 繼續原有邏輯
```

### 方案 B：差異化三種盤點類型的建立邏輯
```python
def create_count(cls, warehouse_id, count_type='full', description='', counted_by='', selected_parts=None):
    # ...
    
    if count_type == 'full':
        # 全盤點：所有零件
        part_locations = part_locations_query.all()
    
    elif count_type == 'cycle':
        # 循環盤點：特定零件（由 selected_parts 參數指定）
        if selected_parts:
            part_locations = part_locations_query.filter(
                PartWarehouseLocation.part_id.in_(selected_parts)
            ).all()
        else:
            part_locations = part_locations_query.all()
    
    elif count_type == 'spot':
        # 抽點：隨機抽取一定比例（例如 20%）
        all_locations = part_locations_query.all()
        sample_size = max(1, len(all_locations) // 5)  # 20%
        part_locations = random.sample(all_locations, sample_size)
    
    # ... 繼續建立盤點明細
```

### 方案 C：前端介面改進
- 全盤點：完成時檢查並提示未填寫項目
- 循環盤點：建立時允許選擇要盤點的零件
- 抽點：建立時允許設定抽樣比例或數量

---

## 📝 使用建議（當前版本）

### 使用全盤點時
1. 建立全盤點後，會自動產生該倉庫所有零件-儲位的盤點清單
2. 匯出 Excel 範本進行盤點
3. 填寫實盤數量後匯入
4. **建議**：完成前手動檢查是否所有項目都已填寫
5. 完成盤點並選擇是否應用差異調整

### 使用循環盤點或抽點時
1. **目前與全盤點相同**，會產生所有零件的清單
2. 可以只填寫需要盤點的零件
3. 其他零件不填寫即可（系統允許部分空白）
4. 完成盤點時，未填寫的項目不會進行調整

---

## 結論

**目前系統狀態**：
- 三種盤點類型 **在程式邏輯上沒有實質差異**
- **沒有強制要求** 任何類型的盤點必須填寫所有項目
- 系統允許部分填寫、部分空白的情況
- 完成盤點時，只調整已填寫且有差異的項目

**是否需要改進**：
- 如果業務需求要求全盤點必須填寫所有項目 → 需要加入驗證
- 如果需要循環盤點和抽點有不同的處理邏輯 → 需要改進建立流程
- 如果目前的彈性符合需求 → 無需修改，但應在文檔中說明清楚
