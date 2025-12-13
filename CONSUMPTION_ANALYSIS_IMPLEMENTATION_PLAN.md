# 零件消耗分析功能整合計畫

## 📋 整合策略

### 階段一：後端 API 建置 (優先)

#### 1. 擴展 `InventoryTransaction` 模型
**檔案**: `models/inventory.py`

```python
@classmethod
def get_working_days_count(cls, start_date, end_date, warehouse_id=None):
    """計算期間內有交易記錄的工作日數"""
    
@classmethod
def get_working_days_list(cls, start_date, end_date, warehouse_id=None):
    """取得期間內所有工作日的清單"""
    
@classmethod
def get_consumption_by_location(cls, part_id, location_id, days=30):
    """取得特定儲位的消耗統計"""
```

#### 2. 擴展 `CurrentInventory` 模型
**檔案**: `models/inventory.py`

```python
def get_consumption_analysis(self, days=30):
    """
    取得該儲位的消耗分析 (基於工作日)
    返回:
    {
        'period_days': 30,
        'working_days': 18,
        'total_consumption': 180,
        'avg_daily_consumption': 10.0,
        'days_of_stock': 3.5,
        'stock_status': 'critical',
        'trend_indicator': 'up',
        'trend_percentage': 25
    }
    """
    
def get_order_suggestion(self):
    """
    計算訂購建議 (使用零件的實際採購前置期)
    返回:
    {
        'suggested_quantity': 165,
        'lead_time_days': self.part.lead_time,  # 使用零件的採購前置期
        'consumption_during_lead_time': 90,
        'stock_after_order': 200,
        'urgency_score': 85
    }
    """
```

#### 3. 修改 `PartService.get_full_part_details()`
**檔案**: `services/part_service.py`

```python
@staticmethod
def get_full_part_details(part_number):
    # ... 現有邏輯 ...
    
    # 新增：為每個庫存位置加入消耗分析
    inventory_data = []
    for inv in inventories:
        inv_dict = inv.to_dict()
        
        # 消耗分析
        inv_dict['consumption_analysis'] = inv.get_consumption_analysis(days=30)
        
        # 訂購建議 (自動使用零件的 lead_time)
        inv_dict['order_suggestion'] = inv.get_order_suggestion()
        
        inventory_data.append(inv_dict)
    
    # 新增：計算零件級別的總體摘要
    summary = PartService._calculate_part_summary(inventories)
    
    return {
        'success': True,
        'data': {
            'part_info': part_info,
            'order_history': order_history_data,
            'inventories': inventory_data,
            'summary': summary  # 新增總體摘要
        }
    }

@staticmethod
def _calculate_part_summary(inventories):
    """計算零件整體消耗摘要"""
    return {
        'total_stock': sum(inv.quantity_on_hand for inv in inventories),
        'total_available': sum(inv.available_quantity for inv in inventories),
        'overall_status': 'critical/warning/healthy',
        'total_working_days': 18,
        'avg_consumption_per_day': 22.5,
        'estimated_stockout_date': '2025-01-05'
    }
```

---

### 階段二：前端整合 (3種顯示模式)

#### 模式 1: 模態視窗簡化版 (partDetailModal)
**適用頁面**: 
- `inventory/index.html`
- `weekly_orders/review.html`
- `weekly_orders/batch_register.html`

**顯示內容**:
```html
<!-- 在現有零件詳情模態框中新增折疊區塊 -->
<div class="modal-body" id="partDetailContent">
    <!-- 現有基本資訊 -->
    
    <!-- 新增：消耗狀態摘要 (可折疊) -->
    <div class="accordion mt-3" id="consumptionAccordion">
        <div class="accordion-item">
            <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" 
                        data-bs-toggle="collapse" data-bs-target="#consumptionSummary">
                    📊 消耗狀態與訂購建議
                    <span class="badge bg-danger ms-2" id="urgencyBadge">緊急</span>
                </button>
            </h2>
            <div id="consumptionSummary" class="accordion-collapse collapse">
                <div class="accordion-body">
                    <!-- 簡化版指標卡片 -->
                    <div class="row">
                        <div class="col-md-3">
                            <div class="metric-card">
                                <div class="label">總庫存天數</div>
                                <div class="value">15.3 天</div>
                            </div>
                        </div>
                        <!-- 更多指標... -->
                    </div>
                    
                    <!-- 建議訂購量 -->
                    <div class="alert alert-warning mt-3">
                        💡 建議訂購: <strong>235 個</strong>
                    </div>
                    
                    <!-- 連結到詳細分析 -->
                    <a href="#" class="btn btn-sm btn-primary" 
                       onclick="openDetailedAnalysis('P-2024-001')">
                        查看完整分析 →
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>
```

**JavaScript 處理**:
```javascript
// 新增檔案: static/js/part_consumption_widget.js

function loadPartDetailModal(partNumber) {
    fetch(`/api/part/${partNumber}`)
        .then(response => response.json())
        .then(data => {
            // 渲染基本資訊 (現有邏輯)
            renderPartBasicInfo(data.part_info);
            
            // 渲染消耗摘要 (新增)
            renderConsumptionSummary(data.summary, data.inventories);
        });
}

function renderConsumptionSummary(summary, inventories) {
    const container = document.getElementById('consumptionSummary');
    
    // 判斷整體狀態
    const statusBadge = document.getElementById('urgencyBadge');
    if (summary.overall_status === 'critical') {
        statusBadge.className = 'badge bg-danger ms-2';
        statusBadge.textContent = '🔴 緊急';
    } else if (summary.overall_status === 'warning') {
        statusBadge.className = 'badge bg-warning ms-2';
        statusBadge.textContent = '🟡 注意';
    } else {
        statusBadge.className = 'badge bg-success ms-2';
        statusBadge.textContent = '🟢 健康';
    }
    
    // 渲染簡化指標
    container.innerHTML = generateSummaryHTML(summary, inventories);
}
```

---

#### 模式 2: part_lookup 完整版
**檔案**: `templates/part_lookup.html`

**修改策略**:
```javascript
// 修改 static/js/part_lookup.js 的 showResults() 函數

function showResults(data) {
    const results = document.getElementById('results');
    const part = data.part_info;
    const history = data.order_history;
    const inventories = data.inventories || [];
    const summary = data.summary || {};  // 新增
    
    let html = `
        <!-- 現有基本資訊卡片 -->
        
        <!-- 新增：整體消耗摘要卡片 -->
        <div class="card mb-3">
            <div class="card-header bg-primary text-white">
                <h5>📊 整體消耗狀態</h5>
            </div>
            <div class="card-body">
                ${renderOverallSummary(summary)}
            </div>
        </div>
        
        <!-- 現有庫存資訊 - 增強版 -->
        <div class="card mb-3">
            <div class="card-header">
                <h5>📦 各儲位詳細分析</h5>
            </div>
            <div class="card-body">
                ${inventories.map(inv => renderLocationDetailCard(inv)).join('')}
            </div>
        </div>
        
        <!-- 現有訂單歷史 -->
    `;
    
    results.innerHTML = html;
    results.style.display = 'block';
}

function renderLocationDetailCard(inventory) {
    const analysis = inventory.consumption_analysis;
    const suggestion = inventory.order_suggestion;
    
    return `
        <div class="location-detail-card mb-3">
            <div class="card">
                <div class="card-header d-flex justify-content-between">
                    <span>📍 ${inventory.location_code}</span>
                    <span class="badge ${getStatusBadgeClass(analysis.stock_status)}">
                        ${analysis.stock_status === 'critical' ? '🔴 緊急' : 
                          analysis.stock_status === 'warning' ? '🟡 注意' : '🟢 健康'}
                    </span>
                </div>
                <div class="card-body">
                    <!-- 基本庫存指標 -->
                    <div class="row mb-3">
                        <div class="col-md-3">
                            <small class="text-muted">現有庫存</small>
                            <h4>${inventory.quantity_on_hand} ${inventory.unit}</h4>
                        </div>
                        <div class="col-md-3">
                            <small class="text-muted">庫存天數</small>
                            <h4 class="${analysis.days_of_stock < 7 ? 'text-danger' : ''}">
                                ${analysis.days_of_stock} 天
                            </h4>
                        </div>
                        <div class="col-md-3">
                            <small class="text-muted">平均消耗</small>
                            <h4>${analysis.avg_daily_consumption} ${inventory.unit}/天</h4>
                        </div>
                        <div class="col-md-3">
                            <small class="text-muted">工作日</small>
                            <h4>${analysis.working_days} / ${analysis.period_days} 天</h4>
                        </div>
                    </div>
                    
                    <!-- 消耗趨勢 -->
                    <div class="alert alert-info mb-3">
                        📈 消耗趨勢: 
                        <span class="badge ${getTrendBadgeClass(analysis.trend_indicator)}">
                            ${analysis.trend_indicator === 'up' ? '↑ 增加' : 
                              analysis.trend_indicator === 'down' ? '↓ 減少' : '→ 穩定'}
                            ${analysis.trend_percentage}%
                        </span>
                    </div>
                    
                    <!-- 訂購建議 -->
                    ${suggestion.suggested_quantity > 0 ? `
                        <div class="order-suggestion-box">
                            <h6>📝 訂購建議</h6>
                            <div class="row">
                                <div class="col-6">
                                    <small>建議訂購量</small>
                                    <p class="mb-0"><strong>${suggestion.suggested_quantity} ${inventory.unit}</strong></p>
                                </div>
                                <div class="col-6">
                                    <small>急迫度</small>
                                    <div class="progress">
                                        <div class="progress-bar ${getUrgencyClass(suggestion.urgency_score)}" 
                                             style="width: ${suggestion.urgency_score}%">
                                            ${suggestion.urgency_score}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-primary mt-2" 
                                    onclick="quickOrder('${inventory.part_number}', ${suggestion.suggested_quantity}, ${inventory.warehouse_location_id})">
                                快速下單
                            </button>
                        </div>
                    ` : `
                        <div class="alert alert-success">
                            ✅ 庫存充足，暫無需訂購
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}
```

---

#### 模式 3: 獨立分析頁面 (選配)
**新增路由**: `/parts/<part_number>/analysis`

**用途**:
- 深度分析單一零件
- 顯示歷史趨勢圖表 (Chart.js)
- 支援列印/匯出報告
- 可供採購決策會議使用

---

### 階段三：配置與優化

#### 1. 系統參數設定
**新增**: `models/system_settings.py` 或在現有配置中加入

```python
class ConsumptionAnalysisSettings:
    # 預設分析期間
    DEFAULT_ANALYSIS_DAYS = 30
    
    # 平均每週工作天數 (用於預估，實際以交易記錄為準)
    AVG_WORKING_DAYS_PER_WEEK = 4.5
    
    # 庫存狀態閾值
    CRITICAL_DAYS_THRESHOLD = 7
    WARNING_DAYS_THRESHOLD = 14
    
    # 急迫度評分權重
    URGENCY_WEIGHT_DAYS = 0.4
    URGENCY_WEIGHT_REORDER = 0.3
    URGENCY_WEIGHT_TREND = 0.3
    
    # 注意：採購前置期使用各零件的 part.lead_time 欄位，不使用全域設定
```

#### 2. CSS 樣式檔案
**新增**: `static/css/consumption_analysis.css`
- 統一的消耗狀態卡片樣式
- 狀態燈號配色
- 響應式設計

#### 3. JavaScript 工具函數
**新增**: `static/js/consumption_utils.js`
```javascript
// 狀態判斷工具函數
function getStatusBadgeClass(status) { ... }
function getTrendBadgeClass(trend) { ... }
function getUrgencyClass(score) { ... }

// 格式化工具函數
function formatDaysOfStock(days) { ... }
function formatDate(dateString) { ... }
```

---

## 📅 實作時程建議

### Week 1: 後端基礎
- [ ] Day 1-2: `InventoryTransaction` 工作日計算方法
- [ ] Day 3-4: `CurrentInventory` 消耗分析方法
- [ ] Day 5: 修改 `PartService.get_full_part_details()`
- [ ] Day 6-7: API 測試與調整

### Week 2: 前端整合
- [ ] Day 1-2: 模態視窗簡化版 (Mode 1)
- [ ] Day 3-5: part_lookup 完整版 (Mode 2)
- [ ] Day 6-7: 整合測試、樣式優化

### Week 3: 優化與文檔
- [ ] Day 1-2: 性能優化 (快取、查詢優化)
- [ ] Day 3-4: 使用者測試與反饋
- [ ] Day 5: 文檔撰寫
- [ ] Day 6-7: 上線準備

---

## 🎯 立即可執行的第一步

建議從**模態視窗簡化版**開始:
1. 先實作後端 API (不影響現有功能)
2. 在現有 `partDetailModal` 加入折疊式消耗摘要
3. 測試通過後再逐步擴展到其他頁面

---

## 📊 預期效果

### 使用者體驗
- ✅ 不改變現有操作流程
- ✅ 漸進式提供更多資訊
- ✅ 快速決策支援

### 技術面
- ✅ 向下相容
- ✅ 模組化設計
- ✅ 易於維護擴展

---

## 🔄 後續擴展可能性

1. **AI 輔助預測**: 整合機器學習預測未來消耗趨勢
2. **自動訂購**: 達到閾值自動生成訂購單
3. **供應商整合**: 連結供應商系統自動詢價
4. **移動端優化**: PWA 支援離線查看

---

需要我開始實作哪個部分？
