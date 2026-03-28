# Dashboard 圖表與時間範圍同步評估報告

## 📅 建立日期：2025-11-27

---

## 🎯 問題描述

### 現況問題：
1. ❌ 上方時間範圍選擇器（今日/本週/本月/本季）切換時，綜合趨勢圖會重新載入但數據不變
2. ❌ 圖表時間粒度按鈕（日/週/月）與 KPI 時間範圍互相獨立，造成使用者混淆
3. ❌ 沒有「季」的圖表粒度選項，無法完整對應上方的「本季」選擇

### 使用者體驗問題：
- 選擇「本週」時，期望圖表也顯示本週相關趨勢
- 兩個獨立的時間控制器增加認知負擔
- KPI 數據與圖表顯示的時間範圍不一致

---

## 📊 目前架構分析

### 1. 上方時間選擇器
```
控制範圍：今日 | 本週 | 本月 | 本季
影響對象：
  ✅ 4 張 KPI 卡片（出庫/入庫/低庫存/缺貨）
  ✅ 快速統計面板數字
  ✅ 趨勢對比標籤（vs 昨天/上週/上月/上季）
  ❌ 綜合趨勢圖（不受影響）
```

### 2. 圖表時間粒度按鈕
```
控制範圍：日 | 週 | 月
影響對象：
  ✅ 綜合趨勢圖的顯示粒度
  ❌ KPI 卡片（不受影響）
  ❌ 快速統計（不受影響）
```

### 3. 資料來源
```javascript
// API 請求
/api/dashboard?timespan=daily&time_range=week

參數說明：
- timespan: 圖表粒度 ('daily', 'weekly', 'monthly')
- time_range: KPI 範圍 ('today', 'week', 'month', 'quarter')
```

### 4. 後端實作
```python
# DashboardService
def get_dashboard_data(self, timespan='daily', time_range='week'):
    kpi_data = self._get_kpi_data(time_range=time_range)      # KPI 使用 time_range
    trend_data = self._get_trend_data(timespan)               # 圖表使用 timespan
    
    return {
        "kpi": kpi_data,
        "trend_chart": trend_data,
        ...
    }
```

---

## 💡 解決方案評估

### 方案 A：完全同步（推薦）⭐⭐⭐⭐⭐

#### 設計概念：
**移除圖表獨立控制器，自動根據上方時間範圍選擇對應的圖表粒度**

#### 映射關係：
| 時間範圍 | 圖表粒度 | 圖表顯示範圍 | 圖表標題 |
|---------|---------|-------------|----------|
| 今日 | daily | 近 7 日 | 綜合趨勢圖 - 近 7 日走勢 |
| 本週 | weekly | 近 5 週 | 綜合趨勢圖 - 近 5 週走勢 |
| 本月 | monthly | 近 6 月 | 綜合趨勢圖 - 近 6 月走勢 |
| 本季 | quarterly | 近 4 季 | 綜合趨勢圖 - 近 4 季走勢 |

#### UI 變更：
```diff
<!-- 圖表卡片 -->
<div class="card-header d-flex justify-content-between align-items-center">
    <h5 id="chart-title" class="mb-0">
        <i class="fas fa-chart-line me-2"></i>
-       綜合趨勢圖
+       <span id="dynamic-chart-title">綜合趨勢圖 - 近 5 週走勢</span>
    </h5>
-   <div class="btn-group" role="group">
-       <button class="btn btn-outline-secondary timespan-btn active" data-timespan="daily">日</button>
-       <button class="btn btn-outline-secondary timespan-btn" data-timespan="weekly">週</button>
-       <button class="btn btn-outline-secondary timespan-btn" data-timespan="monthly">月</button>
-   </div>
</div>
```

#### JavaScript 實作：
```javascript
// 時間範圍 → 圖表粒度映射
const timeRangeToTimespan = {
    'today': 'daily',
    'week': 'weekly',
    'month': 'monthly',
    'quarter': 'quarterly'
};

// 圖表標題映射
const chartTitleMap = {
    'today': '綜合趨勢圖 - 近 7 日走勢',
    'week': '綜合趨勢圖 - 近 5 週走勢',
    'month': '綜合趨勢圖 - 近 6 月走勢',
    'quarter': '綜合趨勢圖 - 近 4 季走勢'
};

// 更新邏輯
function updateDashboard(timeRange) {
    const timespan = timeRangeToTimespan[timeRange];
    const chartTitle = chartTitleMap[timeRange];
    
    // 更新圖表標題
    document.getElementById('dynamic-chart-title').textContent = chartTitle;
    
    // 獲取資料
    fetch(`/api/dashboard?timespan=${timespan}&time_range=${timeRange}`)
        .then(response => response.json())
        .then(data => {
            updateKPIs(data.kpi);
            updateTrendChart(data.trend_chart, timespan);
        });
}
```

#### 優點：
| 優點 | 說明 |
|------|------|
| ✅ 使用者體驗一致 | KPI 和圖表顯示相同時間範圍的數據 |
| ✅ 認知負擔低 | 只需關注一個時間選擇器 |
| ✅ 邏輯清晰 | 「查看本週」→ 所有數據都是本週的 |
| ✅ 減少混淆 | 不會出現「本週 KPI + 月度圖表」的奇怪組合 |
| ✅ 實作簡單 | 移除圖表按鈕，建立映射關係即可 |

#### 缺點：
| 缺點 | 說明 | 解決方案 |
|------|------|----------|
| ⚠️ 失去靈活性 | 無法在查看本週 KPI 時看月度趨勢 | 對大部分使用者來說不是問題 |
| ⚠️ 需要新增季度圖表 | 後端需支援 quarterly 粒度 | 實作類似 monthly，不困難 |

#### 實作工作量：
- 🔵 前端：2-3 小時
  - 移除圖表按鈕
  - 建立映射邏輯
  - 更新標題顯示
  
- 🔵 後端：1-2 小時
  - 新增 quarterly 粒度支援
  - 測試數據計算

- 🟢 測試：1 小時
  - 功能測試
  - 各時間範圍切換測試

**總計：4-6 小時**

---

### 方案 B：保持獨立但優化

#### 設計概念：
**保留兩組控制器，但優化互動邏輯和視覺提示**

#### 改進項目：

##### 1. 加入季度圖表按鈕
```html
<div class="btn-group" role="group">
    <button data-timespan="daily">日</button>
    <button data-timespan="weekly">週</button>
    <button data-timespan="monthly">月</button>
    <button data-timespan="quarterly">季</button> <!-- 新增 -->
</div>
```

##### 2. 優化圖表標題
```javascript
const chartTitles = {
    'daily': '綜合趨勢圖 - 近 7 日走勢',
    'weekly': '綜合趨勢圖 - 近 5 週走勢',
    'monthly': '綜合趨勢圖 - 近 6 月走勢',
    'quarterly': '綜合趨勢圖 - 近 4 季走勢'
};
```

##### 3. 避免不必要的圖表重載
```javascript
// 只在 timespan 改變時才重新渲染圖表
let lastTimespan = null;

function updateDashboard(timespan, timeRange) {
    // 獲取數據
    const data = await fetchData(timespan, timeRange);
    
    // 總是更新 KPI
    updateKPIs(data.kpi);
    
    // 只在圖表粒度改變時才重新渲染
    if (timespan !== lastTimespan) {
        updateTrendChart(data.trend_chart, timespan);
        lastTimespan = timespan;
    }
}
```

##### 4. 加入說明文字
```html
<div class="alert alert-info mb-3">
    <i class="fas fa-info-circle me-2"></i>
    <strong>提示：</strong>
    上方時間範圍控制 KPI 卡片數據，圖表右上角按鈕控制趨勢圖顯示粒度。
</div>
```

#### 優點：
| 優點 | 說明 |
|------|------|
| ✅ 保留靈活性 | 可以交叉查看不同時間範圍 |
| ✅ 進階功能 | 滿足需要深入分析的使用者 |
| ✅ 改動較小 | 不需要大幅修改現有邏輯 |

#### 缺點：
| 缺點 | 說明 |
|------|------|
| ⚠️ 使用者混淆 | 兩個控制器的作用不夠直觀 |
| ⚠️ 需要說明 | 需額外的提示文字說明 |
| ⚠️ 重複更新 | 切換 KPI 時間仍會觸發圖表重載 |

#### 實作工作量：
- 🔵 前端：1-2 小時
  - 加入季度按鈕
  - 優化重載邏輯
  - 更新標題
  
- 🔵 後端：1-2 小時
  - 新增 quarterly 支援
  
- 🟢 測試：1 小時

**總計：3-5 小時**

---

### 方案 C：智能同步（進階方案）

#### 設計概念：
**預設同步，但提供進階使用者解鎖獨立控制**

#### UI 設計：
```html
<!-- 主時間選擇器 -->
<div class="time-range-selector">
    今日 | 本週 | 本月 | 本季
</div>

<!-- 圖表卡片 -->
<div class="card">
    <div class="card-header">
        <h5>綜合趨勢圖 - 近 5 週走勢</h5>
        
        <!-- 進階模式開關 -->
        <div class="form-check form-switch">
            <input type="checkbox" id="advancedMode">
            <label>進階模式</label>
        </div>
        
        <!-- 圖表粒度（預設隱藏） -->
        <div id="chart-controls" class="d-none">
            <button>日</button>
            <button>週</button>
            <button>月</button>
            <button>季</button>
        </div>
    </div>
</div>
```

#### 邏輯：
```javascript
let advancedMode = false;

// 切換進階模式
document.getElementById('advancedMode').addEventListener('change', (e) => {
    advancedMode = e.target.checked;
    
    if (advancedMode) {
        // 顯示圖表控制按鈕
        document.getElementById('chart-controls').classList.remove('d-none');
    } else {
        // 隱藏並同步
        document.getElementById('chart-controls').classList.add('d-none');
        syncChartWithTimeRange();
    }
});
```

#### 優點：
✅ 兼顧簡單與進階需求
✅ 預設簡單模式符合大部分使用者
✅ 進階使用者可以解鎖完整功能

#### 缺點：
⚠️ 實作複雜度最高
⚠️ UI 元素較多

#### 實作工作量：
**總計：6-8 小時**

---

## 📈 後端支援評估

### 需要新增：quarterly (季度) 粒度

#### 實作位置：
`services/dashboard_service.py` → `_get_trend_data()`

#### 程式碼範例：
```python
def _get_trend_data(self, timespan):
    today = date.today()
    
    if timespan == 'daily':
        num_periods = 7
        start_date = today - timedelta(days=num_periods - 1)
        group_format = '%Y-%m-%d'
        freq = 'D'
        
    elif timespan == 'weekly':
        num_periods = 5
        start_date = today - timedelta(weeks=num_periods - 1)
        start_date -= timedelta(days=start_date.weekday())
        group_format = '%Y-%U'
        freq = 'W-MON'
        
    elif timespan == 'monthly':
        num_periods = 6
        start_date = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
        for _ in range(num_periods - 2):
            start_date = (start_date - timedelta(days=1)).replace(day=1)
        group_format = '%Y-%m'
        freq = 'MS'
        
    elif timespan == 'quarterly':  # 新增
        num_periods = 4
        current_quarter = (today.month - 1) // 3
        quarter_start_month = current_quarter * 3 + 1
        start_date = today.replace(month=quarter_start_month, day=1)
        
        # 往前推 3 個季度
        for _ in range(num_periods - 1):
            if start_date.month <= 3:
                start_date = start_date.replace(year=start_date.year - 1, month=10)
            else:
                start_date = start_date.replace(month=start_date.month - 3)
        
        group_format = '%Y-Q'  # 自定義格式
        freq = 'QS'  # Quarter Start
        
    else:
        return {}
    
    # ... 後續查詢邏輯
```

#### 季度標籤格式：
```python
# 將月份轉換為季度標籤
def get_quarter_label(date):
    quarter = (date.month - 1) // 3 + 1
    return f"{date.year}-Q{quarter}"

# 例如：
# 2025-01-15 → 2025-Q1
# 2025-04-20 → 2025-Q2
# 2025-07-10 → 2025-Q3
# 2025-10-05 → 2025-Q4
```

---

## 🎯 建議與決策

### 我的推薦：方案 A（完全同步）⭐

#### 推薦理由：

1. **使用者體驗最佳**
   - 80% 的使用者期望「查看本週」時，所有數據都是本週的
   - 降低認知負擔，直覺操作

2. **邏輯一致性**
   ```
   使用者選擇「本週」→ 期望看到：
   ✅ 本週出庫/入庫數字
   ✅ 本週趨勢圖
   ✅ VS 上週對比
   
   而不是：
   ❌ 本週出庫/入庫數字
   ❌ 月度趨勢圖（？）
   ❌ VS 上週對比（但圖表是月度的？）
   ```

3. **實作效益**
   - 工作量適中（4-6 小時）
   - 程式碼更簡潔
   - 維護成本低

4. **業界實踐**
   - Google Analytics：切換時間範圍，圖表自動調整
   - Tableau：主時間範圍控制所有視圖
   - Power BI：統一時間篩選器

### 不推薦原因（方案 B）：

雖然保留靈活性看起來很好，但實際使用中：
- 🤔 使用者需要理解兩個獨立的時間概念
- 🤔 容易產生「本週 KPI + 月度圖表」這種奇怪的組合
- 🤔 需要額外的說明文字，增加頁面複雜度

### 方案 C 適用場景：
- ✅ 專業數據分析平台
- ✅ 使用者需要深入交叉分析
- ✅ 有完整的使用者教育訓練
- ❌ 不適合一般管理儀表板

---

## 📋 實作檢查清單（方案 A）

### Phase 1: 前端修改
- [ ] 移除圖表時間粒度按鈕
- [ ] 建立 timeRangeToTimespan 映射
- [ ] 建立 chartTitleMap 映射
- [ ] 更新 updateDashboard 函數邏輯
- [ ] 更新圖表標題顯示邏輯
- [ ] 移除 timespanButtons 事件監聽器
- [ ] 測試四種時間範圍切換

### Phase 2: 後端修改
- [ ] 在 _get_trend_data 中新增 quarterly 處理
- [ ] 實作季度日期計算邏輯
- [ ] 實作季度標籤格式化
- [ ] 更新 API 文件說明
- [ ] 測試 quarterly 數據正確性

### Phase 3: 測試
- [ ] 功能測試：切換今日/本週/本月/本季
- [ ] 資料正確性：確認 KPI 和圖表數據對應
- [ ] 標題更新：確認所有標題正確切換
- [ ] 效能測試：確認載入速度正常
- [ ] 瀏覽器相容性測試

### Phase 4: 文件更新
- [ ] 更新使用者說明文件
- [ ] 更新開發者文件
- [ ] 建立變更記錄

---

## 🔄 回滾計畫

如果實作後發現問題，可以快速回滾：

```bash
# 回滾到當前版本
git revert <commit_hash>

# 或使用分支保護
git checkout feature/dashboard-sync
# 測試沒問題再 merge
```

---

## 📊 成功指標

實作完成後，檢查以下指標：

| 指標 | 目標 | 檢查方法 |
|------|------|----------|
| 使用者混淆度 | 降低 50% | 使用者回饋 |
| 頁面載入速度 | < 2 秒 | Chrome DevTools |
| 數據準確性 | 100% | 手動驗證 |
| 程式碼複雜度 | 降低 30% | 代碼行數對比 |

---

## 💬 討論問題

明天討論時可以考慮的問題：

1. **是否同意方案 A（完全同步）？**
   - [ ] 同意，立即開始實作
   - [ ] 希望保留獨立控制（方案 B）
   - [ ] 需要更多資訊才能決定

2. **季度圖表的細節**
   - 顯示近 4 季還是近 6 季？
   - 季度標籤格式：「2025-Q1」還是「2025 第一季」？

3. **過渡期處理**
   - 是否需要保留原有功能一段時間？
   - 是否需要使用者公告？

4. **其他考量**
   - 是否有特殊使用情境我沒考慮到？
   - 是否需要可配置的選項？

---

## 📝 附註

- 本文件建立於 2025-11-27
- 基於當前 `feature/homepage-dashboard` 分支
- 所有方案都已考慮後端 API 支援度
- 評估基於實際程式碼架構

---

## 📞 聯絡資訊

如有其他問題或想法，明天討論時一起解決！

---

**文件結束**
