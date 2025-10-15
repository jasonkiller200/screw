// 註冊 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('✅ Service Worker 已註冊:', registration);
            })
            .catch(function(registrationError) {
                console.log('❌ Service Worker 註冊失敗:', registrationError);
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
