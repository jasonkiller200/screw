/**
 * 零件消耗分析工具函數
 * 用於渲染消耗狀態、訂購建議等資訊
 */

/**
 * 取得庫存狀態的 Badge Class
 * @param {string} status - 狀態 (critical/warning/healthy)
 * @returns {string} Bootstrap badge class
 */
function getStatusBadgeClass(status) {
    const statusMap = {
        'critical': 'bg-danger',
        'warning': 'bg-warning',
        'healthy': 'bg-success',
        'unknown': 'bg-secondary'
    };
    return `badge ${statusMap[status] || 'bg-secondary'}`;
}

/**
 * 取得狀態文字和圖示
 * @param {string} status - 狀態
 * @returns {string} 狀態文字含圖示
 */
function getStatusText(status) {
    const statusMap = {
        'critical': '🔴 緊急',
        'warning': '🟡 注意',
        'healthy': '🟢 健康',
        'unknown': '⚪ 未知'
    };
    return statusMap[status] || '⚪ 未知';
}

/**
 * 取得趨勢指標的 Badge Class
 * @param {string} trend - 趨勢 (up/down/stable)
 * @returns {string} Bootstrap badge class
 */
function getTrendBadgeClass(trend) {
    const trendMap = {
        'up': 'bg-danger',
        'down': 'bg-success',
        'stable': 'bg-info'
    };
    return `badge ${trendMap[trend] || 'bg-secondary'}`;
}

/**
 * 取得趨勢文字和圖示
 * @param {string} trend - 趨勢
 * @param {number} percentage - 變化百分比
 * @returns {string} 趨勢文字含圖示
 */
function getTrendText(trend, percentage) {
    const trendMap = {
        'up': `↑ 增加 ${percentage}%`,
        'down': `↓ 減少 ${Math.abs(percentage)}%`,
        'stable': `→ 穩定 (${percentage}%)`
    };
    return trendMap[trend] || '→ 穩定';
}

/**
 * 取得急迫度評分的進度條 Class
 * @param {number} score - 評分 (0-100)
 * @returns {string} Bootstrap progress-bar class
 */
function getUrgencyClass(score) {
    if (score >= 70) return 'bg-danger';
    if (score >= 40) return 'bg-warning';
    return 'bg-success';
}

/**
 * 格式化庫存天數顯示
 * @param {number} days - 天數
 * @returns {string} 格式化後的文字
 */
function formatDaysOfStock(days) {
    if (days >= 999) return '充足';
    if (days >= 90) return `${Math.round(days)} 天 (充足)`;
    if (days >= 30) return `${Math.round(days)} 天`;
    if (days >= 14) return `${days.toFixed(1)} 天`;
    if (days >= 7) return `${days.toFixed(1)} 天 ⚠️`;
    return `${days.toFixed(1)} 天 🔴`;
}

/**
 * 格式化日期
 * @param {string} dateString - ISO 日期字串
 * @returns {string} 格式化後的日期
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * 渲染整體摘要卡片 (用於 part_lookup 頁面)
 * @param {Object} summary - 摘要資料
 * @returns {string} HTML 字串
 */
function renderOverallSummary(summary) {
    if (!summary) {
        return '<div class="alert alert-info">暫無消耗分析資料</div>';
    }
    
    return `
        <div class="row g-3">
            <div class="col-md-3">
                <div class="card border-primary">
                    <div class="card-body text-center">
                        <small class="text-muted">總庫存</small>
                        <h3 class="mb-0 text-primary">${summary.total_stock}</h3>
                        <small class="text-muted">可用: ${summary.total_available}</small>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-${summary.overall_status === 'critical' ? 'danger' : summary.overall_status === 'warning' ? 'warning' : 'success'}">
                    <div class="card-body text-center">
                        <small class="text-muted">整體狀態</small>
                        <h3 class="mb-0">
                            <span class="${getStatusBadgeClass(summary.overall_status)}">
                                ${getStatusText(summary.overall_status)}
                            </span>
                        </h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-warning">
                    <div class="card-body text-center">
                        <small class="text-muted">最少庫存天數</small>
                        <h3 class="mb-0 text-${summary.min_days_of_stock < 7 ? 'danger' : summary.min_days_of_stock < 14 ? 'warning' : 'success'}">
                            ${formatDaysOfStock(summary.min_days_of_stock)}
                        </h3>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card border-info">
                    <div class="card-body text-center">
                        <small class="text-muted">建議訂購總量</small>
                        <h3 class="mb-0 text-info">${summary.total_suggested_order || 0}</h3>
                        <small class="text-muted">${summary.location_count} 個儲位</small>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染儲位詳細分析卡片 (用於 part_lookup 頁面)
 * @param {Object} inventory - 庫存資料 (包含 consumption_analysis 和 order_suggestion)
 * @returns {string} HTML 字串
 */
function renderLocationDetailCard(inventory) {
    const analysis = inventory.consumption_analysis;
    const suggestion = inventory.order_suggestion;
    
    // 如果沒有分析資料，顯示基本資訊
    if (!analysis || !suggestion) {
        return renderBasicInventoryCard(inventory);
    }
    
    // 判斷狀態對應的樣式
    const statusClass = analysis.stock_status === 'critical' ? 'status-critical' : 
                        analysis.stock_status === 'warning' ? 'status-warning' : 'status-healthy';
    
    // 判斷訂購建議卡片樣式
    const suggestionClass = suggestion.urgency_score >= 70 ? 'urgent' : 
                            suggestion.urgency_score >= 40 ? '' : 'normal';
    
    return `
        <div class="card location-detail-card ${statusClass} mb-4">
            <div class="card-header d-flex justify-content-between align-items-center bg-light">
                <h6 class="mb-0">📍 ${inventory.location_code} - ${inventory.warehouse_name || ''}</h6>
                <span class="${getStatusBadgeClass(analysis.stock_status)}">
                    ${getStatusText(analysis.stock_status)}
                </span>
            </div>
            <div class="card-body">
                <!-- 警示訊息 -->
                ${analysis.stock_status === 'critical' && analysis.days_of_stock < 5 ? `
                    <div class="consumption-alert mb-3">
                        <strong>⚠️ 庫存緊急警示</strong>
                        <p style="margin-top: 8px; margin-bottom: 0; font-size: 14px;">
                            預計 ${analysis.days_of_stock.toFixed(1)} 個工作日後缺貨，建議立即訂購！
                        </p>
                    </div>
                ` : analysis.stock_status === 'warning' ? `
                    <div class="consumption-alert warning mb-3">
                        <strong>⚠️ 庫存偏低提醒</strong>
                        <p style="margin-top: 8px; margin-bottom: 0; font-size: 14px;">
                            庫存即將低於安全水位，請留意補貨時機。
                        </p>
                    </div>
                ` : ''}
                
                <!-- 基本庫存指標 -->
                <div class="row g-3 mb-3">
                    <div class="col-md-3 col-6">
                        <div class="consumption-metric-card ${analysis.stock_status === 'critical' ? 'danger' : analysis.stock_status === 'warning' ? 'warning' : 'primary'}">
                            <div class="metric-label">📦 現有庫存</div>
                            <div class="metric-value">${inventory.quantity_on_hand}<span class="metric-unit">${inventory.unit}</span></div>
                            <div class="metric-subtext">可用: ${inventory.available_quantity}</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="consumption-metric-card ${analysis.days_of_stock < 7 ? 'danger' : analysis.days_of_stock < 14 ? 'warning' : 'success'}">
                            <div class="metric-label">⏰ 庫存天數</div>
                            <div class="metric-value">${analysis.days_of_stock.toFixed(1)}<span class="metric-unit">天</span></div>
                            <div class="metric-subtext">工作日計算</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="consumption-metric-card primary">
                            <div class="metric-label">📊 平均消耗</div>
                            <div class="metric-value">${analysis.avg_daily_consumption}<span class="metric-unit">${inventory.unit}/天</span></div>
                            <div class="metric-subtext">基於工作日</div>
                        </div>
                    </div>
                    <div class="col-md-3 col-6">
                        <div class="consumption-metric-card">
                            <div class="metric-label">📅 工作日統計</div>
                            <div class="metric-value">${analysis.working_days}<span class="metric-unit">/ ${analysis.period_days}</span></div>
                            <div class="metric-subtext">近期工作日數</div>
                        </div>
                    </div>
                </div>
                
                <!-- 消耗分析區塊 -->
                <div class="consumption-analysis-section">
                    <div class="consumption-section-title">
                        <span class="icon">📈</span>
                        近30天消耗分析
                        <span class="trend-badge trend-${analysis.trend_indicator}">
                            ${getTrendText(analysis.trend_indicator, analysis.trend_percentage)}
                        </span>
                    </div>
                    <div class="consumption-stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${analysis.period_days}</div>
                            <div class="stat-label">日曆天數</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${analysis.working_days}</div>
                            <div class="stat-label">實際工作日</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${analysis.total_consumption}</div>
                            <div class="stat-label">總出庫量 (${inventory.unit})</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${analysis.avg_daily_consumption}</div>
                            <div class="stat-label">平均工作日消耗</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${analysis.recent_7_consumption}</div>
                            <div class="stat-label">7天出庫量 (${inventory.unit})</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${analysis.trend_indicator === 'up' ? '↑' : analysis.trend_indicator === 'down' ? '↓' : '→'} ${analysis.trend_percentage}%</div>
                            <div class="stat-label">消耗趨勢</div>
                        </div>
                    </div>
                </div>
                
                <!-- 訂購建議 -->
                ${suggestion.suggested_quantity > 0 ? `
                    <div class="order-suggestion-card ${suggestionClass}">
                        <h6>📝 訂購建議</h6>
                        <div class="order-details-grid">
                            <div class="order-detail-item">
                                <label>建議訂購量</label>
                                <div class="value">${suggestion.suggested_quantity} ${inventory.unit}</div>
                            </div>
                            <div class="order-detail-item">
                                <label>採購前置期</label>
                                <div class="value">${suggestion.lead_time_days} 天</div>
                            </div>
                            <div class="order-detail-item">
                                <label>交期內消耗</label>
                                <div class="value">${suggestion.consumption_during_lead_time} ${inventory.unit}</div>
                            </div>
                            <div class="order-detail-item">
                                <label>訂購後庫存</label>
                                <div class="value">${suggestion.stock_after_order} ${inventory.unit}</div>
                            </div>
                        </div>
                        
                        <!-- 急迫度評分 -->
                        <div class="urgency-progress">
                            <label>急迫度評分</label>
                            <div class="urgency-bar">
                                <div class="urgency-fill" style="width: ${suggestion.urgency_score}%">
                                    ${suggestion.urgency_score} / 100
                                </div>
                            </div>
                        </div>
                        
                        <button class="btn quick-order-btn mt-3" 
                                onclick="quickOrder('${inventory.part_number}', ${suggestion.suggested_quantity}, ${inventory.warehouse_location_id})">
                            <i class="fas fa-shopping-cart me-1"></i>快速下單
                        </button>
                    </div>
                ` : `
                    <div class="consumption-alert success">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>庫存充足，暫無需訂購</strong>
                        <small class="d-block mt-1">目前庫存: ${inventory.quantity_on_hand} ${inventory.unit}，安全庫存: ${inventory.safety_stock} ${inventory.unit}</small>
                    </div>
                `}
            </div>
        </div>
    `;
}

/**
 * 渲染基本庫存卡片 (當沒有消耗分析時的備用顯示)
 * @param {Object} inventory - 庫存資料
 * @returns {string} HTML 字串
 */
function renderBasicInventoryCard(inventory) {
    return `
        <div class="card mb-3">
            <div class="card-header">
                <h6 class="mb-0">📍 ${inventory.location_code} - ${inventory.warehouse_name || ''}</h6>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-4">
                        <small class="text-muted">現有庫存</small>
                        <h5>${inventory.quantity_on_hand} ${inventory.unit}</h5>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">可用庫存</small>
                        <h5>${inventory.available_quantity} ${inventory.unit}</h5>
                    </div>
                    <div class="col-md-4">
                        <small class="text-muted">安全庫存</small>
                        <h5>${inventory.safety_stock} ${inventory.unit}</h5>
                    </div>
                </div>
                <div class="alert alert-info mt-3 mb-0">
                    <small>消耗分析資料不足，需要更多歷史交易記錄</small>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染簡化版消耗摘要 (用於模態視窗)
 * @param {Object} summary - 摘要資料
 * @param {Array} inventories - 庫存陣列
 * @returns {string} HTML 字串
 */
function renderConsumptionSummaryWidget(summary, inventories) {
    if (!summary) {
        return '<div class="alert alert-info">暫無消耗分析資料</div>';
    }
    
    // 找出最緊急的儲位
    let mostUrgentInventory = null;
    let maxUrgency = 0;
    
    inventories.forEach(inv => {
        if (inv.order_suggestion && inv.order_suggestion.urgency_score > maxUrgency) {
            maxUrgency = inv.order_suggestion.urgency_score;
            mostUrgentInventory = inv;
        }
    });
    
    return `
        <div class="row g-2 mb-3">
            <div class="col-6 col-md-3">
                <div class="p-2 bg-light rounded text-center">
                    <small class="text-muted d-block">總庫存</small>
                    <strong>${summary.total_stock}</strong>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="p-2 bg-light rounded text-center">
                    <small class="text-muted d-block">整體狀態</small>
                    <span class="${getStatusBadgeClass(summary.overall_status)}">${getStatusText(summary.overall_status)}</span>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="p-2 bg-light rounded text-center">
                    <small class="text-muted d-block">最少天數</small>
                    <strong class="text-${summary.min_days_of_stock < 7 ? 'danger' : summary.min_days_of_stock < 14 ? 'warning' : 'success'}">
                        ${summary.min_days_of_stock.toFixed(1)} 天
                    </strong>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="p-2 bg-light rounded text-center">
                    <small class="text-muted d-block">建議訂購</small>
                    <strong class="text-primary">${summary.total_suggested_order}</strong>
                </div>
            </div>
        </div>
        
        ${mostUrgentInventory && mostUrgentInventory.order_suggestion.suggested_quantity > 0 ? `
            <div class="alert alert-warning mb-2">
                <strong>💡 訂購提醒</strong><br>
                儲位 <strong>${mostUrgentInventory.location_code}</strong> 建議訂購 
                <strong>${mostUrgentInventory.order_suggestion.suggested_quantity} ${mostUrgentInventory.unit}</strong>
                (急迫度: ${mostUrgentInventory.order_suggestion.urgency_score}/100)
            </div>
        ` : ''}
    `;
}

// 暴露給全域使用
window.ConsumptionUtils = {
    getStatusBadgeClass,
    getStatusText,
    getTrendBadgeClass,
    getTrendText,
    getUrgencyClass,
    formatDaysOfStock,
    formatDate,
    renderOverallSummary,
    renderLocationDetailCard,
    renderBasicInventoryCard,
    renderConsumptionSummaryWidget
};
