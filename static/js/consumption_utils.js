/**
 * 零件消耗分析工具函數
 * 用於渲染消耗狀態、訂購建議等資訊
 */

/**
 * 取得庫存狀態的 Badge Class
 * @param {string} status - 狀態 (critical/warning/healthy)
 * @returns {string} Bootstrap badge class
 */
function getInventoryStatusBadgeClass(status) {
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
function getInventoryStatusText(status) {
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
                            <span class="${getInventoryStatusBadgeClass(summary.overall_status)}">
                                ${getInventoryStatusText(summary.overall_status)}
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
 * @param {Array} allLocations - 該零件的所有儲位清單
 * @returns {string} HTML 字串
 */
function renderLocationDetailCard(inventory, allLocations = []) {
    const analysis = inventory.consumption_analysis;
    const suggestion = inventory.order_suggestion;

    // 如果沒有分析資料，顯示基本資訊
    if (!analysis || !suggestion) {
        return renderBasicInventoryCard(inventory, allLocations);
    }

    // 判斷狀態對應的樣式
    const statusClass = analysis.stock_status === 'critical' ? 'status-critical' :
        analysis.stock_status === 'warning' ? 'status-warning' : 'status-healthy';

    // 判斷訂購建議卡片樣式
    const suggestionClass = suggestion.urgency_score >= 70 ? 'urgent' :
        suggestion.urgency_score >= 40 ? '' : 'normal';

    // 渲染儲位歷史表格
    const historyHtml = renderLocationHistoryTable(inventory.recent_orders || []);

    return `
        <div id="location-detail-${inventory.warehouse_location_id}" class="card location-detail-card ${statusClass} mb-4">
            <div class="card-header d-flex justify-content-between align-items-center bg-light">
                <h6 class="mb-0">📍 ${inventory.location_code} - ${inventory.warehouse_name || ''}</h6>
                <div class="d-flex align-items-center">
                    <span class="${getInventoryStatusBadgeClass(analysis.stock_status)} me-2">
                        ${getInventoryStatusText(analysis.stock_status)}
                    </span>
                    <button class="btn btn-sm btn-success shadow-sm js-add-to-weekly-order-detail"
                            data-part-number="${inventory.part_number}"
                            data-part-name="${inventory.part_name || ''}"
                            data-unit="${inventory.unit}"
                            data-part-type=""
                            data-locations='${JSON.stringify(allLocations)}'
                            data-location-id="${inventory.warehouse_location_id}"
                            data-suggested-quantity="${suggestion.suggested_quantity || 0}">
                        <i class="fas fa-plus-circle"></i> 加入週期申請
                    </button>
                </div>
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
                
                <div class="row">
                    <!-- 左側：分析指標 -->
                    <div class="col-lg-8">
                        <div class="row g-2 mb-3">
                            <div class="col-md-4">
                                <div class="consumption-metric-card ${analysis.stock_status === 'critical' ? 'danger' : analysis.stock_status === 'warning' ? 'warning' : 'primary'}">
                                    <div class="metric-label">📦 現有庫存</div>
                                    <div class="metric-value">${inventory.quantity_on_hand}<span class="metric-unit">${inventory.unit}</span></div>
                                    <div class="metric-subtext">可用: ${inventory.available_quantity}</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="consumption-metric-card ${analysis.days_of_stock < 7 ? 'danger' : analysis.days_of_stock < 14 ? 'warning' : 'success'}">
                                    <div class="metric-label">⏰ 庫存天數</div>
                                    <div class="metric-value">${analysis.days_of_stock.toFixed(1)}<span class="metric-unit">天</span></div>
                                    <div class="metric-subtext">工作日計算</div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="consumption-metric-card primary">
                                    <div class="metric-label">📊 平均消耗</div>
                                    <div class="metric-value">${analysis.avg_daily_consumption}<span class="metric-unit">${inventory.unit}/天</span></div>
                                    <div class="metric-subtext">基於工作日</div>
                                </div>
                            </div>
                        </div>

                        <!-- 消耗分析詳情 -->
                        <div class="consumption-analysis-section">
                            <div class="consumption-section-title">
                                <span class="icon">📈</span>
                                近 30 天消耗分析
                                <span class="trend-badge trend-${analysis.trend_indicator}">
                                    ${getTrendText(analysis.trend_indicator, analysis.trend_percentage)}
                                </span>
                            </div>
                            <div class="consumption-stats-grid">
                                <div class="stat-item">
                                    <div class="stat-value">${analysis.total_consumption}</div>
                                    <div class="stat-label">總出庫量</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${analysis.working_days}</div>
                                    <div class="stat-label">實際工作日</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${analysis.recent_7_consumption}</div>
                                    <div class="stat-label">7天出庫量</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">${analysis.avg_daily_consumption}</div>
                                    <div class="stat-label">平均日消耗</div>
                                </div>
                            </div>
                        </div>

                        <!-- 儲位最近週期訂單訊息 (NEW) -->
                        <div class="mt-4">
                            <div class="consumption-section-title">
                                <span class="icon">📋</span>
                                該儲位最近週期訂單紀錄
                            </div>
                            ${historyHtml}
                        </div>
                    </div>

                    <!-- 右側：訂購建議 -->
                    <div class="col-lg-4">
                        ${suggestion.suggested_quantity > 0 ? `
                            <div class="order-suggestion-card ${suggestionClass} h-100">
                                <h6>📝 採購建議</h6>
                                <div class="mt-3">
                                    <div class="d-flex justify-content-between mb-2">
                                        <span>建議訂購量:</span>
                                        <span class="fw-bold fs-4 text-primary">${suggestion.suggested_quantity} ${inventory.unit}</span>
                                    </div>
                                    <hr class="my-2">
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="small">目標庫存水平:</span>
                                        <span class="small">${suggestion.target_stock_level}</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="small">當前可用庫存:</span>
                                        <span class="small">${suggestion.current_available_stock}</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-3 border-top pt-2">
                                        <span class="small">供應商 MOQ:</span>
                                        <span class="small">${suggestion.moq}</span>
                                    </div>
                                </div>
                                
                                <div class="urgency-progress mt-4">
                                    <label class="d-flex justify-content-between">
                                        <span>急迫度評分</span>
                                        <span>${suggestion.urgency_score}/100</span>
                                    </label>
                                    <div class="urgency-bar mt-1">
                                        <div class="urgency-fill ${getUrgencyClass(suggestion.urgency_score)}" style="width: ${suggestion.urgency_score}%"></div>
                                    </div>
                                </div>

                                <div class="alert alert-light mt-4 border-0 bg-opacity-10 bg-dark small">
                                    <i class="fas fa-info-circle me-1"></i>
                                    建議量根據您設定的 <strong>${suggestion.desired_days_of_stock} 天</strong> 預計存貨天數計算，並已滿足供應商 MOQ。
                                </div>
                            </div>
                        ` : `
                            <div class="consumption-alert success h-100 d-flex flex-column justify-content-center align-items-center text-center">
                                <i class="fas fa-check-circle fa-3x mb-3"></i>
                                <strong>庫存水位健康</strong>
                                <p class="small mt-2">目前庫存高於補貨點，暫無需建立新訂單。</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染儲位歷史紀錄表格
 * @param {Array} orders - 訂單紀錄陣列
 * @returns {string} HTML 字串
 */
function renderLocationHistoryTable(orders) {
    if (!orders || orders.length === 0) {
        return '<p class="text-muted small">暫無此儲位的訂單紀錄</p>';
    }

    return `
        <div class="table-responsive">
            <table class="table table-sm table-hover align-middle style="font-size: 0.85rem;"">
                <thead class="table-light">
                    <tr>
                        <th>申請日期</th>
                        <th>申請人</th>
                        <th>數量</th>
                        <th>狀態</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => {
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('zh-TW');
        return `
                            <tr>
                                <td>${formattedDate}</td>
                                <td>${order.applicant_name}</td>
                                <td>${order.quantity} ${order.unit || ''}</td>
                                <td><span class="badge ${window.getOrderStatusBadge ? window.getOrderStatusBadge(order.status) : 'bg-secondary'}">${window.getOrderStatusText ? window.getOrderStatusText(order.status) : order.status}</span></td>
                            </tr>
                        `;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * 渲染搜尋結果中的儲位摘要行
 * @param {Object} inv - 庫存資料
 * @returns {string} HTML 字串
 */
function renderLocationSummaryRow(inv) {
    const analysis = inv.consumption_analysis;
    const status = analysis ? analysis.stock_status : 'unknown';
    const urgency = inv.order_suggestion ? inv.order_suggestion.urgency_score : 0;

    return `
        <div class="col">
            <div class="card h-100 border-0 shadow-sm location-summary-card ${status === 'critical' ? 'bg-danger-subtle' : status === 'warning' ? 'bg-warning-subtle' : 'bg-success-subtle'}">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <span class="badge ${getInventoryStatusBadgeClass(status)} mb-1">${getInventoryStatusText(status)}</span>
                            <h6 class="mb-0 fw-bold ${status === 'critical' ? 'text-danger' : ''}">${inv.location_code}</h6>
                            <small class="text-muted">${inv.warehouse_name || '未指定倉庫'}</small>
                        </div>
                        <div class="text-end">
                            <small class="text-muted d-block">急迫度</small>
                            <span class="fw-bold ${urgency > 70 ? 'text-danger' : urgency > 40 ? 'text-warning' : 'text-success'}">${urgency}</span>
                        </div>
                    </div>
                    
                    <div class="row g-2 mb-3 mt-1 py-2 bg-light rounded mx-0">
                        <div class="col-4 text-center border-end">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">在庫</small>
                            <span class="fw-bold">${inv.quantity_on_hand}</span>
                        </div>
                        <div class="col-4 text-center border-end">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">安全線</small>
                            <span class="text-secondary">${inv.safety_stock}</span>
                        </div>
                        <div class="col-4 text-center">
                            <small class="text-muted d-block" style="font-size: 0.7rem;">補貨點</small>
                            <span class="text-secondary">${inv.reorder_point}</span>
                        </div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center">
                        <div class="small">
                            <span class="text-muted">預估天數:</span>
                            <span class="fw-bold ${analysis && analysis.days_of_stock < 7 ? 'text-danger' : ''}">
                                ${analysis ? analysis.days_of_stock.toFixed(1) : 'N/A'}
                            </span>
                        </div>
                        <button class="btn btn-sm btn-outline-primary js-show-location-detail" data-location-id="${inv.warehouse_location_id}">
                            詳情 <i class="fas fa-chevron-right ms-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染基本庫存卡片 (當沒有消耗分析時的備用顯示)
 * @param {Object} inventory - 庫存資料
 * @param {Array} allLocations - 該零件的所有儲位清單
 * @returns {string} HTML 字串
 */
function renderBasicInventoryCard(inventory, allLocations = []) {
    return `
        <div class="card mb-3 border-0 shadow-sm">
            <div class="card-header bg-light border-bottom-0 py-3">
                <h6 class="mb-0 fw-bold"><i class="fas fa-map-marker-alt me-2 text-danger"></i>${inventory.location_code} - ${inventory.warehouse_name || ''}</h6>
            </div>
            <div class="card-body">
                <div class="row text-center g-3">
                    <div class="col-6 col-md-3">
                        <div class="p-2 border rounded bg-white">
                            <small class="text-muted d-block mb-1">現有庫存</small>
                            <h5 class="mb-0 fw-bold text-primary">${inventory.quantity_on_hand} ${inventory.unit}</h5>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-2 border rounded bg-white">
                            <small class="text-muted d-block mb-1">可用庫存</small>
                            <h5 class="mb-0 fw-bold text-success">${inventory.available_quantity} ${inventory.unit}</h5>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-2 border rounded bg-white">
                            <small class="text-muted d-block mb-1">安全庫存線</small>
                            <h5 class="mb-0 fw-bold text-secondary">${inventory.safety_stock} ${inventory.unit}</h5>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-2 border rounded bg-white">
                            <small class="text-muted d-block mb-1">補貨點</small>
                            <h5 class="mb-0 fw-bold text-info">${inventory.reorder_point} ${inventory.unit}</h5>
                        </div>
                    </div>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3 bg-light p-3 rounded border-0">
                    <div class="text-muted small">
                        <i class="fas fa-info-circle me-1"></i> 消耗分析資料不足，需更多交易紀錄。
                    </div>
                    <button class="btn btn-sm btn-success shadow-sm js-add-to-weekly-order-detail"
                            data-part-number="${inventory.part_number}"
                            data-part-name="${inventory.part_name || ''}"
                            data-unit="${inventory.unit}"
                            data-locations='${JSON.stringify(allLocations)}'
                            data-location-id="${inventory.warehouse_location_id}">
                        <i class="fas fa-plus-circle"></i> 加入週期申請
                    </button>
                </div>
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
                    <span class="${getInventoryStatusBadgeClass(summary.overall_status)}">${getInventoryStatusText(summary.overall_status)}</span>
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

/**
 * 渲染零件基本資訊卡片 (用於模態框上半部分左側)
 * @param {Object} part - 零件資訊
 */
function renderPartBasicInfoCard(part) {
    if (!part) return '<p class="text-muted">無零件資訊</p>';

    return `
        <div class="card h-100 border-0 bg-light shadow-none">
            <div class="card-body p-0">
                <h6 class="fw-bold mb-3 border-bottom pb-2 text-primary">
                    <i class="fas fa-info-circle me-1"></i> 基本資訊
                </h6>
                <ul class="list-unstyled mb-0" style="font-size: 0.9rem;">
                    <li class="mb-2"><strong>零件編號:</strong> <span class="text-dark">${part.part_number}</span></li>
                    <li class="mb-2"><strong>零件名稱:</strong> <br><span class="text-secondary">${part.name}</span></li>
                    <li class="mb-2"><strong>單位:</strong> ${part.unit}</li>
                    <li class="mb-2"><strong>類型:</strong> ${part.type || 'N/A'}</li>
                    <li class="mb-2"><strong>前置期:</strong> ${part.lead_time || 'N/A'} 天</li>
                    ${part.description ? `<li class="mb-0"><strong>備註:</strong> <small class="text-muted d-block mt-1">${part.description}</small></li>` : ''}
                </ul>
            </div>
        </div>
    `;
}

/**
 * 渲染零件在所有儲位的庫存摘要表格 (用於模態框上半部分右側)
 * @param {Array} inventories - 儲位清單
 */
function renderInventorySummaryTable(inventories) {
    if (!inventories || inventories.length === 0) {
        return `
            <div class="h-100 d-flex flex-column">
                <h6 class="fw-bold mb-3 border-bottom pb-2 text-primary">
                    <i class="fas fa-boxes me-1"></i> 庫存分佈
                </h6>
                <p class="text-muted my-auto text-center small">暫無庫存記錄</p>
            </div>
        `;
    }

    return `
        <div class="h-100 flex-column d-flex">
            <h6 class="fw-bold mb-3 border-bottom pb-2 text-primary">
                <i class="fas fa-boxes me-1"></i> 全區庫存分佈
            </h6>
            <div class="table-responsive flex-grow-1" style="max-height: 200px; overflow-y: auto;">
                <table class="table table-sm table-hover border mb-0" style="font-size: 0.85rem;">
                    <thead class="bg-light" style="position: sticky; top: 0; z-index: 1;">
                        <tr>
                            <th>倉庫</th>
                            <th>儲位</th>
                            <th class="text-end">可用庫存</th>
                            <th class="text-center">狀態</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${inventories.map(inv => {
                            const available = inv.available_quantity !== undefined ? inv.available_quantity : (inv.quantity_on_hand - (inv.reserved_quantity || 0));
                            const health = calculateInventoryHealth(available);
                            return `
                                <tr class="js-location-row-click" data-location-id="${inv.warehouse_location_id}" style="cursor: pointer;">
                                    <td>${inv.warehouse_name || 'N/A'}</td>
                                    <td><code>${inv.location_code}</code></td>
                                    <td class="text-end fw-bold">${available} ${inv.unit}</td>
                                    <td class="text-center">
                                        <span class="badge ${health.badgeClass}" title="${health.tooltip}">
                                            ${health.icon} ${health.text}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * 計算庫存健康度 (內部使用)
 */
function calculateInventoryHealth(available) {
    if (available <= 0) {
        return { badgeClass: 'bg-danger', icon: '🔴', text: '缺貨', tooltip: '可用庫存為零' };
    } else if (available <= 5) {
        return { badgeClass: 'bg-warning', icon: '🟡', text: '偏低', tooltip: '庫存量偏低' };
    } else if (available <= 15) {
        return { badgeClass: 'bg-info', icon: '🔵', text: '正常', tooltip: '庫存狀況正常' };
    } else {
        return { badgeClass: 'bg-success', icon: '🟢', text: '充足', tooltip: '庫存充足' };
    }
}

// 暴露給全域使用
window.ConsumptionUtils = {
    getInventoryStatusBadgeClass,
    getInventoryStatusText,
    getTrendBadgeClass,
    getTrendText,
    getUrgencyClass,
    formatDaysOfStock,
    formatDate,
    renderOverallSummary,
    renderLocationDetailCard,
    renderBasicInventoryCard,
    renderConsumptionSummaryWidget,
    renderLocationSummaryRow,
    renderLocationHistoryTable,
    renderPartBasicInfoCard,
    renderInventorySummaryTable
};
