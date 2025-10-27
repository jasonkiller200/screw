

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 零件查詢頁面已載入');
    
    // 搜尋功能
    const searchForm = document.getElementById('searchForm');
    if (!searchForm) {
        console.error('❌ 找不到 searchForm 元素');
        return;
    }
    
    console.log('✅ 找到 searchForm，綁定事件監聽器');
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('📝 表單提交事件觸發');
        const partNumber = document.getElementById('partNumber').value.trim();
        console.log('🔍 查詢零件編號:', partNumber);
        if (partNumber) {
            searchPart(partNumber);
        } else {
            console.warn('⚠️ 零件編號為空');
        }
    });

    // 條碼掃描功能
    let codeReader = null;
    let controls = null;
    let currentCameraIndex = 0; // 追蹤當前使用的相機索引
    let videoInputDevices = []; // 存儲所有可用的相機設備

    document.getElementById('toggleScanner').addEventListener('click', function() {
        startScanner();
    });

    document.getElementById('stopScanner').addEventListener('click', function() {
        stopScanner();
    });

    // 切換相機功能
    document.getElementById('switchCamera').addEventListener('click', function() {
        switchCamera();
    });

    async function switchCamera() {
        if (videoInputDevices.length <= 1) {
            alert('只找到一個相機設備，無法切換');
            return;
        }

        // 切換到下一個相機
        currentCameraIndex = (currentCameraIndex + 1) % videoInputDevices.length;
        
        // 停止當前掃描
        if (controls) {
            controls.stop();
            controls = null;
        }

        // 使用新的相機重新開始掃描
        const selectedDeviceId = videoInputDevices[currentCameraIndex].deviceId;
        const selectedDeviceLabel = videoInputDevices[currentCameraIndex].label || `相機 ${currentCameraIndex + 1}`;
        
        const status = document.getElementById('scanner-status');
        status.textContent = `正在切換到: ${selectedDeviceLabel}`;
        status.className = 'alert alert-info mt-2';

        try {
            // 使用新的相機設備開始掃描
            controls = await codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', (result, err) => {
                if (result) {
                    console.log('✅ 掃描成功!', result.text);
                    status.textContent = `✅ 掃描成功！條碼: ${result.text} (使用: ${selectedDeviceLabel})`;
                    status.className = 'alert alert-success mt-2';
                    document.getElementById('partNumber').value = result.text;

                    if (navigator.vibrate) {
                        navigator.vibrate([200, 100, 200]);
                    }
                    
                    // 停止掃描並搜尋
                    stopScanner();
                    searchPart(result.text);
                }

                if (err) {
                    // Ignore common, non-fatal errors that happen during scanning
                    const ignoredErrors = ['NotFoundException', 'ChecksumException', 'FormatException'];
                    if (!ignoredErrors.includes(err.name)) {
                        console.error('掃描錯誤:', err);
                        status.textContent = `❌ 掃描出錯: ${err.message}`;
                        status.className = 'alert alert-danger mt-2';
                    }
                }
            });

            status.textContent = `✅ 已切換到: ${selectedDeviceLabel}`;
            status.className = 'alert alert-success mt-2';
            
            // 更新按鈕狀態
            const switchButton = document.getElementById('switchCamera');
            switchButton.innerHTML = `<i class="fas fa-sync-alt me-1"></i>切換相機 (${currentCameraIndex + 1}/${videoInputDevices.length})`;
            
        } catch (err) {
            console.error('切換相機失敗:', err);
            status.textContent = `❌ 切換失敗: ${err.message}`;
            status.className = 'alert alert-danger mt-2';
        }
    }

    async function startScanner() {
        const container = document.getElementById('scanner-container');
        const video = document.getElementById('scanner-video');
        const status = document.getElementById('scanner-status');

        try {
            container.style.display = 'block';
            status.style.display = 'block';
            status.textContent = '正在準備相機...';
            status.className = 'alert alert-info mt-2';

            if (!codeReader) {
                codeReader = new ZXingBrowser.BrowserMultiFormatReader();
                console.log('ZXing Browser scanner initialized');
            }

            // 查找所有可用的視訊輸入設備
            videoInputDevices = await ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
            if (videoInputDevices.length < 1) {
                throw new Error("找不到相機裝置。");
            }

            console.log('發現的相機設備:', videoInputDevices.map(device => ({
                id: device.deviceId,
                label: device.label
            })));

            // 優先選擇後置相機（環境相機）
            let selectedDeviceIndex = 0;
            
            // 首先嘗試使用 facingMode 信息（如果可用）
            const backCameraByFacing = videoInputDevices.findIndex(device => {
                // 某些瀏覽器可能在 capabilities 中提供 facingMode 信息
                return device.getCapabilities && 
                       device.getCapabilities().facingMode && 
                       device.getCapabilities().facingMode.includes('environment');
            });
            
            // 其次通過標籤名稱搜索後置相機
            const backCameraByLabel = videoInputDevices.findIndex(device => {
                const label = device.label.toLowerCase();
                return label.includes('back') || 
                       label.includes('rear') || 
                       label.includes('environment') ||
                       label.includes('後') ||
                       label.includes('环境') ||
                       label.includes('facing back') ||
                       label.includes('camera 1') || // 某些設備後置相機標為camera 1
                       (label.includes('camera') && label.includes('0')); // 某些設備後置相機為camera 0
            });
            
            if (backCameraByFacing !== -1) {
                selectedDeviceIndex = backCameraByFacing;
                currentCameraIndex = backCameraByFacing;
                console.log('通過 facingMode 找到後置相機:', videoInputDevices[selectedDeviceIndex].label);
            } else if (backCameraByLabel !== -1) {
                selectedDeviceIndex = backCameraByLabel;
                currentCameraIndex = backCameraByLabel;
                console.log('通過標籤找到後置相機:', videoInputDevices[selectedDeviceIndex].label);
            } else if (videoInputDevices.length > 1) {
                // 如果有多個相機但找不到明確的後置相機，優先選擇第二個（通常是後置）
                selectedDeviceIndex = 1;
                currentCameraIndex = 1;
                console.log('多個相機設備，優先使用第二個:', videoInputDevices[1].label);
            } else {
                // 如果只有一個相機，使用第一個設備
                currentCameraIndex = 0;
                console.log('只有一個相機設備，使用:', videoInputDevices[0].label);
            }

            const selectedDeviceId = videoInputDevices[selectedDeviceIndex].deviceId;
            const selectedDeviceLabel = videoInputDevices[selectedDeviceIndex].label || `相機 ${selectedDeviceIndex + 1}`;
            
            // 更新狀態顯示可用相機數量
            const cameraInfo = videoInputDevices.length > 1 ? 
                ` (${videoInputDevices.length} 個相機可用)` : 
                ' (僅1個相機)';
                
            // 更新切換按鈕狀態
            const switchButton = document.getElementById('switchCamera');
            if (videoInputDevices.length > 1) {
                switchButton.disabled = false;
                switchButton.innerHTML = `<i class="fas fa-sync-alt me-1"></i>切換相機 (${currentCameraIndex + 1}/${videoInputDevices.length})`;
            } else {
                switchButton.disabled = true;
                switchButton.innerHTML = `<i class="fas fa-sync-alt me-1"></i>僅1個相機`;
            }
                
            status.textContent = `✅ 相機已就緒：${selectedDeviceLabel}${cameraInfo}`;
            status.className = 'alert alert-success mt-2';
            console.log(`Started continuous decode from camera with id ${selectedDeviceId}`);

            // 使用 decodeFromVideoDevice 進行連續掃描
            controls = await codeReader.decodeFromVideoDevice(selectedDeviceId, 'scanner-video', (result, err) => {
                if (result) {
                    console.log('✅ 掃描成功!', result.text);
                    status.textContent = `✅ 掃描成功！條碼: ${result.text}`;
                    status.className = 'alert alert-success mt-2';
                    document.getElementById('partNumber').value = result.text;

                    if (navigator.vibrate) {
                        navigator.vibrate([200, 100, 200]);
                    }
                    
                    // 停止掃描並搜尋
                    stopScanner();
                    searchPart(result.text);
                }

                if (err) {
                    // Ignore common, non-fatal errors that happen during scanning
                    const ignoredErrors = ['NotFoundException', 'ChecksumException', 'FormatException'];
                    if (!ignoredErrors.includes(err.name)) {
                        console.error('掃描錯誤:', err);
                        status.textContent = `❌ 掃描出錯: ${err.message}`;
                        status.className = 'alert alert-danger mt-2';
                    }
                }
            });

        } catch (err) {
            console.error('啟動掃描器失敗:', err);
            status.textContent = `❌ 啟動失敗: ${err.message}`;
            status.className = 'alert alert-danger mt-2';
        }
    }

    function stopScanner() {
        if (controls) {
            controls.stop();
            controls = null;
            codeReader = null; // 重置 codeReader
            console.log('✅ 掃描器已關閉');
        }
        const container = document.getElementById('scanner-container');
        if (container) {
            container.style.display = 'none';
        }
        
        // 重置按鈕狀態
        const switchButton = document.getElementById('switchCamera');
        switchButton.innerHTML = `<i class="fas fa-sync-alt me-1"></i>切換相機`;
        switchButton.disabled = false;
    }

    // 搜尋零件
    function searchPart(partNumber) {
        console.log('🔍 開始搜尋零件:', partNumber);
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');
        const error = document.getElementById('error');
        
        results.style.display = 'none';
        error.style.display = 'none';
        loading.style.display = 'block';
        
        const apiUrl = `/api/part/${encodeURIComponent(partNumber)}`;
        console.log('📡 API 請求 URL:', apiUrl);
        
        fetch(apiUrl)
            .then(response => {
                console.log('📥 收到回應，狀態碼:', response.status);
                return response.json();
            })
            .then(data => {
                console.log('✅ API 回應資料:', data);
                loading.style.display = 'none';
                if (data.error) {
                    showError(data.error);
                } else {
                    showResults(data);
                }
            })
            .catch(err => {
                console.error('❌ API 請求錯誤:', err);
                loading.style.display = 'none';
                showError('網路錯誤：' + err.message);
            });
    }

    function showResults(data) {
        const results = document.getElementById('results');
        const part = data.part_info;
        const history = data.order_history;
        const inventories = data.inventories || [];
        
        console.log('🔍 showResults 接收到的 part 物件:', part); // 添加這行來診斷

        // 保存當前零件的儲位資訊
        currentPartLocations = part?.locations || []; // 使用可選鏈接

        let historyHtml = '';
        if (history.length > 0) {
            historyHtml = history.map(order => {
                const date = new Date(order.order_date);
                const formattedDate = date.getFullYear() + '-' +
                                      String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                      String(date.getDate()).padStart(2, '0') + ' ' +
                                      String(date.getHours()).padStart(2, '0') + ':' +
                                      String(date.getMinutes()).padStart(2, '0');
                return `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${order.quantity_ordered}</td>
                        <td>
                            <span class="badge bg-${order.status === 'confirmed' ? 'success' : 'warning'}">
                                ${order.status === 'confirmed' ? '已確認' : '待處理'}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            historyHtml = '<tr><td colspan="3" class="text-center text-muted">暫無訂購記錄</td></tr>';
        }
        
        // 顯示各倉庫庫存（包含倉位信息）
        let inventoryHtml = '';
        if (inventories.length > 0) {
            inventoryHtml = inventories.map(inv => {
                // 找出該倉庫的倉位
                const warehouseLocations = part?.locations ? // 使用可選鏈接
                    part.locations.filter(loc => loc.warehouse_id === inv.warehouse_id) : [];
                const locationStr = warehouseLocations.length > 0 ? 
                    warehouseLocations.map(loc => loc.location_code).join(', ') : 
                    '<span class="text-muted">未設定</span>';
                
                return `
                    <tr>
                        <td>${inv.warehouse_name} (${inv.warehouse_code})</td>
                        <td>${locationStr}</td>
                        <td>${inv.quantity_on_hand || 0}</td>
                        <td>${inv.reserved_quantity || 0}</td>
                        <td><strong>${inv.available_quantity || 0}</strong></td>
                    </tr>
                `;
            }).join('');
        } else {
            inventoryHtml = '<tr><td colspan="5" class="text-center text-muted">暫無庫存資訊</td></tr>';
        }
        
        results.innerHTML = `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">零件資訊</h5>
                    <div>
                        <button class="btn btn-success btn-sm" onclick="addToWeeklyOrder('${part?.part_number || ''}', '${part?.name || ''}', '${part?.unit || ''}')">
                            <i class="fas fa-calendar-plus me-1"></i>加入週期申請
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="part-info p-3 rounded mb-3">
                                <h6><strong>零件編號：</strong>${part?.part_number || 'N/A'}</h6>
                                <p class="mb-2"><strong>名稱：：</strong>${part?.name || 'N/A'}</p>
                                <p class="mb-2"><strong>備註：</strong>${part?.description || '無'}</p>
                                <p class="mb-2"><strong>單位：</strong>${part?.unit || 'N/A'}</p>
                                <p class="mb-2"><strong>每盒數量：：</strong>${part?.quantity_per_box || 'N/A'}</p>
                                <p class="mb-2"><strong>採購前置期：</strong>${part?.lead_time || 'N/A'} 天</p>
                                <p class="mb-0"><strong>儲存位置：</strong>
                                    ${part?.locations && part.locations.length > 0 ? 
                                        part.locations.map(loc => `${loc.warehouse_name}:${loc.location_code}`).join(', ') : 
                                        '無'}
                                </p>
                            </div>
                            
                            <h6>各倉庫庫存</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-striped">
                                    <thead>
                                        <tr>
                                            <th>倉庫</th>
                                            <th>倉位</th>
                                            <th>在庫數量</th>
                                            <th>預留數量</th>
                                            <th>可用數量</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${inventoryHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <h6>訂購歷史</h6>
                            <div class="order-history">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>訂購日期</th>
                                            <th>數量</th>
                                            <th>狀態</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${historyHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        results.style.display = 'block';
    }

    function showError(message) {
        const error = document.getElementById('error');
        document.getElementById('error-message').textContent = message;
        error.style.display = 'block';
    }

    // 訂單模態框功能 - submitOrder 按鈕事件
    document.getElementById('submitOrder').addEventListener('click', function() {
        const partNumber = document.getElementById('orderPartNumber').value;
        const quantity = document.getElementById('orderQuantity').value;
        const locationCode = document.getElementById('orderLocation').value;
        
        if (!quantity || quantity < 1) {
            alert('請輸入有效的數量');
            return;
        }
        
        if (!locationCode) {
            alert('請選擇目標儲位');
            return;
        }
        
        fetch('/api/order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                part_number: partNumber,
                quantity_ordered: parseInt(quantity),
                location_code: locationCode
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('訂單建立成功！');
                bootstrap.Modal.getInstance(document.getElementById('orderModal')).hide();
                searchPart(partNumber);
            } else {
                alert('訂單建立失敗：' + data.error);
            }
        })
        .catch(err => {
            alert('網路錯誤：' + err.message);
        });
    });
});

// 加入週期申請
function addToWeeklyOrder(partNumber, partName, unit) {
    // 顯示優先級選擇彈窗
    const modalHtml = `
        <div class="modal fade" id="priorityModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">選擇申請類型</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>零件：<strong>${partName}</strong> (${partNumber})</p>
                        <div class="mb-3">
                            <label class="form-label">申請類型</label>
                            <select class="form-select" id="prioritySelect">
                                <option value="normal">一般申請</option>
                                <option value="urgent">緊急申請</option>
                            </select>
                            <div class="form-text">緊急申請將優先處理</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" onclick="confirmAddToWeeklyOrder('${partNumber}', '${partName}', '${unit}')">確認加入</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除現有的模態框（如果存在）
    const existingModal = document.getElementById('priorityModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 添加模態框到頁面
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 顯示模態框
    const modal = new bootstrap.Modal(document.getElementById('priorityModal'));
    modal.show();
}

// 確認加入週期申請
function confirmAddToWeeklyOrder(partNumber, partName, unit) {
    const priority = document.getElementById('prioritySelect').value;
    
    // 跳轉到週期申請頁面，並預填資料
    const params = new URLSearchParams({
        part_number: partNumber,
        part_name: partName,
        unit: unit,
        quantity: '1',
        material_nature: '採購品',
        priority: priority,
        source: 'lookup'
    });
    
    window.location.href = `/weekly-orders/register?${params.toString()}`;
}
