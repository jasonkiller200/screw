// 設定預設日期範圍（最近30天）
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

document.addEventListener('DOMContentLoaded', function() {
    const dateFrom = document.getElementById('date_from');
    const dateTo = document.getElementById('date_to');
    
    // 只有當欄位沒有值時才設定預設值（來自伺服器的選中值優先）
    if (dateFrom && !dateFrom.value) {
        dateFrom.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    if (dateTo && !dateTo.value) {
        dateTo.value = today.toISOString().split('T')[0];
    }

    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            loadTransactions();
        });
    }
});

// 載入異動記錄
function loadTransactions(page = 1) {
    const filterForm = document.getElementById('filterForm');
    if (!filterForm) return;

    const formData = new FormData(filterForm);
    const params = new URLSearchParams();
    
    for (const [key, value] of formData.entries()) {
        if (value) {
            params.append(key, value);
        }
    }
    params.append('page', page);
    
    // 重新載入頁面
    if (typeof TRANSACTIONS_URL !== 'undefined') {
        window.location.href = TRANSACTIONS_URL + '?' + params.toString();
    } else {
        console.error('TRANSACTIONS_URL is not defined.');
    }
}

// 載入指定頁面
function loadPage(page) {
    loadTransactions(page);
}

// 匯出異動記錄
function exportTransactions() {
    const filterForm = document.getElementById('filterForm');
    if (!filterForm) return;

    const formData = new FormData(filterForm);
    const params = new URLSearchParams();
    
    for (const [key, value] of formData.entries()) {
        if (value) {
            params.append(key, value);
        }
    }
    
    window.open('/api/inventory/transactions/export?' + params.toString(), '_blank');
}
