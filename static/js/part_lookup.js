

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
    partNumberInput.addEventListener('input', function () {
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
                        item.addEventListener('click', function (e) {
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
    document.addEventListener('click', function (e) {
        if (!partNumberInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
            autocompleteResults.innerHTML = '';
            autocompleteResults.style.display = 'none';
        }
    });

    // 保留原有的表單提交功能作為備用 (例如使用者按 Enter)
    searchForm.addEventListener('submit', function (e) {
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

    // 條碼掃描與搜尋資料
    let codeReader = null;
    let controls = null;
    let currentCameraIndex = 0; // 追蹤當前使用的相機索引
    let videoInputDevices = []; // 存儲所有可用的相機設備
    let currentPartLocations = [];
    let currentSearchData = null; // 保存當前搜尋到的完整資料

    document.getElementById('toggleScanner').addEventListener('click', function () {
        startScanner();
    });

    document.getElementById('stopScanner').addEventListener('click', function () {
        stopScanner();
    });

    // 切換相機功能
    document.getElementById('switchCamera').addEventListener('click', function () {
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

    // 顯示搜尋結果
    function showResults(data) {
        const results = document.getElementById('results');
        const part = data.part_info;
        const history = data.order_history;
        const inventories = data.inventories || [];
        const summary = data.summary || null;

        console.log('🔍 showResults 接收到的資料:', data);

        // 保存資料供模態視窗使用
        currentSearchData = data;
        currentPartLocations = part?.locations || [];

        if (!part) {
            results.innerHTML = '<div class="alert alert-warning">找不到零件資訊</div>';
            results.style.display = 'block';
            return;
        }

        let html = `
            <!-- 簡易零件資訊 (表頭風格) -->
            <div class="card mb-3 border-0 shadow-sm">
                <div class="card-body p-3 bg-light rounded shadow-sm">
                    <div class="row align-items-center">
                        <div class="col-md-5">
                            <div class="d-flex align-items-center mb-1">
                                <span class="badge bg-secondary me-2">PN</span>
                                <h4 class="mb-0 fw-bold text-dark text-break">${part.part_number}</h4>
                            </div>
                            <h5 class="text-muted mb-0 fw-normal">${part.name}</h5>
                        </div>
                        <div class="col-md-7 text-md-end mt-2 mt-md-0">
                            <div class="d-inline-block align-middle me-2">
                                <span class="badge bg-outline-secondary text-secondary border border-secondary p-1">
                                    單位: ${part.unit} | 類型: ${part.type || 'N/A'}
                                </span>
                            </div>
                            <button class="btn btn-success btn-sm px-3 shadow-sm align-middle js-add-to-weekly-order" 
                                    data-part-number="${part.part_number}"
                                    data-part-name="${part.name}"
                                    data-unit="${part.unit}"
                                    data-part-type="${part.type || ''}"
                                    data-locations='${JSON.stringify(part.locations || [])}'>
                                <i class="fas fa-plus-circle me-1"></i> 加入週期申請
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            ${summary ? window.ConsumptionUtils.renderOverallSummary(summary) : ''}

            <div class="row">
                <div class="col-lg-12 mb-3">
                    <div class="card border-0 shadow-sm">
                        <div class="card-header bg-white d-flex justify-content-between align-items-center border-bottom-0 pt-3 px-3">
                            <h5 class="mb-0 fw-bold"><i class="fas fa-warehouse me-2 text-primary"></i>各儲位摘要</h5>
                            <button class="btn btn-sm btn-primary js-show-all-details">
                                <i class="fas fa-eye me-1"></i> 查看所有詳情
                            </button>
                        </div>
                        <div class="card-body p-3">
                            <div class="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                                ${inventories.length > 0 ?
                inventories.map(inv => window.ConsumptionUtils.renderLocationSummaryRow(inv)).join('') :
                '<div class="col-12 p-3 text-muted text-center">無庫存資訊</div>'
            }
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 最近 10 筆訂單歷史 (全儲位) -->
            <div class="card border-0 shadow-sm mb-4">
                <div class="card-header bg-white pt-3 px-3">
                    <h5 class="mb-0 fw-bold"><i class="fas fa-history me-2 text-info"></i>最近 10 筆訂單歷史 (全儲位)</h5>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-light text-muted" style="font-size: 0.85rem;">
                                <tr>
                                    <th>日期</th>
                                    <th>儲位</th>
                                    <th>數量</th>
                                    <th class="d-none d-md-table-cell">申請人</th>
                                    <th>狀態</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 0.9rem;">
                                ${history.length > 0 ?
                history.map(h => `
                                        <tr>
                                            <td>${new Date(h.created_at).toLocaleDateString()}</td>
                                            <td>${h.location_display || 'N/A'}</td>
                                            <td>${h.quantity} ${h.unit}</td>
                                            <td class="d-none d-md-table-cell">${h.applicant_name}</td>
                                            <td><span class="badge ${getOrderStatusBadge(h.status)}">${getOrderStatusText(h.status)}</span></td>
                                        </tr>
                                    `).join('') :
                '<tr><td colspan="5" class="text-center py-4 text-muted">暫無訂單紀錄</td></tr>'
            }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="mb-5"></div>
        `;

        results.innerHTML = html;
        results.style.display = 'block';
    }

    // Delegated event listener for dynamically generated buttons
    document.getElementById('results').addEventListener('click', function(event) {
        const target = event.target.closest('.js-add-to-weekly-order');
        if (target) {
            const {
                partNumber,
                partName,
                unit,
                partType,
                locations
            } = target.dataset;
            // The locations are stored as a JSON string, so we pass it directly
            addToWeeklyOrder(partNumber, partName, unit, partType, locations);
            return;
        }

        const showDetailTarget = event.target.closest('.js-show-location-detail');
        if (showDetailTarget) {
            const { locationId } = showDetailTarget.dataset;
            showLocationDetail(locationId);
            return;
        }
        
        const showAllDetailsTarget = event.target.closest('.js-show-all-details');
        if (showAllDetailsTarget) {
            showAllDetails();
            return;
        }

        const openModalFromDetail = event.target.closest('.js-add-to-weekly-order-detail');
        if (openModalFromDetail) {
             const {
                 partNumber,
                 partName,
                 unit,
                 partType,
                 locations,
                 locationId,
                 suggestedQuantity
             } = openModalFromDetail.dataset;
             addToWeeklyOrder(partNumber, partName, unit, partType, locations, locationId, suggestedQuantity);
             return;
        }
    });

    // Delegated event listener for buttons inside the consumption detail modal
    document.getElementById('consumptionDetailModal').addEventListener('click', function(event) {
        const openModalFromDetail = event.target.closest('.js-add-to-weekly-order-detail');
        if (openModalFromDetail) {
            // Hide the current modal before opening a new one
            const detailModal = bootstrap.Modal.getInstance(document.getElementById('consumptionDetailModal'));
            if (detailModal) {
                detailModal.hide();
            }

            const {
                partNumber,
                partName,
                unit,
                partType,
                locations,
                locationId,
                suggestedQuantity
            } = openModalFromDetail.dataset;
            addToWeeklyOrder(partNumber, partName, unit, partType, locations, locationId, suggestedQuantity);
            return;
        }

        // Handle location row clicks in the inventory distribution table
        const locationRow = event.target.closest('.js-location-row-click');
        if (locationRow) {
            const { locationId } = locationRow.dataset;
            if (locationId) {
                showLocationDetail(locationId);
            }
            return;
        }
    });

    /**
     * 顯示單一儲位詳情
     * @param {string} locationId - 儲位 ID 
     */
    function showLocationDetail(locationId) {
        if (!currentSearchData || !currentSearchData.inventories) return;

        const inv = currentSearchData.inventories.find(i => i.warehouse_location_id == locationId);
        if (!inv) return;

        const content = document.getElementById('consumptionDetailContent');
        const label = document.getElementById('consumptionDetailModalLabel');
        const modalElement = document.getElementById('consumptionDetailModal');

        const summaryRow = `
            <div class="row mb-4 g-3">
                <div class="col-md-5">
                    ${window.ConsumptionUtils.renderPartBasicInfoCard(currentSearchData.part_info)}
                </div>
                <div class="col-md-7">
                    ${window.ConsumptionUtils.renderInventorySummaryTable(currentSearchData.inventories)}
                </div>
            </div>
            <hr class="my-4 border-2 opacity-25">
        `;

        label.innerHTML = `<i class="fas fa-map-marker-alt me-2 text-danger"></i>儲位詳情: ${inv.location_code}`;
        content.innerHTML = summaryRow + window.ConsumptionUtils.renderLocationDetailCard(inv, currentSearchData.part_info.locations);

        // 重用或創建 modal 實例
        let modal = bootstrap.Modal.getInstance(modalElement);
        if (!modal) {
            modal = new bootstrap.Modal(modalElement);
        }
        modal.show();
    }

    /**
     * 顯示所有儲位詳情
     */
    function showAllDetails() {
        if (!currentSearchData || !currentSearchData.inventories || currentSearchData.inventories.length === 0) return;

        const content = document.getElementById('consumptionDetailContent');
        const label = document.getElementById('consumptionDetailModalLabel');
        const modalElement = document.getElementById('consumptionDetailModal');

        const summaryRow = `
            <div class="row mb-4 g-3">
                <div class="col-md-5">
                    ${window.ConsumptionUtils.renderPartBasicInfoCard(currentSearchData.part_info)}
                </div>
                <div class="col-md-7">
                    ${window.ConsumptionUtils.renderInventorySummaryTable(currentSearchData.inventories)}
                </div>
            </div>
            <hr class="my-4 border-2 opacity-25">
            <h5 class="fw-bold mb-4"><i class="fas fa-list me-2"></i> 詳細分析清單</h5>
        `;

        label.innerHTML = `<i class="fas fa-chart-pie me-2 text-primary"></i>所有儲位詳細分析 (${currentSearchData.part_info.part_number})`;
        content.innerHTML = summaryRow + currentSearchData.inventories.map(inv => window.ConsumptionUtils.renderLocationDetailCard(inv, currentSearchData.part_info.locations)).join('<hr class="my-5 border-2 opacity-50">');

        // 重用或創建 modal 實例
        let modal = bootstrap.Modal.getInstance(modalElement);
        if (!modal) {
            modal = new bootstrap.Modal(modalElement);
        }
        modal.show();
    }

    // 獲取訂單狀態文字
    function getOrderStatusText(status) {
        const statuses = {
            'registered': '已登記',
            'approved': '核準中',
            'partially_received': '部份入庫',
            'completed': '已完成',
            'rejected': '已拒絕',
            'ordered': '已下單'
        };
        return statuses[status] || status;
    }

    // 獲取訂單狀態 Badge Class
    function getOrderStatusBadge(status) {
        const classes = {
            'registered': 'bg-info',
            'approved': 'bg-warning',
            'partially_received': 'bg-primary',
            'completed': 'bg-success',
            'rejected': 'bg-danger',
            'ordered': 'bg-info'
        };
        return classes[status] || 'bg-secondary';
    }

    function showError(message) {
        const error = document.getElementById('error');
        document.getElementById('error-message').textContent = message;
        error.style.display = 'block';
    }



    // 加入週期申請 (新版：使用獨立模態視窗)
    function addToWeeklyOrder(partNumber, partName, unit, partType, locationsString, preSelectedLocationId = null, suggestedQuantity = null) {
        // 填充模態視窗中的零件資訊
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = unit;
        document.getElementById('weeklyOrderPartType').value = partType; // Store part type
        document.getElementById('weeklyOrderPartDisplay').textContent = `${partNumber} (${partName})`;

        // 清除舊的錯誤訊息並重設表單
        document.getElementById('weeklyOrderError').style.display = 'none';
        document.getElementById('weeklyOrderForm').reset();

        // 重新設定零件資訊（reset() 會清除所有值）
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = unit || 'pcs';
        document.getElementById('weeklyOrderPartType').value = partType || 'N/A';
        document.getElementById('weeklyOrderPartDisplay').textContent = `${partNumber} (${partName})`;

        // 如果有建議訂購量，自動填入
        if (suggestedQuantity && suggestedQuantity > 0) {
            document.getElementById('weeklyOrderQuantity').value = suggestedQuantity;
        }

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
                    const option = new Option(optionText, loc.id);
                    locationDropdown.add(option);

                    // 如果有預選儲位，在此處標記
                    if (preSelectedLocationId && String(loc.id) === String(preSelectedLocationId)) {
                        option.selected = true;
                    }
                });

                // 如果已自動選擇儲位，觸發變更邏輯
                if (locationDropdown.value) {
                    handleLocationChange();
                }

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
    document.getElementById('submitWeeklyOrder').addEventListener('click', function () {
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

        // 檢查是否有待入庫/已登記的重複項目
        const warningDiv = document.getElementById('weeklyOrderPendingWarning');
        // 如果已經顯示過警告且使用者仍點擊提交，則直接送出
        if (warningDiv && warningDiv.dataset.confirmed === 'true') {
            warningDiv.dataset.confirmed = '';
            doSubmitWeeklyOrder(data, submitButton, errorDiv);
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 檢查中...';

        fetch('/api/weekly-orders/check-pending-inbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                part_number: data.part_number,
                warehouse_location_id: data.warehouse_location_id
            })
        })
        .then(r => r.json())
        .then(checkResult => {
            if (checkResult.has_pending) {
                // 顯示警告
                if (warningDiv) {
                    let detailHtml = '<table class="table table-sm table-bordered mb-2"><thead><tr><th>狀態</th><th>數量</th><th>剩餘</th><th>申請人</th><th>儲位</th></tr></thead><tbody>';
                    checkResult.items.forEach(item => {
                        detailHtml += `<tr>
                            <td><small>${item.status_text}</small></td>
                            <td class="text-end">${item.quantity}</td>
                            <td class="text-end">${item.remaining}</td>
                            <td><small>${item.applicant_name}</small></td>
                            <td><small>${item.location_display || '未指定'}</small></td>
                        </tr>`;
                    });
                    detailHtml += '</tbody></table>';

                    warningDiv.innerHTML = `
                        <h6 class="alert-heading"><i class="fas fa-exclamation-triangle me-2"></i>注意：此零件已有 ${checkResult.items.length} 筆待處理項目</h6>
                        ${detailHtml}
                        <p class="mb-0 small">如確認需要再次申請，請再次點擊「確認申請」。</p>
                    `;
                    warningDiv.style.display = 'block';
                    warningDiv.dataset.confirmed = 'true';
                    submitButton.disabled = false;
                    submitButton.innerHTML = '確認申請';
                } else {
                    // 無警告容器，用 confirm 代替
                    let msg = `⚠️ 此零件已有 ${checkResult.items.length} 筆待處理項目，確定要再次申請嗎？`;
                    if (confirm(msg)) {
                        doSubmitWeeklyOrder(data, submitButton, errorDiv);
                    } else {
                        submitButton.disabled = false;
                        submitButton.innerHTML = '確認申請';
                    }
                }
            } else {
                // 無重複，直接送出
                doSubmitWeeklyOrder(data, submitButton, errorDiv);
            }
        })
        .catch(err => {
            console.warn('檢查待入庫失敗，直接送出:', err);
            doSubmitWeeklyOrder(data, submitButton, errorDiv);
        });
    });

    // 實際送出申請的函數
    function doSubmitWeeklyOrder(data, submitButton, errorDiv) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 正在提交...';

        // 隱藏警告
        const warningDiv = document.getElementById('weeklyOrderPendingWarning');
        if (warningDiv) {
            warningDiv.style.display = 'none';
            warningDiv.dataset.confirmed = '';
        }

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
    }


    // 模態視窗清理函數
    function cleanupModalBackdrops() {
        // 移除所有殘留的模態視窗背景
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => {
            backdrop.remove();
        });
        
        // 確保 body 元素恢復正常狀態
        const body = document.body;
        body.classList.remove('modal-open');
        body.style.overflow = '';
        body.style.paddingRight = '';
    }

    // 為消耗分析模態視窗添加關閉事件監聽器
    const consumptionModal = document.getElementById('consumptionDetailModal');
    if (consumptionModal) {
        consumptionModal.addEventListener('hidden.bs.modal', function () {
            console.log('🧹 Cleaning up modal backdrops');
            cleanupModalBackdrops();
        });
    }

    // 為週期訂單模態視窗添加關閉事件監聽器
    const weeklyOrderModal = document.getElementById('weeklyOrderModal');
    if (weeklyOrderModal) {
        weeklyOrderModal.addEventListener('hidden.bs.modal', function () {
            cleanupModalBackdrops();
        });
    }


    // No longer need to expose to global scope
    // window.openWeeklyOrderModal = addToWeeklyOrder;
    // window.showLocationDetail = showLocationDetail;
    // window.showAllDetails = showAllDetails;
});
