/**
 * Session 過期檢測與自動處理
 * 防止用戶長時間不操作後 Session 過期導致資料丟失
 */

(function() {
    'use strict';
    
    // 配置參數
    const CONFIG = {
        CHECK_INTERVAL: 5 * 60 * 1000,      // 每 5 分鐘檢查一次
        WARNING_TIME: 10 * 60 * 1000,       // 過期前 10 分鐘警告
        SESSION_LIFETIME: 8 * 60 * 60 * 1000, // 8 小時（與後端一致）
        HEARTBEAT_INTERVAL: 30 * 60 * 1000  // 每 30 分鐘發送心跳
    };
    
    let sessionStartTime = Date.now();
    let warningShown = false;
    let heartbeatTimer = null;
    let checkTimer = null;
    
    /**
     * 檢查 Session 是否即將過期
     */
    function checkSessionExpiry() {
        const elapsed = Date.now() - sessionStartTime;
        const remaining = CONFIG.SESSION_LIFETIME - elapsed;
        
        // Session 即將過期（剩餘 10 分鐘內）
        if (remaining <= CONFIG.WARNING_TIME && !warningShown) {
            showExpiryWarning(remaining);
            warningShown = true;
        }
        
        // Session 已過期
        if (remaining <= 0) {
            handleSessionExpired();
        }
    }
    
    /**
     * 顯示過期警告
     */
    function showExpiryWarning(remaining) {
        const minutes = Math.floor(remaining / 60000);
        
        const alertHtml = `
            <div class="alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" 
                 style="z-index: 9999; min-width: 400px;" role="alert" id="sessionWarningAlert">
                <div class="d-flex align-items-center">
                    <i class="fas fa-exclamation-triangle fa-2x me-3"></i>
                    <div class="flex-grow-1">
                        <h6 class="alert-heading mb-1">登入即將過期</h6>
                        <p class="mb-2">您的登入狀態將在 ${minutes} 分鐘後過期</p>
                        <div class="d-grid gap-2">
                            <button type="button" class="btn btn-sm btn-warning" onclick="window.extendSession()">
                                <i class="fas fa-redo me-1"></i>延長登入時間
                            </button>
                        </div>
                    </div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', alertHtml);
    }
    
    /**
     * 處理 Session 過期
     */
    function handleSessionExpired() {
        // 停止所有定時器
        clearInterval(checkTimer);
        clearInterval(heartbeatTimer);
        
        // 顯示過期提示
        if (confirm('您的登入已過期，請重新登入。\n\n點擊「確定」前往登入頁面。')) {
            window.location.href = '/login';
        } else {
            window.location.href = '/login';
        }
    }
    
    /**
     * 發送心跳請求延長 Session
     */
    async function sendHeartbeat() {
        try {
            const response = await fetch('/api/session/heartbeat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // 重置 Session 開始時間
                sessionStartTime = Date.now();
                warningShown = false;
                
                // 移除警告提示
                const warningAlert = document.getElementById('sessionWarningAlert');
                if (warningAlert) {
                    warningAlert.remove();
                }
                
                console.log('Session 已延長');
            } else if (response.status === 401) {
                handleSessionExpired();
            }
        } catch (error) {
            console.error('發送心跳失敗:', error);
        }
    }
    
    /**
     * 手動延長 Session（供警告按鈕調用）
     */
    window.extendSession = async function() {
        await sendHeartbeat();
        
        // 顯示成功提示
        const warningAlert = document.getElementById('sessionWarningAlert');
        if (warningAlert) {
            warningAlert.remove();
        }
        
        showSuccessToast('登入時間已延長 8 小時');
    };
    
    /**
     * 顯示成功提示
     */
    function showSuccessToast(message) {
        const toastHtml = `
            <div class="toast position-fixed top-0 start-50 translate-middle-x mt-3" 
                 style="z-index: 9999;" role="alert" id="successToast">
                <div class="toast-header bg-success text-white">
                    <i class="fas fa-check-circle me-2"></i>
                    <strong class="me-auto">成功</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">${message}</div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById('successToast');
        const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
    
    /**
     * 攔截 AJAX 請求，檢測 401 錯誤
     */
    function interceptAjaxErrors() {
        // 攔截 fetch
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            try {
                const response = await originalFetch.apply(this, args);
                
                // 檢測 401 錯誤
                if (response.status === 401) {
                    const url = args[0];
                    // 排除登入相關的 API
                    if (!url.includes('/login') && !url.includes('/register')) {
                        handleSessionExpired();
                    }
                }
                
                return response;
            } catch (error) {
                throw error;
            }
        };
        
        // 攔截 XMLHttpRequest（如果有用到 jQuery 或其他庫）
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(...args) {
            this._url = args[1];
            return originalOpen.apply(this, args);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            this.addEventListener('load', function() {
                if (this.status === 401 && this._url && 
                    !this._url.includes('/login') && !this._url.includes('/register')) {
                    handleSessionExpired();
                }
            });
            return originalSend.apply(this, args);
        };
    }
    
    /**
     * 檢測用戶活動
     */
    function setupActivityDetection() {
        let activityTimeout;
        const INACTIVITY_THRESHOLD = 30 * 60 * 1000; // 30 分鐘無活動
        
        function resetActivityTimer() {
            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(() => {
                console.log('用戶長時間未活動，考慮發送心跳');
                // 可以選擇自動發送心跳或提示用戶
            }, INACTIVITY_THRESHOLD);
        }
        
        // 監聽用戶活動
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetActivityTimer, { passive: true });
        });
        
        resetActivityTimer();
    }
    
    /**
     * 初始化
     */
    function init() {
        // 檢查是否在登入頁面
        if (window.location.pathname.includes('/login') || 
            window.location.pathname.includes('/register')) {
            return;
        }
        
        console.log('Session 監控已啟動');
        
        // 定期檢查 Session
        checkTimer = setInterval(checkSessionExpiry, CONFIG.CHECK_INTERVAL);
        
        // 定期發送心跳
        heartbeatTimer = setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
        
        // 攔截 AJAX 錯誤
        interceptAjaxErrors();
        
        // 檢測用戶活動
        setupActivityDetection();
        
        // 頁面隱藏時停止心跳，顯示時恢復
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                clearInterval(heartbeatTimer);
            } else {
                // 頁面重新顯示時，立即檢查 Session
                checkSessionExpiry();
                heartbeatTimer = setInterval(sendHeartbeat, CONFIG.HEARTBEAT_INTERVAL);
            }
        });
    }
    
    // 頁面載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
