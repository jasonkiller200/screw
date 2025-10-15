let deferredPrompt;
const statusDiv = document.getElementById('status');
const checksDiv = document.getElementById('checks');

// 捕獲安裝提示
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    statusDiv.innerHTML = '<div class="status success">✅ 可以安裝！點擊上方按鈕開始安裝。</div>';
});

// 安裝完成
window.addEventListener('appinstalled', () => {
    statusDiv.innerHTML = '<div class="status success">🎉 安裝成功！請查看您的主畫面。</div>';
    deferredPrompt = null;
});

// 安裝函數
async function installApp() {
    if (!deferredPrompt) {
        statusDiv.innerHTML = `
            <div class="status warning">
                <p>⚠️ 無法自動安裝</p>
                <p><strong>請手動安裝：</strong></p>
                <p>1. 點擊瀏覽器選單 ⋮</p>
                <p>2. 選擇「安裝應用程式」</p>
                <p>或</p>
                <p>等待 5 分鐘後再次訪問網站</p>
            </div>
        `;
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        statusDiv.innerHTML = '<div class="status success">✅ 正在安裝...</div>';
    } else {
        statusDiv.innerHTML = '<div class="status warning">⚠️ 您取消了安裝</div>';
    }
    
    deferredPrompt = null;
}

// 檢查狀態
window.addEventListener('load', async () => {
    let html = '';

    // Service Worker
    if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.active) {
            html += '<p>✅ Service Worker: 運行中</p>';
        } else {
            html += '<p>⚠️ Service Worker: 未運行</p>';
        }
    }

    // 已安裝檢查
    if (window.matchMedia('(display-mode: standalone)').matches) {
        html += '<p>✅ 狀態: 已安裝 (PWA 模式)</p>';
        statusDiv.innerHTML = '<div class="status success">🎉 應用程式已安裝！</div>';
    } else {
        html += '<p>⚠️ 狀態: 尚未安裝</p>';
    }

    // Manifest
    try {
        const response = await fetch('/static/manifest.json');
        if (response.ok) {
            html += '<p>✅ Manifest: 已載入</p>';
        }
    } catch (e) {
        html += '<p>❌ Manifest: 載入失敗</p>';
    }

    checksDiv.innerHTML = html;
});
