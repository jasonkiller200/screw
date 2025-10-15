# 倉位管理功能說明

## 修復內容

### 1. 修復編輯零件頁面倉庫下拉選單問題

**問題：** 編輯零件時，倉庫下拉選單沒有顯示

**原因：** 
- `Part.get_all_warehouses()` 返回 SQLAlchemy 模型對象
- 但模板使用字典語法訪問 (如 `warehouse['id']`)

**解決方案：**
- 更改控制器使用 `Warehouse.get_all()` 方法（返回字典列表）
- 更新模板使用字典訪問語法 `warehouse['id']` 和 `warehouse['name']`

**修改檔案：**
- `controllers/web_controller.py` - 第 48, 117 行
- `templates/part_form.html` - 第 90, 102, 162 行

### 2. 新增倉位管理功能頁面

**新功能：**
- 完整的倉庫和倉位管理介面
- 支援新增、編輯、刪除操作
- 防止刪除被使用中的倉位

**新增路由：**

| 路由 | 方法 | 功能 |
|------|------|------|
| `/warehouse-locations` | GET | 倉位管理主頁面 |
| `/warehouse-locations/add` | POST | 新增倉位 |
| `/warehouse-locations/<id>/edit` | POST | 編輯倉位 |
| `/warehouse-locations/<id>/delete` | POST | 刪除倉位 |
| `/warehouses/add` | POST | 新增倉庫 |

**新增檔案：**
- `templates/warehouse_locations.html` - 倉位管理頁面

**更新檔案：**
- `templates/base.html` - 導航選單新增「倉位管理」連結
- `controllers/web_controller.py` - 新增倉位管理路由

## 使用方式

### 訪問倉位管理

1. 啟動應用程式：`python app.py`
2. 在瀏覽器開啟：`https://localhost:5005`
3. 點擊導航選單的「倉位管理」

### 管理倉庫

1. 點擊「新增倉庫」按鈕
2. 填寫倉庫資訊：
   - **倉庫編號**：唯一識別碼（例如：WH01）
   - **倉庫名稱**：倉庫名稱（例如：主倉庫）
   - **描述**：選填，倉庫說明

### 管理倉位

1. 點擊「新增倉位」按鈕
2. 填寫倉位資訊：
   - **倉庫**：從下拉選單選擇
   - **位置代碼**：倉位編號（例如：A區-1層-3排）
   - **描述**：選填，倉位說明

### 編輯零件時選擇倉位

1. 進入零件管理 → 編輯零件
2. 在「儲存位置」區塊：
   - 從下拉選單選擇倉庫
   - 輸入位置代碼
   - 可新增多個倉位
3. 儲存零件

## 範例資料

系統已自動建立範例倉庫和倉位：

**倉庫：**
- WH01 - 主倉庫
- WH02 - 副倉庫
- WH03 - 工具倉

**倉位：**
- 主倉庫：A區-1層-1排、A區-1層-2排、A區-2層-1排、B區-1層-1排
- 副倉庫：A區-1層-1排、B區-1層-1排
- 工具倉：T1區-1排

## 功能特點

✅ **防止重複**：檢查倉庫編號和倉位代碼是否重複
✅ **安全刪除**：刪除前檢查倉位是否被零件使用
✅ **即時更新**：操作後立即反映在頁面上
✅ **友善介面**：使用 Bootstrap Modal 對話框
✅ **完整驗證**：表單必填欄位驗證

## 注意事項

1. **倉庫編號唯一**：每個倉庫的編號必須唯一
2. **倉位唯一性**：同一倉庫內的位置代碼必須唯一
3. **無法刪除使用中的倉位**：如果有零件使用該倉位，將無法刪除
4. **建議命名規則**：使用統一的位置編碼格式，例如：「區域-層-排」

## 資料庫結構

**warehouses 表：**
- id：主鍵
- code：倉庫編號（唯一）
- name：倉庫名稱
- description：描述
- is_active：是否啟用
- created_at：建立時間

**warehouse_locations 表：**
- id：主鍵
- warehouse_id：倉庫ID（外鍵）
- location_code：位置代碼
- description：描述
- 唯一約束：(warehouse_id, location_code)

**part_locations 表（關聯表）：**
- part_id：零件ID
- warehouse_location_id：倉位ID
