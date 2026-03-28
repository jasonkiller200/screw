# 📱 手機端 API 使用指南

## 🔧 API 基礎設置

### 基礎地址
```
Base URL: http://你的電腦IP:5000/api
```

### CORS 支援
系統已配置 CORS，支援跨域請求，可直接從手機 APP 調用。

## 📦 零件管理 API

### 1. 獲取所有零件
```http
GET /api/parts
```

### 2. 搜尋零件
```http
GET /api/parts/search?q=零件編號或名稱
```

### 3. 根據編號獲取零件
```http
GET /api/parts/{part_number}
```

### 4. 新增零件
```http
POST /api/parts
Content-Type: application/json

{
  "part_number": "P001",
  "name": "螺絲 M6x20",
  "description": "六角頭螺絲",
  "unit": "個",
  "quantity_per_box": 100,
  "storage_location": "A-01-01"
}
```

## 📊 庫存管理 API

### 1. 獲取庫存清單
```http
GET /api/inventory/stock
GET /api/inventory/stock?warehouse_id=1
```

### 2. 獲取特定零件庫存
```http
GET /api/inventory/stock/{part_number}
GET /api/inventory/stock/{part_number}?warehouse_id=1
```

### 3. 獲取低庫存項目
```http
GET /api/inventory/low-stock
GET /api/inventory/low-stock?warehouse_id=1
```

## 📥 入庫 API

### 1. 入庫作業
```http
POST /api/inventory/stock-in
Content-Type: application/json

{
  "part_id": 1,
  "warehouse_id": 1,
  "quantity": 100,
  "transaction_type": "ORDER",
  "reference_id": "PO-2023-001",
  "notes": "訂單入庫"
}
```

## 📤 出庫 API

### 1. 出庫作業
```http
POST /api/inventory/stock-out
Content-Type: application/json

{
  "part_id": 1,
  "warehouse_id": 1,
  "quantity": 50,
  "transaction_type": "ISSUE",
  "reference_id": "WO-2023-001",
  "notes": "生產領料"
}
```

## 📋 異動記錄 API

### 1. 獲取異動記錄
```http
GET /api/inventory/transactions
GET /api/inventory/transactions?part_id=1
GET /api/inventory/transactions?warehouse_id=1
```

## 🏢 倉庫管理 API

### 1. 獲取所有倉庫
```http
GET /api/inventory/warehouses
```

## 📊 盤點 API

### 1. 獲取盤點記錄
```http
GET /api/inventory/stock-counts
```

### 2. 建立新盤點
```http
POST /api/inventory/stock-counts
Content-Type: application/json

{
  "warehouse_id": 1,
  "count_type": "full",
  "notes": "月度盤點"
}
```

### 3. 匯入盤點資料
```http
POST /api/inventory/import-count-data
Content-Type: multipart/form-data

file: CSV檔案
warehouse_id: 1
```

## 🔍 回應格式

### 成功回應
```json
{
  "success": true,
  "data": {...},
  "message": "操作成功"
}
```

### 錯誤回應
```json
{
  "error": "錯誤訊息",
  "success": false
}
```

## 📱 手機 APP 開發建議

### 1. 使用技術
- **React Native**: 跨平台解決方案
- **Flutter**: Google 跨平台框架
- **原生開發**: iOS (Swift) / Android (Kotlin)

### 2. 推薦功能
- 📷 **條碼掃描**: 快速查詢零件
- 📍 **定位功能**: 記錄入出庫位置
- 📱 **離線模式**: 暫存操作，聯網後同步
- 🔔 **推送通知**: 低庫存警告

### 3. 範例程式碼 (JavaScript)

```javascript
// 庫存查詢範例
const searchPart = async (partNumber) => {
  try {
    const response = await fetch(`http://你的IP:5000/api/parts/${partNumber}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('查詢失敗:', error);
  }
};

// 入庫操作範例
const stockIn = async (partId, warehouseId, quantity, notes) => {
  try {
    const response = await fetch('http://你的IP:5000/api/inventory/stock-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        part_id: partId,
        warehouse_id: warehouseId,
        quantity: quantity,
        transaction_type: 'ORDER',
        notes: notes
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('入庫失敗:', error);
  }
};
```