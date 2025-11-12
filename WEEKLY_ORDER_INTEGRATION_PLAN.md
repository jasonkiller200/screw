# 訂單歷史整合規劃

## 📋 現況分析

### 現有兩個系統：

#### 1. **舊系統 - `/order-history`** (Order 模型)
- **位置**: `web_controller.py` → `order_history.html`
- **資料來源**: `Order` 模型（舊的訂單表）
- **狀態**: 
  - `migrated` - 已遷移到週期訂單系統
  - `confirmed` - 歷史已處理訂單
- **功能**: 僅顯示舊系統的歷史記錄
- **特色**: 顯示系統升級說明，引導使用者到新系統

#### 2. **新系統 - `/weekly-orders`** (WeeklyOrderCycle 模型)
- **位置**: `weekly_order_controller.py` → `weekly_orders/index.html`
- **資料來源**: `OrderRegistration`、`WeeklyOrderCycle` 模型
- **狀態**: 
  - 當前週期（申請中、審查中）
  - 歷史週期（已完成的週期）
- **功能**: 完整的週期訂單管理系統
- **特色**: 首頁顯示最近 10 個歷史週期

---

## 🎯 整合建議方案

### **方案 A：將歷史記錄作為週期訂單的子頁面** ⭐ 推薦

#### 優點：
- ✅ 符合業務邏輯（歷史記錄是訂單管理的一部分）
- ✅ 使用者不需要在兩個地方找訂單
- ✅ 可以統一顯示新舊系統的所有訂單歷史
- ✅ 保持導航欄簡潔

#### 實作方式：

**1. 新增路由**
```
/weekly-orders/history          # 所有歷史記錄（新+舊）
/weekly-orders/history/cycles   # 週期歷史（新系統）
/weekly-orders/history/legacy   # 舊系統歷史
```

**2. 頁面結構**
```
週期訂單管理 (/weekly-orders)
├─ 首頁（當前週期概覽）
├─ 申請登記
├─ 主管審查
├─ 待入庫管理
└─ 📋 歷史記錄 (/weekly-orders/history) ← 新增
   ├─ Tab 1: 週期歷史（新系統的已完成週期）
   └─ Tab 2: 舊系統紀錄（已遷移/已確認訂單）
```

**3. 導航欄修改**
```html
<!-- 之前 -->
<li><a href="/weekly-orders">訂單管理 <span class="badge">NEW</span></a></li>
<li><a href="/order-history">歷史記錄</a></li>

<!-- 之後 -->
<li class="nav-item dropdown">
    <a class="dropdown-toggle" href="#" id="ordersDropdown">
        <i class="fas fa-calendar-week"></i>訂單管理
    </a>
    <ul class="dropdown-menu">
        <li><a href="/weekly-orders">當前訂單</a></li>
        <li><a href="/weekly-orders/register">申請登記</a></li>
        <li><a href="/weekly-orders/review">主管審查</a></li>
        <li><a href="/weekly-orders/pending-inbound">待入庫</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a href="/weekly-orders/history">📋 歷史記錄</a></li>
    </ul>
</li>
```

---

### **方案 B：保持獨立，但加強連結**

#### 優點：
- ✅ 不需要大改動
- ✅ 新舊系統分離清楚

#### 缺點：
- ❌ 使用者需要知道去哪裡找不同時期的訂單
- ❌ 導航欄項目較多

#### 實作方式：

**1. 加強頁面間的導航連結**
```html
<!-- /order-history 頁面頂部 -->
<div class="alert alert-info">
    <i class="fas fa-info-circle"></i>
    <strong>提示：</strong>
    查看新系統的週期訂單歷史請前往
    <a href="/weekly-orders" class="alert-link">訂單管理 → 歷史記錄</a>
</div>

<!-- /weekly-orders 首頁底部 -->
<div class="card">
    <div class="card-header">舊系統歷史記錄</div>
    <div class="card-body">
        <a href="/order-history" class="btn btn-outline-secondary">
            <i class="fas fa-archive"></i> 查看舊系統訂單記錄
        </a>
    </div>
</div>
```

---

## 📊 整合後的頁面架構（方案 A）

### 新的 `/weekly-orders/history` 頁面

```html
<!-- 頁面頂部導航 -->
<nav aria-label="breadcrumb">
    <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="/">首頁</a></li>
        <li class="breadcrumb-item"><a href="/weekly-orders">訂單管理</a></li>
        <li class="breadcrumb-item active">歷史記錄</li>
    </ol>
</nav>

<h2><i class="fas fa-history"></i> 訂單歷史記錄</h2>

<!-- Tab 導航 -->
<ul class="nav nav-tabs" role="tablist">
    <li class="nav-item">
        <button class="nav-link active" data-bs-toggle="tab" 
                data-bs-target="#cycles-tab">
            <i class="fas fa-calendar-alt"></i> 週期記錄
            <span class="badge bg-primary">{{ cycle_count }}</span>
        </button>
    </li>
    <li class="nav-item">
        <button class="nav-link" data-bs-toggle="tab" 
                data-bs-target="#legacy-tab">
            <i class="fas fa-archive"></i> 舊系統記錄
            <span class="badge bg-secondary">{{ legacy_count }}</span>
        </button>
    </li>
</ul>

<!-- Tab 內容 -->
<div class="tab-content">
    <!-- Tab 1: 週期歷史 -->
    <div class="tab-pane fade show active" id="cycles-tab">
        <div class="card">
            <div class="card-header">
                <h5>已完成的週期訂單</h5>
            </div>
            <div class="card-body">
                <!-- 週期列表 -->
                {% for cycle in historical_cycles %}
                <div class="card mb-3">
                    <div class="card-header">
                        <strong>{{ cycle.cycle_name }}</strong>
                        <span class="badge bg-success">已完成</span>
                        <span class="text-muted">
                            {{ cycle.start_date.strftime('%Y-%m-%d') }} ~ 
                            {{ cycle.end_date.strftime('%Y-%m-%d') }}
                        </span>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3">
                                <small class="text-muted">申請項目</small>
                                <h5>{{ cycle.total_items }}</h5>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted">核准項目</small>
                                <h5 class="text-success">{{ cycle.approved_items }}</h5>
                            </div>
                            <div class="col-md-3">
                                <small class="text-muted">已入庫</small>
                                <h5 class="text-info">{{ cycle.received_items }}</h5>
                            </div>
                            <div class="col-md-3">
                                <a href="/weekly-orders/cycle/{{ cycle.id }}" 
                                   class="btn btn-outline-primary btn-sm">
                                    <i class="fas fa-eye"></i> 查看詳情
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                {% endfor %}
            </div>
        </div>
    </div>
    
    <!-- Tab 2: 舊系統歷史 -->
    <div class="tab-pane fade" id="legacy-tab">
        <div class="alert alert-info">
            <i class="fas fa-info-circle"></i>
            以下是從舊系統遷移過來的歷史訂單記錄
        </div>
        
        <!-- 統計卡片 -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card bg-info text-white">
                    <div class="card-body">
                        <h5>已遷移訂單</h5>
                        <h3>{{ migrated_count }}</h3>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h5>已確認訂單</h5>
                        <h3>{{ confirmed_count }}</h3>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 舊訂單列表 -->
        <div class="table-responsive">
            <table class="table">
                <thead>
                    <tr>
                        <th>訂單日期</th>
                        <th>品號</th>
                        <th>品名</th>
                        <th>數量</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
                    {% for order in legacy_orders %}
                    <tr>
                        <td>{{ order.order_date.strftime('%Y-%m-%d') }}</td>
                        <td>{{ order.part_number }}</td>
                        <td>{{ order.part_name }}</td>
                        <td>{{ order.quantity }} {{ order.unit }}</td>
                        <td>
                            {% if order.status == 'migrated' %}
                                <span class="badge bg-info">已遷移</span>
                            {% elif order.status == 'confirmed' %}
                                <span class="badge bg-success">已確認</span>
                            {% endif %}
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>
</div>
```

---

## 🔧 技術實作步驟（方案 A）

### Step 1: 新增路由
```python
# controllers/weekly_order_controller.py

@weekly_order_bp.route('/history')
@login_required
def order_history():
    """統一的訂單歷史頁面"""
    # 獲取週期歷史（新系統）
    historical_cycles = WeeklyOrderCycle.query\
        .filter(WeeklyOrderCycle.is_active == False)\
        .order_by(WeeklyOrderCycle.created_at.desc())\
        .limit(50).all()
    
    # 獲取舊系統歷史
    from models.order import Order
    legacy_orders = Order.query.filter(
        Order.status.in_(['migrated', 'confirmed'])
    ).order_by(Order.order_date.desc()).all()
    
    return render_template('weekly_orders/history.html',
                         historical_cycles=historical_cycles,
                         legacy_orders=legacy_orders,
                         cycle_count=len(historical_cycles),
                         legacy_count=len(legacy_orders),
                         migrated_count=len([o for o in legacy_orders if o.status == 'migrated']),
                         confirmed_count=len([o for o in legacy_orders if o.status == 'confirmed']))
```

### Step 2: 建立模板
- 建立 `templates/weekly_orders/history.html`
- 使用 Bootstrap Tabs 分離新舊系統資料

### Step 3: 更新導航欄
- 修改 `templates/base.html`
- 將「訂單管理」改成下拉選單
- 「歷史記錄」移入下拉選單

### Step 4: 重定向舊路由（可選）
```python
# controllers/web_controller.py

@web_bp.route('/order-history')
@login_required
def order_history():
    """重定向到新的歷史頁面"""
    flash('歷史記錄已整合到訂單管理模組', 'info')
    return redirect(url_for('weekly_order.order_history'))
```

---

## 📈 預期效果

### 使用者體驗改善：
1. ✅ **單一入口**：所有訂單相關功能都在「訂單管理」下
2. ✅ **清楚分類**：Tab 分離新舊系統，不會混淆
3. ✅ **完整歷史**：可以查看所有時期的訂單記錄
4. ✅ **導航簡化**：減少頂層導航項目

### 系統架構優化：
1. ✅ **邏輯統一**：訂單相關功能集中管理
2. ✅ **易於維護**：未來只需要維護週期訂單模組
3. ✅ **向下相容**：保留舊資料查詢功能
4. ✅ **平滑過渡**：舊系統資料仍可查看

---

## 🤔 我的建議

**推薦使用方案 A**，理由：

1. **業務邏輯更清晰**
   - 歷史記錄本質上就是「訂單管理」的一部分
   - 使用者心智模型：訂單管理 → 包含當前+歷史

2. **未來可擴展**
   - 可以繼續新增其他訂單相關功能（如：訂單統計、匯出報表等）
   - 不會讓導航欄越來越長

3. **現代化的 UI 設計**
   - 使用 Tab 切換，符合現代網頁設計習慣
   - 視覺上更整潔

4. **技術實作簡單**
   - 只需要新增一個頁面和路由
   - 不需要修改現有資料庫結構
   - 可以保留舊路由做重定向

---

## 📝 下一步

如果你同意方案 A，我可以：

1. ✅ 建立新的 `/weekly-orders/history` 路由
2. ✅ 建立新的模板（含 Tab 切換）
3. ✅ 更新導航欄為下拉選單
4. ✅ 設定舊路由重定向
5. ✅ 測試確保所有功能正常

請告訴我是否開始實作？或有其他想法？
