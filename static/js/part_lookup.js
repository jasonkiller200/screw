

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 零件查詢頁面已載入');
    
    const searchForm = document.getElementById('searchForm');
    const partNumberInput = document.getElementById('partNumber');
    const autocompleteResults = document.getElementById('autocomplete-results');

    if (!searchForm || !partNumberInput || !autocompleteResults) {
        console.error('❌ 找不到必要的搜尋表單、輸入框或自動完成結果容器');
        return;
    }

    // 當使用者在輸入框中輸入時觸發
    partNumberInput.addEventListener('input', function() {
        const query = partNumberInput.value.trim();
        
        // 清除舊的詳細結果
        document.getElementById('results').style.display = 'none';
        document.getElementById('error').style.display = 'none';

        if (query.length < 1) {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
            return;
        }

        fetch(`/api/parts/autocomplete?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                autocompleteResults.innerHTML = '';
                if (data.length > 0) {
                    autocompleteResults.style.display = 'block';
                    data.forEach(part => {
                        const item = document.createElement('a');
                        item.href = '#';
                        item.classList.add('list-group-item', 'list-group-item-action');
                        item.innerHTML = `${part.part_number} <small class="text-muted">(${part.name})</small>`;
                        item.addEventListener('click', function(e) {
                            e.preventDefault();
                            partNumberInput.value = part.part_number;
                            autocompleteResults.innerHTML = '';
                            autocompleteResults.style.display = 'none';
                            searchPart(part.part_number); // 觸發詳細搜尋
                        });
                        autocompleteResults.appendChild(item);
                    });
                } else {
                    autocompleteResults.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('❌ 自動完成搜尋錯誤:', error);
                autocompleteResults.innerHTML = '';
                autocompleteResults.style.display = 'none';
            });
    });

    // 點擊頁面其他地方時隱藏建議列表
    document.addEventListener('click', function(e) {
        if (!partNumberInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
        }
    });

    // 保留原有的表單提交功能作為備用 (例如使用者按 Enter)
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const partNumber = partNumberInput.value.trim();
        autocompleteResults.innerHTML = '';
        autocompleteResults.style.display = 'none';
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
        const all_locations = part?.locations || [];

        if (all_locations.length > 0) {
            inventoryHtml = all_locations.map(loc => {
                // 從 inventories 陣列中尋找此位置的庫存記錄
                const inv = inventories.find(i => i.warehouse_id === loc.warehouse_id);

                const quantity_on_hand = inv ? inv.quantity_on_hand : 0;
                const reserved_quantity = inv ? inv.reserved_quantity : 0;
                const available_quantity = inv ? inv.available_quantity : 0;

                return `
                    <tr>
                        <td>${loc.warehouse_name} (${loc.warehouse_code})</td>
                        <td>${loc.location_code}</td>
                        <td>${quantity_on_hand}</td>
                        <td>${reserved_quantity}</td>
                        <td><strong>${available_quantity}</strong></td>
                    </tr>
                `;
            }).join('');
        } else {
            inventoryHtml = '<tr><td colspan="5" class="text-center text-muted">此零件未設定儲位</td></tr>';
        }
        
        results.innerHTML = `
            <div class="card mb-3">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">零件資訊</h5>
                    <div>
                        <button class="btn btn-success btn-sm" id="showWeeklyOrderModalBtn" 
                                data-part-number="${part?.part_number || ''}" 
                                data-part-name="${part?.name || ''}" 
                                data-part-unit="${part?.unit || ''}"
                                data-part-type="${part?.type || ''}"
                                data-part-locations='${JSON.stringify(part?.locations || [])}'>
                            <i class="fas fa-calendar-plus me-1"></i>加入申請
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

        // 為新的"加入申請"按鈕動態綁定事件
        const weeklyOrderBtn = document.getElementById('showWeeklyOrderModalBtn');
        if (weeklyOrderBtn) {
            weeklyOrderBtn.addEventListener('click', function() {
                const partNumber = this.dataset.partNumber;
                const partName = this.dataset.partName;
                const unit = this.dataset.partUnit;
                const type = this.dataset.partType;
                const locations = this.dataset.partLocations;
                addToWeeklyOrder(partNumber, partName, unit, type, locations);
            });
        }
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

    // 加入週期申請 (新版：使用獨立模態視窗)
    function addToWeeklyOrder(partNumber, partName, unit, partType, locationsString) {
        // 填充模態視窗中的零件資訊
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = unit;
        document.getElementById('weeklyOrderPartType').value = partType; // Store part type
        document.getElementById('weeklyOrderPartDisplay').textContent = `${partNumber} (${partName})`;

        // 清除舊的錯誤訊息並重設表單
        document.getElementById('weeklyOrderError').style.display = 'none';
        document.getElementById('weeklyOrderForm').reset();

        // 動態填充並處理儲位下拉選單
        const locationDropdown = document.getElementById('weeklyOrderLocation');
        locationDropdown.innerHTML = ''; // 清空現有選項
        locationDropdown.disabled = false; // 確保選單是啟用的

        try {
            const locations = JSON.parse(locationsString);
            
            // 加入預設選項
            locationDropdown.add(new Option('請選擇儲位...', ''));

            if (locations && locations.length > 0) {
                locations.forEach(loc => {
                    // 從 part.locations 來的資料沒有 .text 屬性，需要自己組合
                    const optionText = `${loc.warehouse_name} - ${loc.location_code}`;
                    locationDropdown.add(new Option(optionText, loc.id));
                });

                // 如果只有一個儲位，自動選取
                if (locations.length === 1) {
                    locationDropdown.value = locations[0].id;
                }
            } else {
                 // 如果沒有可用儲位，可以選擇禁用下拉選單或顯示提示
                 locationDropdown.options[0].textContent = '此零件未設定儲位';
                 locationDropdown.disabled = true;
            }

        } catch (e) {
            console.error("解析儲位資料失敗:", e);
            locationDropdown.innerHTML = '<option value="">讀取儲位失敗</option>';
            locationDropdown.disabled = true;
        }

        // 顯示模態視窗
        const weeklyOrderModal = new bootstrap.Modal(document.getElementById('weeklyOrderModal'));
        weeklyOrderModal.show();
    }

    // 提交週期訂單申請
    document.getElementById('submitWeeklyOrder').addEventListener('click', function() {
        const errorDiv = document.getElementById('weeklyOrderError');
        const submitButton = this;

        // 收集表單數據
        const data = {
            part_number: document.getElementById('weeklyOrderPartNumber').value,
            part_name: document.getElementById('weeklyOrderPartName').value,
            unit: document.getElementById('weeklyOrderUnit').value,
            category: document.getElementById('weeklyOrderPartType').value,
            quantity: document.getElementById('weeklyOrderQuantity').value,
            warehouse_location_id: document.getElementById('weeklyOrderLocation').value,
            applicant_name: document.getElementById('weeklyOrderApplicant').value,
            priority: document.getElementById('weeklyOrderPriority').value,
            required_date: document.getElementById('weeklyOrderRequiredDate').value,
            purpose_notes: document.getElementById('weeklyOrderNotes').value
        };

        // 前端驗證
        if (!data.quantity || !data.warehouse_location_id || !data.applicant_name || !data.required_date) {
            errorDiv.textContent = '標有 * 的欄位為必填項目。';
            errorDiv.style.display = 'block';
            return;
        }

        errorDiv.style.display = 'none';
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 正在提交...';

        fetch('/api/weekly-orders/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert(result.message || '申請成功！');
                const weeklyOrderModal = bootstrap.Modal.getInstance(document.getElementById('weeklyOrderModal'));
                if (weeklyOrderModal) {
                    weeklyOrderModal.hide();
                }
            } else {
                errorDiv.textContent = result.message || '發生未知錯誤';
                errorDiv.style.display = 'block';
            }
        })
        .catch(err => {
            errorDiv.textContent = '網路錯誤，請稍後再試。 ' + err.message;
            errorDiv.style.display = 'block';
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.innerHTML = '確認申請';
        });
    });
});
