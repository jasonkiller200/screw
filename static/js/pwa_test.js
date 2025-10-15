let deferredPrompt;
const checksDiv = document.getElementById('checks');
const detailsDiv = document.getElementById('details');
const installStatusDiv = document.getElementById('install-status');

// 捕獲安裝提示事件
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    addCheck('安裝提示事件', '✅ 已觸發 (PWA 可以安裝)', 'ok');
    updateDetails('beforeinstallprompt 事件已觸發！這表示 PWA 符合安裝條件。');
});

// 檢測是否已安裝
window.addEventListener('appinstalled', () => {
    addCheck('PWA 安裝', '✅ 已成功安裝', 'ok');
    updateDetails('PWA 已成功安裝到裝置！');
    deferredPrompt = null;
});

// 執行所有檢查
async function runAllChecks() {
    checksDiv.innerHTML = '<p>🔄 正在檢查...</p>';
    
    // 1. 檢查 HTTPS 或 localhost
    const isSecure = window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost' ||
                   window.location.hostname.startsWith('127.') ||
                   window.location.hostname.startsWith('192.168.');
    addCheck('安全連線', isSecure ? '✅ 使用安全連線' : '❌ 需要 HTTPS', isSecure ? 'ok' : 'error');

    // 2. 檢查 Service Worker
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                addCheck('Service Worker', `✅ 已註冊 (${registration.active ? '運行中' : '未啟動'})`, 'ok');
            } else {
                addCheck('Service Worker', '⚠️ 未註冊', 'warning');
            }
        } catch (err) {
            addCheck('Service Worker', `❌ 錯誤: ${err.message}`, 'error');
        }
    } else {
        addCheck('Service Worker', '❌ 瀏覽器不支援', 'error');
    }

    // 3. 檢查 Manifest
    try {
        const response = await fetch('/static/manifest.json');
        const manifest = await response.json();
        addCheck('Manifest', '✅ 已載入', 'ok');
        
        // 檢查必要欄位
        if (manifest.name) addCheck('- Name', `✅ ${manifest.name}`, 'ok');
        if (manifest.short_name) addCheck('- Short Name', `✅ ${manifest.short_name}`, 'ok');
        if (manifest.start_url) addCheck('- Start URL', `✅ ${manifest.start_url}`, 'ok');
        if (manifest.display) addCheck('- Display', `✅ ${manifest.display}`, 'ok');
        if (manifest.icons && manifest.icons.length > 0) {
            addCheck('- Icons', `✅ ${manifest.icons.length} 個圖示`, 'ok');
        } else {
            addCheck('- Icons', '❌ 缺少圖示', 'error');
        }
    } catch (err) {
        addCheck('Manifest', `❌ 載入失敗: ${err.message}`, 'error');
    }

    // 4. 檢查瀏覽器支援
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    
    let browserStatus = '';
    if (isChrome) browserStatus = '✅ Chrome (完整支援)';
    else if (isEdge) browserStatus = '✅ Edge (完整支援)';
    else if (isSafari) browserStatus = '⚠️ Safari (部分支援)';
    else browserStatus = '⚠️ 其他瀏覽器 (可能不支援)';
    
    addCheck('瀏覽器', browserStatus, isChrome || isEdge ? 'ok' : 'warning');

    // 5. 檢查是否已安裝
    if (window.matchMedia('(display-mode: standalone)').matches) {
        addCheck('安裝狀態', '✅ 已安裝 (以 PWA 模式運行)', 'ok');
    } else {
        addCheck('安裝狀態', '⚠️ 尚未安裝', 'warning');
    }

    // 6. 檢查是否有安裝提示
    if (deferredPrompt) {
        addCheck('安裝提示', '✅ 可以安裝', 'ok');
    } else {
        addCheck('安裝提示', '⚠️ 未觸發 (可能需要等待或使用手動安裝)', 'warning');
    }

    updateDetails(JSON.stringify({
        url: window.location.href,
        userAgent: navigator.userAgent,
        standalone: window.matchMedia('(display-mode: standalone)').matches,
        hasInstallPrompt: !!deferredPrompt
    }, null, 2));
}

function addCheck(name, message, status) {
    const div = document.createElement('div');
    div.className = 'test-item';
    div.innerHTML = `<strong>${name}:</strong> <span class="status ${status}">${message}</span>`;
    checksDiv.appendChild(div);
}

function updateDetails(text) {
    detailsDiv.textContent = text;
}

async function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        installStatusDiv.innerHTML = outcome === 'accepted' 
            ? '<p style="color: green;">✅ 使用者接受安裝</p>'
            : '<p style="color: orange;">⚠️ 使用者取消安裝</p>';
        deferredPrompt = null;
    } else {
        installStatusDiv.innerHTML = '
            <p style="color: orange;">⚠️ 無法自動安裝</p>
            <p>請嘗試以下方式：</p>
            <ul>
                <li>Chrome: 點擊網址列右側的 <strong>⊕</strong> 圖示</li>
                <li>或點擊選單 <strong>⋮</strong> → <strong>安裝應用程式</strong></li>
                <li>等待 5 分鐘後再次訪問網站</li>
            </ul>
        ';
    }
}

async function checkManifest() {
    try {
        const response = await fetch('/static/manifest.json');
        const manifest = await response.json();
        updateDetails('Manifest.json 內容:\n\n' + JSON.stringify(manifest, null, 2));
        installStatusDiv.innerHTML = '<p style="color: green;">✅ Manifest 載入成功</p>';
    } catch (err) {
        updateDetails('錯誤: ' + err.message);
        installStatusDiv.innerHTML = '<p style="color: red;">❌ Manifest 載入失敗</p>';
    }
}

async function checkServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                updateDetails('Service Worker 註冊資訊:\n\n' + JSON.stringify({
                    scope: registration.scope,
                    active: !!registration.active,
                    installing: !!registration.installing,
                    waiting: !!registration.waiting,
                    updateViaCache: registration.updateViaCache
                }, null, 2));
                installStatusDiv.innerHTML = '<p style="color: green;">✅ Service Worker 正常運行</p>';
            } else {
                updateDetails('Service Worker 未註冊');
                installStatusDiv.innerHTML = '<p style="color: orange;">⚠️ Service Worker 未註冊</p>';
            }
        } catch (err) {
            updateDetails('錯誤: ' + err.message);
            installStatusDiv.innerHTML = '<p style="color: red;">❌ Service Worker 檢查失敗</p>';
        }
    } else {
        updateDetails('瀏覽器不支援 Service Worker');
        installStatusDiv.innerHTML = '<p style="color: red;">❌ 瀏覽器不支援 Service Worker</p>';
    }
}

async function checkIcons() {
    const icons = [
        { path: '/static/icon-192.png', name: 'Icon 192x192' },
        { path: '/static/icon-512.png', name: 'Icon 512x512' },
        { path: '/static/favicon.ico', name: 'Favicon' }
    ];

    let html = '<h3>圖示檢查結果：</h3>';
    for (const icon of icons) {
        try {
            const response = await fetch(icon.path);
            if (response.ok) {
                html += `<p style="color: green;">✅ ${icon.name}: 載入成功</p>`;
                html += `<img src="${icon.path}" style="max-width: 100px; margin: 10px;" alt="${icon.name}">`;
            } else {
                html += `<p style="color: red;">❌ ${icon.name}: HTTP ${response.status}</p>`;
            }
        } catch (err) {
            html += `<p style="color: red;">❌ ${icon.name}: ${err.message}</p>`;
        }
    }
    installStatusDiv.innerHTML = html;
}

// 頁面載入時執行檢查
window.addEventListener('load', runAllChecks);
