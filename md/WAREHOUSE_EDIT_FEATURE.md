# 倉庫編輯和刪除功能說明

## 新增功能

已為倉庫管理新增完整的 **編輯** 和 **刪除** 功能。

## 功能概覽

### ✅ 倉庫編輯
- 修改倉庫名稱
- 修改倉庫描述
- 倉庫編號不可修改（保持唯一性）

### ✅ 倉庫刪除
- 刪除未使用的倉庫
- 安全檢查：有倉位的倉庫無法刪除
- 顯示倉位數量提示

## 使用方式

### 編輯倉庫

1. **進入倉位管理頁面**
   - 點擊導航選單「倉位管理」

2. **找到要編輯的倉庫**
   - 在頁面頂部的「現有倉庫」區域
   - 找到目標倉庫卡片

3. **點擊編輯按鈕**
   - 點擊倉庫卡片右上角的「編輯」圖示 📝

4. **修改資訊**
   - **倉庫編號**：顯示但無法修改（灰色）
   - **倉庫名稱**：可修改（必填）
   - **描述**：可修改（選填）

5. **儲存變更**
   - 點擊「更新倉庫」按鈕

### 刪除倉庫

1. **找到要刪除的倉庫**
   - 在「現有倉庫」區域找到目標倉庫

2. **點擊刪除按鈕**
   - 點擊倉庫卡片右上角的「刪除」圖示 🗑️

3. **確認刪除**
   - 系統會顯示確認對話框
   - 顯示倉庫編號和名稱
   - 警告：如果有倉位將無法刪除

4. **執行刪除**
   - 點擊「確認刪除」按鈕

## 安全機制

### 編輯限制
- ✅ 倉庫編號無法修改（維持唯一性和資料完整性）
- ✅ 倉庫名稱必填
- ✅ 描述選填

### 刪除保護
```
檢查邏輯：
1. 查詢倉庫下的倉位數量
2. 如果 倉位數 > 0:
   → ❌ 禁止刪除
   → 顯示錯誤訊息：「此倉庫有 X 個倉位，請先刪除所有倉位」
3. 如果 倉位數 = 0:
   → ✅ 允許刪除
```

**範例錯誤訊息：**
```
❌ 無法刪除：此倉庫有 7 個倉位，請先刪除所有倉位
```

## 介面設計

### 倉庫卡片佈局

```
┌─────────────────────────────────────┐
│ 主倉庫                     [📝] [🗑️] │
│ WH01                                │
│ 主要存放倉庫                         │
└─────────────────────────────────────┘
```

### 編輯對話框

```
┌──────────────────────────────────┐
│ 編輯倉庫                    ✕    │
├──────────────────────────────────┤
│                                  │
│ 倉庫編號                         │
│ [WH01        ] (無法修改)        │
│                                  │
│ 倉庫名稱 *                       │
│ [主倉庫                        ] │
│                                  │
│ 描述                             │
│ [主要存放倉庫                   ] │
│                                  │
├──────────────────────────────────┤
│         [取消]  [更新倉庫]       │
└──────────────────────────────────┘
```

### 刪除確認對話框

```
┌──────────────────────────────────┐
│ 確認刪除倉庫               ✕    │
├──────────────────────────────────┤
│                                  │
│ 確定要刪除以下倉庫嗎？            │
│                                  │
│ ⚠️  倉庫編號：WH01               │
│     倉庫名稱：主倉庫              │
│                                  │
│ ⚠️ 注意：如果倉庫下有倉位，       │
│    將無法刪除。請先刪除所有倉位。  │
│                                  │
├──────────────────────────────────┤
│         [取消]  [確認刪除]       │
└──────────────────────────────────┘
```

## 技術實現

### 路由

| 路由 | 方法 | 功能 | 檔案 |
|------|------|------|------|
| `/warehouses/<id>/edit` | POST | 編輯倉庫 | `web_controller.py` |
| `/warehouses/<id>/delete` | POST | 刪除倉庫 | `web_controller.py` |

### 控制器邏輯

#### 編輯倉庫
```python
@web_bp.route('/warehouses/<int:warehouse_id>/edit', methods=['POST'])
def edit_warehouse(warehouse_id):
    name = request.form.get('name')
    description = request.form.get('description', '')
    
    warehouse = Warehouse.query.get(warehouse_id)
    warehouse.name = name
    warehouse.description = description
    db.session.commit()
    
    return redirect(url_for('web.warehouse_locations'))
```

#### 刪除倉庫
```python
@web_bp.route('/warehouses/<int:warehouse_id>/delete', methods=['POST'])
def delete_warehouse(warehouse_id):
    warehouse = Warehouse.query.get(warehouse_id)
    
    # 檢查倉位數量
    locations_count = WarehouseLocation.query.filter_by(
        warehouse_id=warehouse_id
    ).count()
    
    if locations_count > 0:
        flash(f'無法刪除：此倉庫有 {locations_count} 個倉位')
        return redirect(...)
    
    db.session.delete(warehouse)
    db.session.commit()
    
    return redirect(url_for('web.warehouse_locations'))
```

### JavaScript 函數

```javascript
// 編輯倉庫
function editWarehouse(id, name, code, description) {
    // 設定表單 action URL
    document.getElementById('editWarehouseForm').action = 
        '/warehouses/' + id + '/edit';
    
    // 填充表單資料
    document.getElementById('edit_warehouse_code').value = code;
    document.getElementById('edit_warehouse_name').value = name;
    document.getElementById('edit_warehouse_description').value = description;
    
    // 顯示對話框
    new bootstrap.Modal(document.getElementById('editWarehouseModal')).show();
}

// 刪除倉庫
function deleteWarehouse(id, name, code) {
    // 設定表單 action URL
    document.getElementById('deleteWarehouseForm').action = 
        '/warehouses/' + id + '/delete';
    
    // 顯示倉庫資訊
    document.getElementById('delete_wh_code').textContent = code;
    document.getElementById('delete_wh_name').textContent = name;
    
    // 顯示對話框
    new bootstrap.Modal(document.getElementById('deleteWarehouseModal')).show();
}
```

## 操作流程圖

### 編輯倉庫流程
```
開始
  ↓
點擊編輯按鈕
  ↓
顯示編輯對話框
  ↓
填寫倉庫資訊
  ↓
點擊更新按鈕
  ↓
提交表單 → POST /warehouses/<id>/edit
  ↓
驗證名稱是否為空？
  ├─ 是 → 顯示錯誤 → 返回編輯頁面
  └─ 否 → 更新資料庫
           ↓
        顯示成功訊息
           ↓
        重新整理頁面
           ↓
         結束
```

### 刪除倉庫流程
```
開始
  ↓
點擊刪除按鈕
  ↓
顯示確認對話框
  ↓
點擊確認刪除
  ↓
提交表單 → POST /warehouses/<id>/delete
  ↓
檢查倉庫是否存在？
  ├─ 否 → 顯示錯誤 → 返回頁面
  └─ 是 → 查詢倉位數量
           ↓
        倉位數量 > 0？
          ├─ 是 → 顯示錯誤「有 X 個倉位」→ 返回頁面
          └─ 否 → 刪除倉庫
                   ↓
                顯示成功訊息
                   ↓
                重新整理頁面
                   ↓
                 結束
```

## 訊息提示

### 成功訊息
- ✅ `倉庫更新成功`
- ✅ `倉庫刪除成功`

### 錯誤訊息
- ❌ `倉庫名稱為必填項目`
- ❌ `找不到該倉庫`
- ❌ `無法刪除：此倉庫有 7 個倉位，請先刪除所有倉位`
- ❌ `倉庫更新失敗: [錯誤詳情]`
- ❌ `倉庫刪除失敗: [錯誤詳情]`

## 完整功能列表

### 倉庫管理功能矩陣

| 功能 | 狀態 | 說明 |
|------|------|------|
| 新增倉庫 | ✅ | 建立新倉庫 |
| 查看倉庫 | ✅ | 顯示所有倉庫 |
| 編輯倉庫 | ✅ | 修改名稱和描述 |
| 刪除倉庫 | ✅ | 刪除未使用的倉庫 |
| 倉庫編號唯一性 | ✅ | 新增時檢查 |
| 倉庫編號不可變 | ✅ | 編輯時限制 |
| 刪除前檢查倉位 | ✅ | 防止誤刪 |
| 啟用/停用倉庫 | 🔜 | 未來功能 |

## 建議操作順序

1. **規劃階段**
   - 先確定需要的倉庫
   - 設計倉庫編號規則

2. **建立階段**
   - 新增所有倉庫
   - 填寫完整描述

3. **使用階段**
   - 在倉庫下建立倉位
   - 分配零件到倉位

4. **維護階段**
   - 定期檢查倉庫使用情況
   - 編輯倉庫資訊
   - 清理未使用的倉庫

## 注意事項

### ⚠️ 重要提醒

1. **倉庫編號無法修改**
   - 一旦建立，編號永久固定
   - 編輯時會顯示但無法更改
   - 如需更改編號，只能刪除後重建

2. **刪除順序**
   - 必須先刪除倉位
   - 再刪除倉庫
   - 系統會自動檢查並阻止

3. **資料完整性**
   - 系統會保護有倉位的倉庫
   - 防止誤刪導致資料丟失

## 總結

✅ **完整的倉庫管理功能**
- 新增、查看、編輯、刪除
- 安全檢查機制
- 友善的使用者介面
- 清晰的錯誤提示

✅ **使用便利**
- 在同一頁面完成所有操作
- 快速的編輯和刪除按鈕
- Modal 對話框避免頁面跳轉

✅ **資料安全**
- 倉庫編號唯一性
- 刪除前檢查倉位
- 詳細的錯誤訊息
