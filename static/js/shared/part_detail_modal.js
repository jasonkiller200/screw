(function () {
    let currentPartData = null;
    let currentClickedLocationId = null;

    function formatIdleAnalysis(idleAnalysis) {
        if (!idleAnalysis || !idleAnalysis.last_consumption_date) {
            return {
                lastConsumptionLabel: '上線後未領料',
                idleDaysLabel: '上線後未領料',
                badgeClass: 'bg-secondary'
            };
        }

        const idleDays = idleAnalysis.idle_days;
        const lastConsumptionLabel = new Date(idleAnalysis.last_consumption_date).toLocaleDateString('zh-TW');

        if (idleAnalysis.idle_bucket === 'obsolete') {
            return {
                lastConsumptionLabel,
                idleDaysLabel: `${idleDays} 天`,
                badgeClass: 'bg-danger'
            };
        }

        if (idleAnalysis.idle_bucket === 'stagnant') {
            return {
                lastConsumptionLabel,
                idleDaysLabel: `${idleDays} 天`,
                badgeClass: 'bg-warning text-dark'
            };
        }

        if (idleAnalysis.idle_bucket === 'aging') {
            return {
                lastConsumptionLabel,
                idleDaysLabel: `${idleDays} 天`,
                badgeClass: 'bg-info text-dark'
            };
        }

        return {
            lastConsumptionLabel,
            idleDaysLabel: `${idleDays} 天`,
            badgeClass: 'bg-success'
        };
    }

    function calculateLocationHealth(available, total) {
        if (total === 0) {
            return {
                badgeClass: 'bg-light text-dark',
                icon: '⚪',
                text: '無庫存',
                tooltip: '此儲位目前無庫存'
            };
        }

        if (available <= 0) {
            return {
                badgeClass: 'bg-danger',
                icon: '🔴',
                text: '缺貨',
                tooltip: '可用庫存為零，需要補貨'
            };
        }

        if (available <= 3) {
            return {
                badgeClass: 'bg-warning',
                icon: '🟡',
                text: '偏低',
                tooltip: '庫存偏低，建議關注補貨'
            };
        }

        if (available <= 10) {
            return {
                badgeClass: 'bg-info',
                icon: '🔵',
                text: '正常',
                tooltip: '庫存狀況正常'
            };
        }

        return {
            badgeClass: 'bg-success',
            icon: '🟢',
            text: '充足',
            tooltip: '庫存充足'
        };
    }

    function checkWeeklyOrderCompatibility(weeklyOrderData) {
        if (!weeklyOrderData) {
            return '週期訂單資料載入失敗或模組未啟用';
        }

        if (weeklyOrderData.error) {
            return `週期訂單 API 錯誤：${weeklyOrderData.error}`;
        }

        if (!Object.prototype.hasOwnProperty.call(weeklyOrderData, 'registrations')) {
            return '週期訂單資料格式不相容，缺少 registrations 欄位';
        }

        if (!Array.isArray(weeklyOrderData.registrations)) {
            return '週期訂單資料格式錯誤，registrations 應為陣列格式';
        }

        if (weeklyOrderData.registrations.length > 0) {
            const firstReg = weeklyOrderData.registrations[0];
            const requiredFields = ['warehouse_location_id', 'status', 'quantity'];
            const missingFields = requiredFields.filter((field) => !Object.prototype.hasOwnProperty.call(firstReg, field));

            if (missingFields.length > 0) {
                return `週期訂單資料缺少必要欄位：${missingFields.join(', ')}`;
            }
        }

        return null;
    }

    function getStatusBadgeClass(status) {
        switch (status) {
            case 'approved':
                return 'bg-success';
            case 'completed':
                return 'bg-primary';
            case 'partially_received':
                return 'bg-warning';
            case 'rejected':
                return 'bg-danger';
            default:
                return 'bg-secondary';
        }
    }

    function getStatusText(status) {
        switch (status) {
            case 'registered':
                return '已登記';
            case 'approved':
                return '已核准';
            case 'completed':
                return '已完成';
            case 'partially_received':
                return '部分入庫';
            case 'rejected':
                return '已拒絕';
            default:
                return status || 'N/A';
        }
    }

    function cleanupModalBackdrops() {
        document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';
        document.body.style.overflow = '';
    }

    function renderSingleLocationDetail(part, inventory, allInventories, weeklyOrderData) {
        let warehouse;
        let location;
        let quantity;
        let reservedQuantity;
        let available;
        const currentIdleDisplay = formatIdleAnalysis(inventory?.idle_analysis || null);

        if (inventory.warehouse && inventory.warehouse_location) {
            warehouse = inventory.warehouse;
            location = inventory.warehouse_location;
            quantity = inventory.quantity_on_hand || inventory.quantity || 0;
            reservedQuantity = inventory.reserved_quantity || 0;
            available = inventory.available_quantity || (quantity - reservedQuantity);
        } else {
            const locationData = part.locations?.find((loc) => loc.id === currentClickedLocationId);
            if (locationData) {
                warehouse = { name: locationData.warehouse_name, code: locationData.warehouse_code };
                location = { location_code: locationData.location_code };
                quantity = inventory.quantity_on_hand || inventory.quantity || 0;
                reservedQuantity = inventory.reserved_quantity || 0;
                available = inventory.available_quantity || (quantity - reservedQuantity);
            } else {
                warehouse = { name: 'N/A', code: 'N/A' };
                location = { location_code: 'N/A' };
                quantity = inventory.quantity || 0;
                reservedQuantity = inventory.reserved_quantity || 0;
                available = quantity - reservedQuantity;
            }
        }

        const allLocations = part?.locations || [];
        const inventoryHtml = allLocations.length > 0
            ? allLocations.map((loc) => {
                const currentInventory = allInventories.find((item) => item.warehouse_location_id === loc.id);
                const quantityOnHand = currentInventory ? currentInventory.quantity_on_hand : 0;
                const currentReservedQuantity = currentInventory ? currentInventory.reserved_quantity : 0;
                const availableQuantity = currentInventory ? currentInventory.available_quantity : 0;
                const idleDisplay = formatIdleAnalysis(currentInventory?.idle_analysis);
                const healthInfo = calculateLocationHealth(availableQuantity, quantityOnHand);
                const isCurrentLocation = loc.id === currentClickedLocationId;
                const rowClass = isCurrentLocation ? 'table-warning' : '';
                const currentLabel = isCurrentLocation ? '<i class="fas fa-arrow-right me-1 text-primary"></i>' : '';

                return `
                    <tr class="${rowClass}" style="cursor: pointer;" onclick="openConsumptionAnalysisDirect('${part.part_number}', ${loc.id})">
                        <td>${currentLabel}${loc.warehouse_name} (${loc.warehouse_code})</td>
                        <td>${loc.location_code}</td>
                        <td class="text-end">${quantityOnHand}</td>
                        <td class="text-end">${currentReservedQuantity}</td>
                        <td class="text-end"><strong>${availableQuantity}</strong></td>
                        <td>${idleDisplay.lastConsumptionLabel}</td>
                        <td class="text-center">${idleDisplay.idleDaysLabel}</td>
                        <td class="text-center">
                            <span class="badge ${healthInfo.badgeClass}" title="${healthInfo.tooltip}">
                                ${healthInfo.icon} ${healthInfo.text}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="6" class="text-center text-muted">此零件未設定儲位</td></tr>';

        let weeklyOrderHtml = '';
        const weeklyOrderError = checkWeeklyOrderCompatibility(weeklyOrderData);

        if (weeklyOrderError) {
            weeklyOrderHtml = `
                <div class="row mt-3">
                    <div class="col-12">
                        <div class="alert alert-warning">
                            <h6><i class="fas fa-exclamation-triangle me-2"></i>週期申請系統相容性問題</h6>
                            <p class="mb-1">${weeklyOrderError}</p>
                            <small class="text-muted">請聯繫系統管理員檢查週期訂單模組設定。</small>
                        </div>
                    </div>
                </div>
            `;
        } else if (weeklyOrderData?.registrations?.length > 0) {
            const locationOrders = weeklyOrderData.registrations.filter(
                (registration) => registration.warehouse_location_id === (inventory.warehouse_location_id || currentClickedLocationId)
            );

            if (locationOrders.length > 0) {
                weeklyOrderHtml = `
                    <div class="row mt-3">
                        <div class="col-12">
                            <h6><i class="fas fa-calendar-week me-2 text-success"></i>週期訂單申請記錄</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-striped">
                                    <thead>
                                        <tr>
                                            <th>申請週期</th>
                                            <th>申請數量</th>
                                            <th>已入庫</th>
                                            <th>狀態</th>
                                            <th>申請人</th>
                                            <th>申請日期</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${locationOrders.map((order) => `
                                            <tr>
                                                <td><strong>${order.cycle_name || 'N/A'}</strong></td>
                                                <td class="text-end">${order.quantity || 0}</td>
                                                <td class="text-end">${order.quantity_received || 0}</td>
                                                <td>
                                                    <span class="badge ${getStatusBadgeClass(order.status)}">
                                                        ${getStatusText(order.status)}
                                                    </span>
                                                </td>
                                                <td>${order.applicant_name || 'N/A'}</td>
                                                <td>${order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                weeklyOrderHtml = `
                    <div class="row mt-3">
                        <div class="col-12">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>此儲位暫無週期訂單申請記錄
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="row">
                <div class="col-md-6">
                    <h6><i class="fas fa-info-circle me-2"></i>基本資訊</h6>
                    <table class="table table-sm">
                        <tr><td><strong>零件編號：</strong></td><td>${part?.part_number || 'N/A'}</td></tr>
                        <tr><td><strong>名稱：</strong></td><td>${part?.name || 'N/A'}</td></tr>
                        <tr><td><strong>描述：</strong></td><td>${part?.description || '無'}</td></tr>
                        <tr><td><strong>單位：</strong></td><td>${part?.unit || 'N/A'}</td></tr>
                        <tr><td><strong>每盒數量：</strong></td><td>${part?.quantity_per_box || 'N/A'}</td></tr>
                        <tr><td><strong>採購前置期：</strong></td><td>${part?.lead_time || 'N/A'} 天</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6><i class="fas fa-warehouse me-2"></i>當前儲位詳情</h6>
                    <div class="card border-warning bg-warning bg-opacity-10">
                        <div class="card-body">
                            <h6 class="card-title text-warning-emphasis">
                                <i class="fas fa-arrow-right me-2"></i>${warehouse.name || 'N/A'} - ${location.location_code || 'N/A'}
                            </h6>
                            <div class="row text-center">
                                <div class="col-4">
                                    <div class="text-primary fw-bold fs-4">${quantity}</div>
                                    <small class="text-muted">在庫數量</small>
                                </div>
                                <div class="col-4">
                                    <div class="text-warning fw-bold fs-4">${reservedQuantity}</div>
                                    <small class="text-muted">預留數量</small>
                                </div>
                                <div class="col-4">
                                    <div class="text-success fw-bold fs-4">${available}</div>
                                    <small class="text-muted">可用數量</small>
                                </div>
                            </div>
                            <div class="row mt-3 text-center">
                                <div class="col-6">
                                    <div class="fw-semibold">${currentIdleDisplay.lastConsumptionLabel}</div>
                                    <small class="text-muted">最後耗用日</small>
                                </div>
                                <div class="col-6">
                                    <span class="badge ${currentIdleDisplay.badgeClass}">${currentIdleDisplay.idleDaysLabel}</span>
                                    <div><small class="text-muted">閒置天數</small></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6><i class="fas fa-list me-2"></i>所有儲位庫存 <small class="text-muted">(點擊切換儲位)</small></h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>倉庫</th>
                                    <th>倉位</th>
                                    <th class="text-end">在庫數量</th>
                                    <th class="text-end">預留數量</th>
                                    <th class="text-end">可用數量</th>
                                    <th>最後耗用日</th>
                                    <th class="text-center">閒置天數</th>
                                    <th class="text-center">健康度</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${inventoryHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            ${weeklyOrderHtml}
        `;
    }

    function renderAllLocationsOverview(part, inventories, orders) {
        const allLocations = part?.locations || [];
        const inventoryHtml = allLocations.length > 0
            ? allLocations.map((loc) => {
                const currentInventory = inventories.find((item) => item.warehouse_location_id === loc.id);
                const idleDisplay = formatIdleAnalysis(currentInventory?.idle_analysis);

                return `
                    <tr>
                        <td>${loc.warehouse_name} (${loc.warehouse_code})</td>
                        <td>${loc.location_code}</td>
                        <td class="text-end">${currentInventory ? currentInventory.quantity_on_hand : 0}</td>
                        <td class="text-end">${currentInventory ? currentInventory.reserved_quantity : 0}</td>
                        <td class="text-end"><strong>${currentInventory ? currentInventory.available_quantity : 0}</strong></td>
                        <td>${idleDisplay.lastConsumptionLabel}</td>
                        <td class="text-center"><span class="badge ${idleDisplay.badgeClass}">${idleDisplay.idleDaysLabel}</span></td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="7" class="text-center text-muted">此零件未設定儲位</td></tr>';

        let historyHtml = '';
        if (orders && orders.length > 0) {
            const statusMap = {
                registered: { text: '已登記', class: 'secondary' },
                approved: { text: '已核准', class: 'primary' },
                partially_received: { text: '部分到貨', class: 'info' },
                completed: { text: '已完成', class: 'success' },
                rejected: { text: '已拒絕', class: 'danger' }
            };

            historyHtml = orders.slice(0, 10).map((order) => {
                const date = new Date(order.created_at || order.order_date);
                const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const statusInfo = statusMap[order.status] || { text: order.status, class: 'light' };

                return `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${order.applicant_name || 'N/A'}</td>
                        <td>${order.location_display || order.location_code || '無指定'}</td>
                        <td class="text-end">${order.quantity || order.quantity_ordered || 0}</td>
                        <td>
                            <span class="badge bg-${statusInfo.class}">
                                ${statusInfo.text}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            historyHtml = '<tr><td colspan="5" class="text-center text-muted">暫無申請記錄</td></tr>';
        }

        return `
            <div class="row">
                <div class="col-md-6">
                    <h6>基本資訊</h6>
                    <table class="table table-sm">
                        <tr><td><strong>零件編號：</strong></td><td>${part?.part_number || 'N/A'}</td></tr>
                        <tr><td><strong>名稱：</strong></td><td>${part?.name || 'N/A'}</td></tr>
                        <tr><td><strong>描述：</strong></td><td>${part?.description || '無'}</td></tr>
                        <tr><td><strong>單位：</strong></td><td>${part?.unit || 'N/A'}</td></tr>
                        <tr><td><strong>每盒數量：</strong></td><td>${part?.quantity_per_box || 'N/A'}</td></tr>
                        <tr><td><strong>採購前置期：</strong></td><td>${part?.lead_time || 'N/A'} 天</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>各儲位庫存</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-striped">
                            <thead>
                                <tr>
                                    <th>倉庫</th>
                                    <th>倉位</th>
                                    <th>在庫數量</th>
                                    <th>預留數量</th>
                                    <th>可用數量</th>
                                    <th>最後耗用日</th>
                                    <th>閒置天數</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${inventoryHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <h6>訂購歷史</h6>
                    <div class="order-history" style="max-height: 200px; overflow-y: auto;">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>申請日期</th>
                                    <th>申請人</th>
                                    <th>儲位</th>
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
        `;
    }

    function enhanceInventorySummaryTableWithClicks(originalTableHtml, inventories) {
        if (!originalTableHtml || !inventories) {
            return originalTableHtml;
        }

        let enhancedHtml = originalTableHtml.replace('<table class="table', '<table class="table table-hover');

        inventories.forEach((inventory) => {
            const warehouseLocationId = inventory.warehouse_location_id;
            if (!warehouseLocationId) {
                return;
            }

            const rowPattern = new RegExp(`(<tr[^>]*class="js-location-row-click"[^>]*data-location-id="${warehouseLocationId}"[^>]*>)`, 'g');
            enhancedHtml = enhancedHtml.replace(rowPattern, (match) => match.replace('<tr', `<tr id="summary-row-${warehouseLocationId}"`));
        });

        return enhancedHtml;
    }

    function updateSummaryTableHighlight(activeLocationId) {
        document.querySelectorAll('[id^="summary-row-"]').forEach((row) => {
            row.classList.remove('table-primary', 'border-primary', 'shadow-sm');
            row.style.fontWeight = 'normal';
            row.style.borderLeft = '';
        });

        const activeRow = document.getElementById(`summary-row-${activeLocationId}`);
        if (activeRow) {
            activeRow.classList.add('table-primary', 'border-primary', 'shadow-sm');
            activeRow.style.fontWeight = 'bold';
            activeRow.style.borderLeft = '4px solid #0d6efd';
        }
    }

    function renderNoInventoryState(partInfo) {
        const summarySection = document.getElementById('consumptionSummarySection');
        const detailList = document.getElementById('consumptionDetailList');
        const label = document.getElementById('consumptionDetailModalLabel');

        if (!summarySection || !detailList || !label) {
            return;
        }

        label.innerHTML = `<i class="fas fa-info-circle me-2 text-primary"></i>零件資訊 (${partInfo.part_number})`;
        summarySection.innerHTML = `
            <div class="alert alert-info mb-3">
                <i class="fas fa-info-circle me-2"></i>此零件尚未設定儲位或暫無庫存資料
            </div>
            <div class="row g-3">
                <div class="col-12">
                    ${window.ConsumptionUtils ? window.ConsumptionUtils.renderPartBasicInfoCard(partInfo) : '<div class="alert alert-warning">消耗分析工具未載入</div>'}
                </div>
            </div>
        `;
        detailList.innerHTML = '<div class="alert alert-secondary m-0"><i class="fas fa-inbox me-2"></i>暫無可顯示的耗損分析資料</div>';
    }

    function switchLocationDetail(partNumber, warehouseLocationId) {
        if (!currentPartData || !currentPartData.inventories) {
            console.error('currentPartData is missing');
            return;
        }

        const targetInventory = currentPartData.inventories.find((inventory) => inventory.warehouse_location_id == warehouseLocationId);
        if (!targetInventory) {
            console.error('Target inventory not found for location ID:', warehouseLocationId);
            return;
        }

        const detailHtml = `
            <h5 class="fw-bold mb-4">
                <i class="fas fa-list me-2"></i> 詳細分析清單
                <small class="text-muted ms-2" style="font-size: 0.9rem; font-weight: normal;">(${targetInventory.warehouse_name} - ${targetInventory.location_code})</small>
            </h5>
            ${window.ConsumptionUtils.renderLocationDetailCard(targetInventory, currentPartData.part_info.locations)}
        `;

        const detailList = document.getElementById('consumptionDetailList');
        const legacyContainer = document.getElementById('legacy-detail-container');
        const container = detailList || legacyContainer;

        if (container) {
            container.innerHTML = '';
            requestAnimationFrame(() => {
                container.innerHTML = detailHtml;
                container.scrollTop = 0;
                container.animate([
                    { opacity: 0.5 },
                    { opacity: 1 }
                ], {
                    duration: 300,
                    easing: 'ease-out'
                });
            });
        }

        updateSummaryTableHighlight(warehouseLocationId);
    }

    function showConsumptionAnalysis() {
        if (!currentPartData) {
            alert('無零件資料');
            return;
        }

        if (!currentPartData.inventories || currentPartData.inventories.length === 0) {
            renderNoInventoryState(currentPartData.part_info);

            const modalElement = document.getElementById('consumptionDetailModal');
            let consumptionModal = bootstrap.Modal.getInstance(modalElement);
            if (!consumptionModal) {
                consumptionModal = new bootstrap.Modal(modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });
            }
            consumptionModal.show();
            return;
        }

        const summarySection = document.getElementById('consumptionSummarySection');
        const detailList = document.getElementById('consumptionDetailList');
        const label = document.getElementById('consumptionDetailModalLabel');
        const legacyContent = document.getElementById('consumptionDetailContent');

        if ((!summarySection || !detailList) && !legacyContent) {
            alert('耗損分析模態視窗元素未找到');
            return;
        }

        if (!label) {
            console.error('Modal label element not found');
            return;
        }

        const partDetailModalElement = document.getElementById('partDetailModal');
        const partDetailModal = bootstrap.Modal.getInstance(partDetailModalElement);

        function prepareAndShowModal() {
            label.innerHTML = `<i class="fas fa-chart-pie me-2 text-primary"></i>零件耗損詳細分析 (${currentPartData.part_info.part_number})`;

            if (window.ConsumptionUtils) {
                let initialLocationId = null;

                if (currentClickedLocationId) {
                    const exists = currentPartData.inventories.some((inventory) => inventory.warehouse_location_id === currentClickedLocationId);
                    if (exists) {
                        initialLocationId = currentClickedLocationId;
                    }
                }

                if (!initialLocationId && currentPartData.inventories.length > 0) {
                    initialLocationId = currentPartData.inventories[0].warehouse_location_id;
                }

                const originalSummaryTable = window.ConsumptionUtils.renderInventorySummaryTable(currentPartData.inventories);
                const enhancedSummaryTable = enhanceInventorySummaryTableWithClicks(originalSummaryTable, currentPartData.inventories);
                const summaryHtml = `
                    <div class="row g-3">
                        <div class="col-md-5">
                            ${window.ConsumptionUtils.renderPartBasicInfoCard(currentPartData.part_info)}
                        </div>
                        <div class="col-md-7">
                            <div style="position: relative;">
                                ${enhancedSummaryTable}
                                <div style="position: absolute; top: 10px; right: 15px; background: rgba(255,255,255,0.9); padding: 5px 10px; border-radius: 15px; font-size: 0.8rem;" class="text-muted">
                                    <i class="fas fa-mouse-pointer me-1"></i>點擊儲位切換詳情
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                if (summarySection) {
                    summarySection.innerHTML = summaryHtml;
                } else if (legacyContent) {
                    legacyContent.innerHTML = `<div class="sticky-top bg-white border-bottom p-3 mb-3">${summaryHtml}</div><div id="legacy-detail-container"></div>`;
                }

                if (initialLocationId) {
                    switchLocationDetail(currentPartData.part_info.part_number, initialLocationId);
                }
            } else {
                const errorHtml = `
                    <div class="alert alert-danger">
                        <h6><i class="fas fa-exclamation-triangle me-2"></i>消耗分析工具未載入</h6>
                        <p>請確保 consumption_utils.js 檔案已正確載入。</p>
                    </div>
                `;

                if (summarySection && detailList) {
                    summarySection.innerHTML = '';
                    detailList.innerHTML = errorHtml;
                } else if (legacyContent) {
                    legacyContent.innerHTML = errorHtml;
                }
            }

            const modalElement = document.getElementById('consumptionDetailModal');
            let consumptionModal = bootstrap.Modal.getInstance(modalElement);
            if (!consumptionModal) {
                consumptionModal = new bootstrap.Modal(modalElement, {
                    backdrop: true,
                    keyboard: true,
                    focus: true
                });
            }
            consumptionModal.show();
        }

        if (partDetailModal) {
            partDetailModalElement.addEventListener('hidden.bs.modal', prepareAndShowModal, { once: true });
            partDetailModal.hide();
        } else {
            prepareAndShowModal();
        }
    }

    function openConsumptionAnalysisDirect(partNumber, warehouseLocationId = null) {
        if (!partNumber) {
            return;
        }

        currentClickedLocationId = warehouseLocationId;

        const modalElement = document.getElementById('consumptionDetailModal');
        const label = document.getElementById('consumptionDetailModalLabel');
        const summarySection = document.getElementById('consumptionSummarySection');
        const detailList = document.getElementById('consumptionDetailList');

        if (label) {
            label.textContent = `🛠️ 消耗分析與採購建議 (${partNumber})`;
        }
        if (summarySection) {
            summarySection.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary" role="status"></div>
                    <div class="mt-2 text-muted">正在載入零件與庫存分佈...</div>
                </div>
            `;
        }
        if (detailList) {
            detailList.innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-secondary" role="status"></div>
                    <div class="mt-2 text-muted">正在載入耗損詳情...</div>
                </div>
            `;
        }

        let modal = bootstrap.Modal.getInstance(modalElement);
        if (!modal) {
            modal = new bootstrap.Modal(modalElement, { backdrop: true, keyboard: true, focus: true });
        }
        modal.show();

        fetch(`/api/part/${encodeURIComponent(partNumber)}?include_locations=true`)
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    throw new Error(data.error);
                }
                currentPartData = data;
                showConsumptionAnalysis();
            })
            .catch((error) => {
                console.error('openConsumptionAnalysisDirect error:', error);
                if (detailList) {
                    detailList.innerHTML = `<div class="alert alert-danger m-3">載入失敗：${error.message}</div>`;
                }
            });
    }

    function showPartDetails(partNumber, warehouseLocationId = null) {
        if (!partNumber) {
            return;
        }

        currentClickedLocationId = warehouseLocationId;

        const modalLabel = document.getElementById('partDetailModalLabel');
        const detailContent = document.getElementById('partDetailContent');
        const modalElement = document.getElementById('partDetailModal');
        const showConsumptionBtn = document.getElementById('showConsumptionAnalysisBtn');

        if (!modalLabel || !detailContent || !modalElement) {
            alert('模態視窗元素未找到，請確認頁面載入完整');
            return;
        }

        modalLabel.textContent = `零件詳情: ${partNumber}`;
        detailContent.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">載入中...</span>
                </div>
                <p class="mt-2">正在載入零件資訊...</p>
            </div>
        `;

        if (showConsumptionBtn) {
            showConsumptionBtn.style.display = 'none';
        }

        let modal = bootstrap.Modal.getInstance(modalElement);
        if (!modal) {
            modal = new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });

            modalElement.addEventListener('hidden.bs.modal', cleanupModalBackdrops, { once: true });
        }
        modal.show();

        fetch(`/api/part/${encodeURIComponent(partNumber)}?include_locations=true`)
            .then((response) => response.json())
            .then((data) => Promise.all([
                data,
                fetch(`/api/part/${encodeURIComponent(partNumber)}/weekly-orders`).then((response) => response.json()).catch(() => null)
            ]))
            .then(([data, weeklyOrderData]) => {
                if (data.error) {
                    detailContent.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                    return;
                }

                currentPartData = data;

                const part = data.part_info;
                const inventories = data.inventories || [];
                const orders = data.order_history || [];
                const targetInventory = currentClickedLocationId
                    ? inventories.find((inventory) => inventory.warehouse_location_id === currentClickedLocationId)
                    : null;

                detailContent.innerHTML = targetInventory
                    ? renderSingleLocationDetail(part, targetInventory, inventories, weeklyOrderData)
                    : renderAllLocationsOverview(part, inventories, orders);

                if (showConsumptionBtn && inventories.length > 0) {
                    showConsumptionBtn.style.display = 'inline-block';
                    showConsumptionBtn.onclick = showConsumptionAnalysis;
                }
            })
            .catch((error) => {
                console.error('Error fetching part details:', error);
                detailContent.innerHTML = `<div class="alert alert-danger">載入零件詳情失敗：${error.message}</div>`;
            });
    }

    function init() {
        const showConsumptionBtn = document.getElementById('showConsumptionAnalysisBtn');
        if (showConsumptionBtn) {
            showConsumptionBtn.addEventListener('click', showConsumptionAnalysis);
        }

        const consumptionDetailModal = document.getElementById('consumptionDetailModal');
        if (consumptionDetailModal) {
            consumptionDetailModal.addEventListener('hidden.bs.modal', function () {
                window.setTimeout(cleanupModalBackdrops, 100);
            });
        }
    }

    const api = {
        cleanupModalBackdrops,
        getCurrentClickedLocationId: () => currentClickedLocationId,
        getCurrentPartData: () => currentPartData,
        init,
        openConsumptionAnalysisDirect,
        showConsumptionAnalysis,
        showPartDetails,
        switchLocationDetail
    };

    window.PartDetailModal = api;
    window.cleanupModalBackdrops = cleanupModalBackdrops;
    window.openConsumptionAnalysisDirect = openConsumptionAnalysisDirect;
    window.showConsumptionAnalysis = showConsumptionAnalysis;
    window.showPartDetails = showPartDetails;
    window.switchLocationDetail = switchLocationDetail;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();