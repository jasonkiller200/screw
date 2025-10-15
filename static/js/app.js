// 全域 JavaScript 功能

// DOM 載入完成後執行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化工具提示
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // 初始化彈出提示
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // 自動隱藏 flash 訊息
    setTimeout(function() {
        var alerts = document.querySelectorAll('.alert.alert-dismissible');
        alerts.forEach(function(alert) {
            if (alert.querySelector('.btn-close')) {
                var bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        });
    }, 5000); // 5秒後自動隱藏

    // 表格排序功能（如果有需要）
    initTableSorting();
    
    // 搜尋功能增強
    initSearchEnhancements();
    
    // 表單驗證增強
    initFormValidation();
});

// 表格排序功能
function initTableSorting() {
    const sortableHeaders = document.querySelectorAll('th[data-sortable="true"]');
    
    sortableHeaders.forEach(header => {
        header.style.cursor = 'pointer';
        header.addEventListener('click', function() {
            const table = this.closest('table');
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const columnIndex = Array.from(this.parentNode.children).indexOf(this);
            const isAscending = this.classList.contains('sort-asc');
            
            // 清除其他列的排序標記
            sortableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            
            // 排序行
            rows.sort((a, b) => {
                const aText = a.children[columnIndex].textContent.trim();
                const bText = b.children[columnIndex].textContent.trim();
                
                // 檢查是否為數字
                const aNum = parseFloat(aText);
                const bNum = parseFloat(bText);
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAscending ? bNum - aNum : aNum - bNum;
                } else {
                    return isAscending ? bText.localeCompare(aText) : aText.localeCompare(bText);
                }
            });
            
            // 更新表格
            rows.forEach(row => tbody.appendChild(row));
            
            // 更新排序標記
            this.classList.add(isAscending ? 'sort-desc' : 'sort-asc');
        });
    });
}

// 搜尋功能增強
function initSearchEnhancements() {
    const searchInputs = document.querySelectorAll('input[type="search"], .search-input');
    
    searchInputs.forEach(input => {
        let searchTimeout;
        
        input.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(this.value, this.dataset.target);
            }, 300); // 300ms 延遲搜尋
        });
    });
}

// 執行搜尋
function performSearch(query, targetSelector) {
    if (!targetSelector) return;
    
    const target = document.querySelector(targetSelector);
    if (!target) return;
    
    const rows = target.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(query.toLowerCase());
        row.style.display = matches ? '' : 'none';
    });
}

// 表單驗證增強
function initFormValidation() {
    const forms = document.querySelectorAll('form[data-validate="true"], .needs-validation');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
}

// 通用 AJAX 請求函數
function makeRequest(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const config = { ...defaultOptions, ...options };
    
    return fetch(url, config)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .catch(error => {
            console.error('Request failed:', error);
            throw error;
        });
}

// 顯示載入狀態
function showLoading(element) {
    if (typeof element === 'string') {
        element = document.querySelector(element);
    }
    
    if (element) {
        element.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">載入中...</span>
                </div>
                <p class="mt-2 mb-0">載入中...</p>
            </div>
        `;
    }
}

// 顯示錯誤訊息
function showError(message, container) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    
    if (container) {
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }
}

// 顯示成功訊息
function showSuccess(message, container) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }
    
    if (container) {
        container.innerHTML = `
            <div class="alert alert-success" role="alert">
                <i class="fas fa-check-circle me-2"></i>
                ${message}
            </div>
        `;
    }
}

// 確認對話框
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 格式化數字
function formatNumber(number) {
    return new Intl.NumberFormat('zh-TW').format(number);
}

// 複製到剪貼簿
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => {
            showToast('已複製到剪貼簿', 'success');
        });
    } else {
        // 備用方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('已複製到剪貼簿', 'success');
        } catch (err) {
            console.error('複製失敗:', err);
            showToast('複製失敗', 'error');
        }
        document.body.removeChild(textArea);
    }
}

// 顯示 Toast 訊息
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();
    
    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : 
                   type === 'error' ? 'bg-danger' : 
                   type === 'warning' ? 'bg-warning' : 'bg-info';
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body">
                ${message}
                <button type="button" class="btn-close btn-close-white ms-2 float-end" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // 自動移除 toast 元素
    toastElement.addEventListener('hidden.bs.toast', function() {
        this.remove();
    });
}

// 創建 Toast 容器
function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1055';
    document.body.appendChild(container);
    return container;
}

// 防抖動函數
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// 節流函數
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 匯出函數供其他腳本使用
window.AppUtils = {
    makeRequest,
    showLoading,
    showError,
    showSuccess,
    confirmAction,
    formatDate,
    formatNumber,
    copyToClipboard,
    showToast,
    debounce,
    throttle
};