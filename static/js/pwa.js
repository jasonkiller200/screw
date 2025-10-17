// 註冊 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // 檢查是否為安全環境
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        const isHTTPS = location.protocol === 'https:';
        const isSecureContext = window.isSecureContext;
        
        // 只在安全環境中註冊 Service Worker
        if (!isSecureContext && !isLocalhost) {
            console.log('⚠️ Service Worker 需要安全環境 (HTTPS)');
            return;
        }
        
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('✅ Service Worker 已註冊:', registration);
            })
            .catch(function(registrationError) {
                console.log('❌ Service Worker 註冊失敗:', registrationError);
                // 在開發環境中，SSL證書錯誤是正常的
                if (registrationError.name === 'SecurityError') {
                    console.log('💡 這可能是由於自簽證書導致的，在生產環境中使用有效證書可解決此問題');
                    // 在開發環境中不顯示錯誤給用戶
                    return;
                }
                // 其他類型的錯誤才顯示給用戶
                console.error('Service Worker 註冊遇到未知錯誤:', registrationError);
            });
    });
}

// PWA 安裝提示
let deferredPrompt;
const installPrompt = document.getElementById('installPrompt');

window.addEventListener('beforeinstallprompt', (e) => {
    // 阻止默認的安裝提示
    e.preventDefault();
    // 儲存事件，稍後使用
    deferredPrompt = e;
    // 顯示自定義安裝提示
    if (installPrompt) {
        installPrompt.style.display = 'block';
    }
});

function installPWA() {
    if (deferredPrompt) {
        // 顯示安裝提示
        deferredPrompt.prompt();
        // 等待用戶選擇
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the A2HS prompt');
            } else {
                console.log('User dismissed the A2HS prompt');
            }
            deferredPrompt = null;
            if (installPrompt) {
                installPrompt.style.display = 'none';
            }
        });
    }
}

// 檢測是否已經安裝
window.addEventListener('appinstalled', (evt) => {
    console.log('PWA was installed');
    if (installPrompt) {
        installPrompt.style.display = 'none';
    }
});
