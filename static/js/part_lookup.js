

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
        const summary = data.summary || null;  // 新增：整體摘要
        
        console.log('🔍 showResults 接收到的資料:', data);

        // 保存當前零件的儲位資訊
        currentPartLocations = part?.locations || [];
        
        // 輔助函數：訂單狀態 Badge
        function getOrderStatusBadge(status) {
            const statusMap = {
                'registered': 'bg-secondary',
                'approved': 'bg-primary',
                'partially_received': 'bg-info',
                'completed': 'bg-success',
                'rejected': 'bg-danger'
            };
            return statusMap[status] || 'bg-light';
        }
        
        // 輔助函數：訂單狀態文字
        function getOrderStatusText(status) {
            const statusMap = {
                'registered': '已登記',
                'approved': '已核准',
                'partially_received': '部分到貨',
                'completed': '已完成',
                'rejected': '已拒絕'
            };
            return statusMap[status] || status;
        }
        
        let html = `
            <div class="card mb-3">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0">零件資訊</h5>
                </div>
                <div class="card-body part-info">
                    <div class="row">
                        <div class="col-md-3">
                            <strong>零件編號:</strong> ${part.part_number}
                        </div>
                        <div class="col-md-3">
                            <strong>零件名稱:</strong> ${part.name}
                        </div>
                        <div class="col-md-2">
                            <strong>類型:</strong> ${part.type || '未分類'}
                        </div>
                        <div class="col-md-2">
                            <strong>單位:</strong> ${part.unit}
                        </div>
                        <div class="col-md-2">
                            <strong>前置期:</strong> ${part.lead_time} 天
                        </div>
                    </div>
                    ${part.description ? `
                        <div class="row mt-2">
                            <div class="col-12">
                                <strong>備註:</strong> ${part.description}
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="card-footer">
                    <button class="btn btn-success" id="showWeeklyOrderModalBtn" 
                            data-part-number="${part.part_number}" 
                            data-part-name="${part.name}" 
                            data-part-unit="${part.unit}"
                            data-part-type="${part.type || ''}"
                            data-part-locations='${JSON.stringify(part.locations || [])}'>
                        <i class="fas fa-calendar-plus me-1"></i>加入週期申請
                    </button>
                </div>
            </div>
            
            <!-- 訂單歷史 (移到這裡) -->
            <div class="card mb-3">
                <div class="card-header">
                    <h5 class="mb-0">📋 最近訂單歷史 <small class="text-muted">(最多顯示10筆)</small></h5>
                </div>
                <div class="card-body">
                    ${history.length > 0 ? `
                        <div class="table-responsive">
                            <table class="table table-sm table-hover">
                                <thead>
                                    <tr>
                                        <th>申請日期</th>
                                        <th>申請人</th>
                                        <th>數量</th>
                                        <th>儲位</th>
                                        <th>狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${history.map(order => {
                                        const date = new Date(order.created_at);
                                        const formattedDate = date.getFullYear() + '-' +
                                                              String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                                              String(date.getDate()).padStart(2, '0');
                                        
                                        return `
                                            <tr>
                                                <td>${formattedDate}</td>
                                                <td>${order.applicant_name || '未知'}</td>
                                                <td>${order.quantity || order.quantity_ordered || 0} ${part.unit}</td>
                                                <td>${order.location_display || order.location_code || '未指定'}</td>
                                                <td>
                                                    <span class="badge ${getOrderStatusBadge(order.status)}">
                                                        ${getOrderStatusText(order.status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p class="text-muted mb-0">暫無訂單記錄</p>'}
                </div>
            </div>
            
            <!-- 新增：整體消耗摘要卡片 -->
            ${summary ? `
                <div class="card mb-3">
                    <div class="card-header bg-info text-white d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">📊 整體消耗狀態</h5>
                        <small>基於近30天工作日數據</small>
                    </div>
                    <div class="card-body">
                        ${window.ConsumptionUtils ? window.ConsumptionUtils.renderOverallSummary(summary) : '<p>載入中...</p>'}
                    </div>
                </div>
            ` : ''}
            
            <div class="card mb-3">
                <div class="card-header">
                    <h5 class="mb-0">📦 各儲位詳細分析</h5>
                </div>
                <div class="card-body">
                    ${inventories.length > 0 ? 
                        inventories.map(inv => window.ConsumptionUtils ? window.ConsumptionUtils.renderLocationDetailCard(inv) : `
                            <div class="card mb-3">
                                <div class="card-body">
                                    <p>儲位: ${inv.location_code}</p>
                                    <p>現有庫存: ${inv.quantity_on_hand} ${inv.unit}</p>
                                </div>
                            </div>
                        `).join('') : 
                        '<p class="text-muted">無庫存資訊</p>'
                    }
                </div>
            </div>
        `;
        
        results.innerHTML = html;
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
        
        // 重新設定預設值（因為 reset() 會清除所有值）
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = unit;
        document.getElementById('weeklyOrderPartType').value = partType;
        document.getElementById('weeklyOrderPartDisplay').textContent = `${partNumber} (${partName})`;

        // 動態填充並處理儲位下拉選單
        const locationDropdown = document.getElementById('weeklyOrderLocation');
        const locationStar = document.getElementById('modal-location-required-star');
        const notesField = document.getElementById('weeklyOrderNotes');
        const notesStar = document.getElementById('notes-required-star');
        locationDropdown.innerHTML = ''; // 清空現有選項

        // 儲位變更事件處理器
        function handleLocationChange() {
            const selectedValue = locationDropdown.value;
            if (selectedValue === '' && locationDropdown.disabled) {
                // 無指定儲位 - 備註變為必填
                notesField.required = true;
                notesStar.style.display = 'inline';
            } else {
                // 有指定儲位 - 備註非必填
                notesField.required = false;
                notesStar.style.display = 'none';
            }
        }

        try {
            const locations = JSON.parse(locationsString);
            
            if (locations && locations.length > 0) {
                // Part has locations
                locationDropdown.disabled = false;
                locationDropdown.required = true;
                locationStar.style.display = 'inline';
                
                locationDropdown.add(new Option('請選擇儲位...', ''));
                locations.forEach(loc => {
                    const optionText = `${loc.warehouse_name} - ${loc.location_code}`;
                    locationDropdown.add(new Option(optionText, loc.id));
                });

                // 如果只有一個儲位，自動選取
                if (locations.length === 1) {
                    locationDropdown.value = locations[0].id;
                }
                
                // 備註非必填
                notesField.required = false;
                notesStar.style.display = 'none';
            } else {
                // Part has no locations
                locationDropdown.disabled = true;
                locationDropdown.required = false;
                locationStar.style.display = 'none';
                
                const option = new Option('無指定儲位', '');
                locationDropdown.add(option);
                locationDropdown.value = '';
                
                // 備註變為必填
                notesField.required = true;
                notesStar.style.display = 'inline';
            }
            
            // 綁定儲位變更事件
            locationDropdown.addEventListener('change', handleLocationChange);

        } catch (e) {
            console.error("解析儲位資料失敗:", e);
            locationDropdown.innerHTML = '<option value="">讀取儲位失敗</option>';
            locationDropdown.disabled = true;
            locationStar.style.display = 'none';
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
            department: document.getElementById('weeklyOrderDepartment').value,
            priority: document.getElementById('weeklyOrderPriority').value,
            required_date: document.getElementById('weeklyOrderRequiredDate').value,
            purpose_notes: document.getElementById('weeklyOrderNotes').value
        };

        // 前端驗證
        const locationDropdown = document.getElementById('weeklyOrderLocation');
        const notesField = document.getElementById('weeklyOrderNotes');
        
        // 基本必填欄位驗證
        if (!data.quantity || !data.applicant_name || !data.required_date) {
            errorDiv.textContent = '標有 * 的欄位為必填項目。';
            errorDiv.style.display = 'block';
            return;
        }
        
        // 儲位必填驗證
        if (locationDropdown.required && !data.warehouse_location_id) {
            errorDiv.textContent = '請選擇目標儲位。';
            errorDiv.style.display = 'block';
            return;
        }
        
        // 備註必填驗證（當無指定儲位時）
        if (notesField.required && !data.purpose_notes.trim()) {
            errorDiv.textContent = '無指定儲位時，用途/備註為必填項目。';
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
