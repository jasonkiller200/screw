let trendChartInstance = null; // 全域變數，用於儲存 Chart.js 實例

document.addEventListener('DOMContentLoaded', function() {
    console.log("儀表板腳本已載入。");

    // 時間範圍切換按鈕的事件監聽
    const timespanButtons = document.querySelectorAll('.timespan-btn');
    timespanButtons.forEach(button => {
        button.addEventListener('click', function() {
            const timespan = this.dataset.timespan;
            
            // 更新按鈕的啟用狀態
            timespanButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            // 使用新的時間範圍更新儀表板
            updateDashboard(timespan);
        });
    });

    // 初始載入，使用預設時間範圍 'daily'
    updateDashboard('daily');
});

/**
 * 從後端獲取數據並更新整個儀表板
 * @param {string} timespan - 時間範圍 ('daily', 'weekly', 'monthly')
 */
async function updateDashboard(timespan = 'daily') {
    console.log(`正在獲取時間範圍為 "${timespan}" 的儀表板數據...`);
    try {
        const response = await fetch(`/api/dashboard?timespan=${timespan}`);
        if (!response.ok) {
            throw new Error(`HTTP 錯誤！狀態: ${response.status}`);
        }
        const data = await response.json();
        console.log("成功獲取數據:", data);

        // 更新儀表板的各個部分
        updateKPIs(data.kpi);
        updateTrendChart(data.trend_chart, timespan); // 傳遞 timespan 給圖表更新
        updateTopItems(data.top_checkout_items);
        updateStockAlerts(data.stock_alerts);

    } catch (error) {
        console.error("無法獲取儀表板數據:", error);
        // 可以在此處顯示一個錯誤訊息給使用者
    }
}

/**
 * 處理趨勢顯示的輔助函式
 * @param {HTMLElement} element - 顯示趨勢的 DOM 元素
 * @param {number} trendValue - 趨勢值 (百分比)
 */
function updateTrendDisplay(element, trendValue) {
    element.innerHTML = ''; // 清空現有內容

    const span = document.createElement('span');
    const icon = document.createElement('i');
    icon.classList.add('fas', 'trend-icon');

    if (trendValue > 0) {
        span.classList.add('trend-up');
        span.textContent = `+${trendValue}%`;
        icon.classList.add('fa-arrow-up', 'trend-up');
    } else if (trendValue < 0) {
        span.classList.add('trend-down');
        span.textContent = `${trendValue}%`;
        icon.classList.add('fa-arrow-down', 'trend-down');
    } else {
        span.classList.add('trend-neutral');
        span.textContent = `0%`;
        icon.classList.add('fa-minus', 'trend-neutral'); // 使用橫線表示無變化
    }

    element.appendChild(span);
    element.appendChild(icon);

    const textMuted = document.createElement('span');
    textMuted.classList.add('text-muted', 'ms-1');
    textMuted.textContent = 'vs 上週';
    element.appendChild(textMuted);
}


/**
 * 更新頂部的 KPI 數據卡片
 * @param {object} kpiData - 包含 KPI 數據的物件
 */
function updateKPIs(kpiData) {
    console.log("正在更新 KPI...");
    
    document.getElementById('kpi-parts-with-location').textContent = kpiData.parts_with_location_count.toLocaleString();
    document.getElementById('kpi-total-stock').textContent = kpiData.total_stock_quantity.toLocaleString();

    document.getElementById('kpi-weekly-out').textContent = kpiData.weekly_stock_out.value.toLocaleString();
    updateTrendDisplay(document.getElementById('kpi-weekly-out-trend'), kpiData.weekly_stock_out.trend);

    document.getElementById('kpi-weekly-in').textContent = kpiData.weekly_stock_in.value.toLocaleString();
    updateTrendDisplay(document.getElementById('kpi-weekly-in-trend'), kpiData.weekly_stock_in.trend);

    document.getElementById('kpi-low-stock').textContent = kpiData.low_stock_count.toLocaleString();
    document.getElementById('kpi-out-of-stock').textContent = kpiData.out_of_stock_count.toLocaleString();

    // 更新快速統計面板 (如果需要，這裡可以從 KPI 數據中提取)
    document.getElementById('stat-weekly-in').textContent = kpiData.weekly_stock_in.value.toLocaleString();
    document.getElementById('stat-weekly-out').textContent = kpiData.weekly_stock_out.value.toLocaleString();
    // 庫存周轉率和待辦事項目前後端未提供，先留空或使用預設值
    document.getElementById('stat-turnover').textContent = 'N/A'; // 待後端提供
    document.getElementById('todo-pending-reviews').textContent = 'N/A'; // 待後端提供
    document.getElementById('todo-pending-inbound').textContent = 'N/A'; // 待後端提供
}

/**
 * 更新趨勢圖
 * @param {object} chartData - 包含圖表數據的物件
 * @param {string} timespan - 當前的時間範圍 ('daily', 'weekly', 'monthly')
 */
function updateTrendChart(chartData, timespan) {
    console.log("正在更新趨勢圖...");
    const ctx = document.getElementById('trendChart').getContext('2d');

    // 如果圖表實例已存在，則銷毀它
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    // 更新圖表標題
    let chartTitleText = '綜合趨勢圖';
    if (timespan === 'daily') chartTitleText += ' (日)';
    else if (timespan === 'weekly') chartTitleText += ' (週)';
    else if (timespan === 'monthly') chartTitleText += ' (月)';
    document.getElementById('chart-title').innerHTML = `<i class="fas fa-chart-line me-2"></i>${chartTitleText}`;


    trendChartInstance = new Chart(ctx, {
        type: 'bar', // 預設為長條圖
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: '入庫量',
                    data: chartData.inbound_data,
                    backgroundColor: 'rgba(40, 167, 69, 0.6)', // 綠色
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1' // 副 Y 軸
                },
                {
                    label: '出庫量',
                    data: chartData.outbound_data,
                    backgroundColor: 'rgba(220, 53, 69, 0.6)', // 紅色
                    borderColor: 'rgba(220, 53, 69, 1)',
                    borderWidth: 1,
                    yAxisID: 'y1' // 副 Y 軸
                },
                {
                    label: '總庫存量',
                    data: chartData.total_stock_trend,
                    type: 'line', // 設為線圖
                    borderColor: 'rgba(0, 123, 255, 1)', // 藍色
                    backgroundColor: 'rgba(0, 123, 255, 0.2)',
                    fill: true,
                    tension: 0.3,
                    yAxisID: 'y', // 主 Y 軸
                    pointRadius: 3,
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false, // 標題已在 HTML 中處理
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: (timespan === 'daily' ? '日期' : (timespan === 'weekly' ? '週' : '月份'))
                    }
                },
                y: { // 主 Y 軸 (左側)
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '總庫存量'
                    }
                },
                y1: { // 副 Y 軸 (右側)
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '出入庫量'
                    },
                    grid: {
                        drawOnChartArea: false, // 只在主 Y 軸上繪製網格線
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * 更新出庫頻率排行列表
 * @param {Array} topItems - 包含排行數據的陣列
 */
function updateTopItems(topItems) {
    console.log("正在更新出庫排行...");
    const topItemsList = document.getElementById('top-items-list');
    topItemsList.innerHTML = ''; // 清空現有內容

    if (topItems && topItems.length > 0) {
        topItems.forEach(item => {
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            listItem.innerHTML = `
                ${item.part_number} - ${item.part_name}
                <span class="badge bg-primary rounded-pill">${item.count} 次</span>
            `;
            topItemsList.appendChild(listItem);
        });
    } else {
        topItemsList.innerHTML = '<li class="list-group-item text-muted">暫無出庫排行數據</li>';
    }
}

/**
 * 更新庫存預警清單
 * @param {Array} stockAlerts - 包含預警數據的陣列
 */
function updateStockAlerts(stockAlerts) {
    console.log("正在更新庫存預警...");
    const stockAlertsList = document.getElementById('stock-alerts-list');
    stockAlertsList.innerHTML = ''; // 清空現有內容

    if (stockAlerts && stockAlerts.length > 0) {
        stockAlerts.forEach(alert => {
            const listItem = document.createElement('li');
            listItem.classList.add('list-group-item');
            
            const statusBadgeClass = alert.status === '缺貨' ? 'bg-danger' : 'bg-warning';
            const statusTextColorClass = alert.status === '缺貨' ? 'text-danger' : 'text-warning';
            const progressWidth = (alert.available_quantity / alert.reorder_point) * 100;
            const progressBarClass = alert.status === '缺貨' ? 'bg-danger' : 'bg-warning';

            listItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge ${statusBadgeClass} me-2">${alert.status}</span>
                        <strong>${alert.part_number}</strong> - ${alert.part_name} (${alert.location_code})
                    </div>
                    <div class="text-end">
                        <small class="${statusTextColorClass}">${alert.available_quantity} / ${alert.reorder_point}</small>
                        <div class="progress" style="width: 100px; height: 8px;">
                            <div class="progress-bar ${progressBarClass}" role="progressbar" style="width: ${progressWidth}%;" 
                                aria-valuenow="${progressWidth}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                    </div>
                </div>
            `;
            stockAlertsList.appendChild(listItem);
        });
    } else {
        stockAlertsList.innerHTML = '<li class="list-group-item text-muted">暫無庫存預警項目</li>';
    }
}
