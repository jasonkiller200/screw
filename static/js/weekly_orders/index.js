let currentCycleId = null;

// 頁面載入時獲取摘要
document.addEventListener('DOMContentLoaded', function() {
    refreshSummary();
});

// 重新整理摘要資訊
function refreshSummary() {
    fetch('/weekly-orders/api/cycle-summary')
        .then(response => response.json())
        .then(data => {
            updateCycleCard(data);
        })
        .catch(error => {
            console.error('Error:', error);
            showError('載入摘要資訊失敗');
        });
}

// 更新週期卡片
function updateCycleCard(data) {
    const statusEl = document.getElementById('cycleStatus');
    const contentEl = document.getElementById('cycleContent');
    const reviewBtn = document.getElementById('reviewBtn');
    
    if (!data.has_active_cycle) {
        statusEl.textContent = '無活躍週期';
        statusEl.className = 'badge bg-light text-secondary ms-2';
        contentEl.innerHTML = `
            <div class="text-center py-3">
                <i class="fas fa-calendar-plus fa-2x text-muted mb-3"></i>
                <h5 class="text-muted">目前沒有活躍的申請週期</h5>
                <button class="btn" style="background-color: #9B2D8E; border-color: #9B2D8E; color: white;" onclick="createNewCycle()">
                    <i class="fas fa-plus me-1"></i>建立新週期
                </button>
            </div>
        `;
        reviewBtn.disabled = true;
        return;
    }
    
    const cycle = data.cycle;
    currentCycleId = cycle.id;
    
    // 更新狀態標籤
    if (cycle.is_active) {
        statusEl.textContent = '進行中';
        statusEl.className = 'badge bg-success ms-2';
    } else if (cycle.is_overdue) {
        statusEl.textContent = '已截止';
        statusEl.className = 'badge bg-danger ms-2';
    } else {
        statusEl.textContent = cycle.status;
        statusEl.className = 'badge bg-warning ms-2';
    }
    
    // 更新卡片內容
    let timeRemaining = '';
    if (data.time_remaining) {
        const tr = data.time_remaining;
        timeRemaining = `
            <div class="alert alert-info mb-3">
                <i class="fas fa-hourglass-half me-2"></i>
                <strong>剩餘時間：</strong>
                ${tr.days} 天 ${tr.hours} 小時 ${tr.minutes} 分鐘
            </div>
        `;
    }
    
    contentEl.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <h5>${cycle.cycle_name}</h5>
                <p class="text-muted mb-1">
                    <i class="fas fa-calendar-start me-1"></i>
                    開始：${new Date(cycle.start_date).toLocaleDateString('zh-TW')}
                </p>
                <p class="text-muted mb-3">
                    <i class="fas fa-calendar-times me-1"></i>
                    截止：${new Date(cycle.deadline).toLocaleString('zh-TW')}
                </p>
                ${timeRemaining}
            </div>
            <div class="col-md-4">
                <div class="row text-center">
                    <div class="col-6">
                        <div class="border rounded p-2">
                            <h4 class="mb-1" style="color: #9B2D8E;">${data.stats.total}</h4>
                            <small class="text-muted">總登記</small>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="border rounded p-2">
                            <h4 class="text-success mb-1">${data.stats.approved}</h4>
                            <small class="text-muted">已核准</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    reviewBtn.disabled = false;
}

// 前往審查頁面
function goToReview() {
    if (currentCycleId) {
        window.location.href = `/weekly-orders/review/${currentCycleId}`;
    } else {
        alert('沒有可審查的週期');
    }
}

// 建立新週期
function createNewCycle() {
    if (confirm('確定要建立新的申請週期嗎？')) {
        fetch('/weekly-orders/api/create-cycle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                location.reload();
            } else {
                alert('建立失敗：' + data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('建立失敗：網路錯誤');
        });
    }
}

// 錯誤顯示
function showError(message) {
    const contentEl = document.getElementById('cycleContent');
    contentEl.innerHTML = `
        <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
        </div>
    `;
}

// Delete cycle
function deleteCycle(cycleId) {
    if (confirm('確定要刪除這個週期嗎？此操作無法復原。')) {
        fetch(`/weekly-orders/cycle/${cycleId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                location.reload();
            } else {
                alert('刪除失敗：' + data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('刪除失敗：網路錯誤');
        });
    }
}
