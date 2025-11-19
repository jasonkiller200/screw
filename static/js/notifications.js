/**
 * 訊息通知前端功能
 */

let deleteNotificationId = null;

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', function() {
    loadNotifications(false);
    setupEventListeners();
});

function setupEventListeners() {
    // 全部標記為已讀
    document.getElementById('markAllReadBtn').addEventListener('click', markAllAsRead);
    
    // 刪除確認
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
}

function loadNotifications(onlyUnread = false) {
    // 修正 URL 構建，只在需要時添加 unread 參數
    let url = '/notifications/api/list?limit=100';  // 增加數量限制以顯示更多歷史訊息
    if (onlyUnread === true) {
        url += '&unread=true';
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            displayNotifications(data.notifications);
        })
        .catch(error => {
            console.error('載入通知失敗:', error);
            showError('載入通知失敗');
        });
}

function displayNotifications(notifications) {
    const container = document.getElementById('notificationsList');
    
    if (!notifications || notifications.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-inbox fa-3x mb-3"></i>
                <h5>沒有訊息</h5>
                <p>目前沒有任何訊息通知</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    notifications.forEach(notification => {
        html += createNotificationCard(notification);
    });
    
    container.innerHTML = html;
}

function createNotificationCard(notification) {
    const isUnread = !notification.is_read;
    const typeIcon = getNotificationIcon(notification.type);
    const typeClass = getNotificationClass(notification.type);
    
    return `
        <div class="card mb-3 ${isUnread ? 'border-primary' : ''}" id="notification-${notification.id}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center mb-2">
                            <i class="${typeIcon} ${typeClass} me-2"></i>
                            <h6 class="mb-0 ${isUnread ? 'fw-bold' : ''}">${notification.title}</h6>
                            ${isUnread ? '<span class="badge bg-primary ms-2">未讀</span>' : ''}
                        </div>
                        
                        ${notification.content ? `<p class="text-muted mb-2">${notification.content}</p>` : ''}
                        
                        <small class="text-muted">
                            <i class="fas fa-clock"></i> ${notification.created_at}
                        </small>
                    </div>
                    
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <ul class="dropdown-menu">
                            ${isUnread ? `
                                <li><a class="dropdown-item" href="#" onclick="markAsRead(${notification.id})">
                                    <i class="fas fa-check"></i> 標記為已讀
                                </a></li>
                            ` : ''}
                            <li><a class="dropdown-item text-danger" href="#" onclick="deleteNotification(${notification.id})">
                                <i class="fas fa-trash"></i> 刪除
                            </a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getNotificationIcon(type) {
    switch (type) {
        case 'order_rejected':
            return 'fas fa-times-circle';
        case 'announcement':
            return 'fas fa-bullhorn';
        case 'system':
            return 'fas fa-cog';
        default:
            return 'fas fa-bell';
    }
}

function getNotificationClass(type) {
    switch (type) {
        case 'order_rejected':
            return 'text-danger';
        case 'announcement':
            return 'text-info';
        case 'system':
            return 'text-warning';
        default:
            return 'text-primary';
    }
}

function markAsRead(notificationId) {
    fetch(`/notifications/api/mark-read/${notificationId}`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 更新 UI
            const card = document.getElementById(`notification-${notificationId}`);
            if (card) {
                card.classList.remove('border-primary');
                const badge = card.querySelector('.badge.bg-primary');
                if (badge) {
                    badge.remove();
                }
                const title = card.querySelector('h6');
                if (title) {
                    title.classList.remove('fw-bold');
                }
            }
            
            // 更新頂部通知數量
            updateNotificationBadge();
        } else {
            showError(data.message);
        }
    })
    .catch(error => {
        console.error('標記已讀失敗:', error);
        showError('操作失敗');
    });
}

function markAllAsRead() {
    fetch('/notifications/api/mark-all-read', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess(data.message);
            loadNotifications(false);
            updateNotificationBadge();
        } else {
            showError(data.message);
        }
    })
    .catch(error => {
        console.error('標記全部已讀失敗:', error);
        showError('操作失敗');
    });
}

function deleteNotification(notificationId) {
    deleteNotificationId = notificationId;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

function confirmDelete() {
    if (!deleteNotificationId) return;
    
    fetch(`/notifications/api/delete/${deleteNotificationId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 移除 UI 中的通知卡片
            const card = document.getElementById(`notification-${deleteNotificationId}`);
            if (card) {
                card.remove();
            }
            
            showSuccess('通知已刪除');
            updateNotificationBadge();
        } else {
            showError(data.message);
        }
    })
    .catch(error => {
        console.error('刪除通知失敗:', error);
        showError('刪除失敗');
    })
    .finally(() => {
        deleteNotificationId = null;
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
    });
}

function updateNotificationBadge() {
    // 更新頂部導航的通知徽章
    if (typeof window.updateNotificationCount === 'function') {
        window.updateNotificationCount();
    }
}

function showSuccess(message) {
    // 顯示成功訊息
    const alert = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    const container = document.querySelector('.container-fluid');
    container.insertAdjacentHTML('afterbegin', alert);
}

function showError(message) {
    // 顯示錯誤訊息
    const alert = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    const container = document.querySelector('.container-fluid');
    container.insertAdjacentHTML('afterbegin', alert);
}