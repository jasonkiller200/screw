/**
 * Notification Modal Logic
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initial check for unread messages on page load
    checkAndShowUnreadModal();

    // Add event listener for the history button (the bell icon in the navbar)
    const historyBtn = document.getElementById('notificationHistoryBtn');
    if (historyBtn) {
        historyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Show all notifications when the history button is clicked
            showNotificationModal(false); 
        });
    }
});

/**
 * Checks for unread notifications and shows the modal if necessary.
 * This function will be called by window.updateNotificationCount in base.html
 */
window.checkAndShowUnreadModal = function() {
    fetch('/notifications/api/unread-count')
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('User not authenticated for unread count, not showing modal.');
                    return Promise.reject('Unauthorized');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Only show modal if there are unread messages and it's not already open
            const modalElement = document.getElementById('notificationModal');
            const isModalOpen = modalElement ? modalElement.classList.contains('show') : false;

            if (data.unread_count > 0 && !isModalOpen) {
                showNotificationModal(true); // true = load only unread notifications
            }
        })
        .catch(error => console.error('Error fetching unread count for modal:', error));
};


/**
 * Shows the notification modal.
 * @param {boolean} onlyUnread - If true, fetches only unread notifications.
 */
function showNotificationModal(onlyUnread = false) {
    const modalElement = document.getElementById('notificationModal');
    // Create new modal instance each time to ensure it's fresh
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: 'static', // User cannot click outside to close
        keyboard: false // User cannot use Esc key to close
    });

    const modalTitle = document.getElementById('notificationModalTitle');
    const modalBody = document.getElementById('notificationModalBody');
    const modalCloseBtn = document.getElementById('notificationModalCloseBtn');
    const modalFooterCloseBtn = document.getElementById('notificationModalFooterCloseBtn');

    // Set title and prepare body for loading
    modalTitle.textContent = onlyUnread ? '未讀訊息' : '所有訊息';
    modalBody.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">載入中...</span></div><p class="text-muted mt-2">載入訊息中...</p></div>';
    
    // Hide both close buttons initially if showing unread messages, show them for history view
    if (onlyUnread) {
        modalCloseBtn.style.display = 'none';
        if (modalFooterCloseBtn) modalFooterCloseBtn.style.display = 'none';
    } else {
        modalCloseBtn.style.display = ''; // Always show when viewing history
        if (modalFooterCloseBtn) modalFooterCloseBtn.style.display = '';
    }
    
    // Fetch and display notifications
    loadNotificationsForModal(onlyUnread);

    modal.show();
}

/**
 * Fetches and renders notifications inside the modal.
 * @param {boolean} onlyUnread
 */
function loadNotificationsForModal(onlyUnread) {
    // 構造 URL - 只在需要未讀訊息時才加上 unread 參數
    let url = `/notifications/api/list?limit=100${onlyUnread ? '&unread=true' : ''}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            renderNotificationsInModal(data.notifications, onlyUnread);
        })
        .catch(error => {
            console.error('Error loading notifications for modal:', error);
            document.getElementById('notificationModalBody').innerHTML = '<div class="alert alert-danger m-3" role="alert">無法載入訊息，請稍後再試。</div>';
            if(onlyUnread) { // If it was unread mode and failed to load, show close button
                const modalCloseBtn = document.getElementById('notificationModalCloseBtn');
                const modalFooterCloseBtn = document.getElementById('notificationModalFooterCloseBtn');
                if (modalCloseBtn) modalCloseBtn.style.display = '';
                if (modalFooterCloseBtn) modalFooterCloseBtn.style.display = '';
            }
        });
}

/**
 * Renders the notification items in the modal.
 * @param {Array} notifications
 * @param {boolean} isUnreadMode - True if we are in "unread" mode (modal requires confirmation)
 */
function renderNotificationsInModal(notifications, isUnreadMode) {
    const modalBody = document.getElementById('notificationModalBody');
    const modalCloseBtn = document.getElementById('notificationModalCloseBtn');
    const modalFooterCloseBtn = document.getElementById('notificationModalFooterCloseBtn');

    if (!notifications || notifications.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fas fa-inbox fa-3x mb-3"></i>
                <h5>沒有${isUnreadMode ? '未讀' : ''}訊息</h5>
                <p>目前沒有任何${isUnreadMode ? '未讀' : ''}訊息通知</p>
            </div>
        `;
        // If no unread messages, show close button immediately
        if (isUnreadMode) {
            modalCloseBtn.style.display = '';
            if (modalFooterCloseBtn) modalFooterCloseBtn.style.display = '';
        }
        return;
    }

    let content = '<div class="list-group">'; // Use Bootstrap list-group for better styling
    notifications.forEach(n => {
        const isRead = n.is_read;
        const typeIcon = getNotificationIcon(n.type);
        const typeClass = getNotificationClass(n.type);

        content += `
            <div class="list-group-item list-group-item-action ${isRead ? 'text-muted' : 'border-primary'}" id="modal-notification-${n.id}">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1 ${isRead ? '' : 'fw-bold'}">
                        <i class="${typeIcon} ${typeClass} me-2"></i> ${n.title}
                        ${!isRead && isUnreadMode ? '<span class="badge bg-primary ms-2">未讀</span>' : ''}
                    </h5>
                    <small>${n.created_at}</small>
                </div>
                <p class="mb-1">${n.content || ''}</p>
                ${!isRead && isUnreadMode ? `<button class="btn btn-sm btn-primary mt-2" onclick="markNotificationAsReadInModal(${n.id})">確認並標記為已讀</button>` : ''}
            </div>
        `;
    });
    content += '</div>';
    modalBody.innerHTML = content;

    // After rendering, check if there are still actual unread messages that need confirmation
    if (isUnreadMode) {
        checkIfAllModalMessagesRead(); // This will enable/disable the close button
    }
}

/**
 * Helper to get icon class based on notification type.
 * Replicated from notifications.js for self-containment.
 */
function getNotificationIcon(type) {
    switch (type) {
        case 'order_rejected': return 'fas fa-times-circle';
        case 'announcement': return 'fas fa-bullhorn';
        case 'system': return 'fas fa-cog';
        default: return 'fas fa-bell';
    }
}

/**
 * Helper to get text color class based on notification type.
 * Replicated from notifications.js for self-containment.
 */
function getNotificationClass(type) {
    switch (type) {
        case 'order_rejected': return 'text-danger';
        case 'announcement': return 'text-info';
        case 'system': return 'text-warning';
        default: return 'text-primary';
    }
}

/**
 * Marks a notification as read from within the modal.
 * @param {number} notificationId
 */
window.markNotificationAsReadInModal = function(notificationId) {
    fetch(`/notifications/api/mark-read/${notificationId}`, { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const item = document.getElementById(`modal-notification-${notificationId}`);
                if (item) {
                    item.classList.add('text-muted');
                    item.classList.remove('border-primary');
                    const badge = item.querySelector('.badge.bg-primary');
                    if (badge) badge.remove();
                    const title = item.querySelector('h5');
                    if (title) title.classList.remove('fw-bold');
                    
                    const button = item.querySelector('button');
                    if (button) {
                        button.disabled = true;
                        button.textContent = '已確認';
                        button.classList.remove('btn-primary');
                        button.classList.add('btn-secondary');
                    }
                }
                // After marking one, check if all unread messages are now read
                checkIfAllModalMessagesRead();
                // Update the main navbar badge (this is a global function in base.html)
                if (typeof window.updateNotificationCount === 'function') {
                    window.updateNotificationCount(); 
                }
            } else {
                console.error('Failed to mark notification as read:', data.message);
            }
        })
        .catch(error => console.error('Error marking notification as read:', error));
};

/**
 * Checks if there are any *visually presented* unread notifications
 * that still require a "confirmation" button click.
 * If none, shows the modal's close buttons.
 */
function checkIfAllModalMessagesRead() {
    const modalBody = document.getElementById('notificationModalBody');
    // Select all buttons that are NOT disabled (meaning they still need to be clicked)
    const remainingUnreadButtons = modalBody.querySelectorAll('.list-group-item button:not(:disabled)');
    
    // If there are no active confirmation buttons left, show both close buttons
    if (remainingUnreadButtons.length === 0) {
        const modalCloseBtn = document.getElementById('notificationModalCloseBtn');
        const modalFooterCloseBtn = document.getElementById('notificationModalFooterCloseBtn');
        if (modalCloseBtn) modalCloseBtn.style.display = '';
        if (modalFooterCloseBtn) modalFooterCloseBtn.style.display = '';
    }
}

// Ensure the global update function is aware of the new check function
if (typeof window.updateNotificationCount === 'function') {
    const originalUpdateNotificationCount = window.updateNotificationCount;
    window.updateNotificationCount = function() {
        originalUpdateNotificationCount(); // Call original function
        window.checkAndShowUnreadModal(); // Also call modal check
    };
} else {
    // If window.updateNotificationCount is not defined yet, define it so checkAndShowUnreadModal can be attached
    // This handles cases where this script loads before the main base.html script block
    window.updateNotificationCount = function() {
        window.checkAndShowUnreadModal();
    };
}

