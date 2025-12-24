let currentRegistrationId = null;
let currentRegistrationData = null;
let currentPartData = null; // 用於儲存零件詳情資料供耗損分析使用
let currentClickedLocationId = null; // 用於跟蹤當前點擊的儲位ID

// 篩選功能
document.querySelectorAll('input[name="statusFilter"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const status = this.value;
        const rows = document.querySelectorAll('.registration-row');
        
        rows.forEach(row => {
            if (status === 'all' || row.dataset.status === status) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
});

// 全選功能
const selectAllCheckbox = document.getElementById('selectAll');
if (selectAllCheckbox) { // 僅在元素存在時添加監聽器
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.registration-checkbox:not([style*="display: none"])');
        checkboxes.forEach(cb => cb.checked = this.checked);
    });
}

// 查看詳細資訊
function viewDetails(registrationId) {
    fetch(`/weekly_orders/registration/${registrationId}`)
        .then(response => response.json())
        .then(data => {
            const content = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>基本資訊</h6>
                        <table class="table table-sm">
                            <tr><td><strong>品號：</strong></td><td>${data.part_number}</td></tr>
                            <tr><td><strong>品名：</strong></td><td>${data.part_name}</td></tr>
                            <tr><td><strong>儲位：</strong></td><td>${data.location_display || '無指定儲位'}</td></tr>
                            <tr><td><strong>種類：</strong></td><td>${data.category || '-'}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>數量與時間</h6>
                        <table class="table table-sm">
                            <tr><td><strong>數量：</strong></td><td>${data.quantity} ${data.unit}</td></tr>
                            <tr><td><strong>需用日期：</strong></td><td>${data.required_date || '-'}</td></tr>
                            <tr><td><strong>申請時間：</strong></td><td>${new Date(data.created_at).toLocaleString('zh-TW')}</td></tr>
                            <tr><td><strong>用途備註：</strong></td><td>${data.purpose_notes || '-'}</td></tr>
                        </table>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>申請人資訊</h6>
                        <table class="table table-sm">
                            <tr><td><strong>申請人：</strong></td><td>${data.applicant_name}</td></tr>
                            <tr><td><strong>申請單位：</strong></td><td>${data.department || '-'}</td></tr>
                        </table>
                    </div>
                </div>
                ${data.review_notes ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>審查備註</h6>
                        <div class="alert alert-info">${data.review_notes}</div>
                    </div>
                </div>
                ` : ''}
            `;
            
            document.getElementById('detailContent').innerHTML = content;
            new bootstrap.Modal(document.getElementById('detailModal')).show();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('載入詳細資訊失敗');
        });
}

// 審查申請
function reviewRegistration(registrationId, action) {
    if (action === 'rejected') {
        currentRegistrationId = registrationId;
        new bootstrap.Modal(document.getElementById('rejectModal')).show();
        return;
    }
    
    // 直接通過
    submitReview(registrationId, action, '');
}

// 確認拒絕
function confirmReject() {
    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) {
        alert('請填寫拒絕原因');
        return;
    }
    
    submitReview(currentRegistrationId, 'rejected', reason);
    bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
}

// 提交審查結果
function submitReview(registrationId, action, notes, modifiedQuantity = null) {
    const requestData = {
        action: action,
        notes: notes
    };
    
    if (modifiedQuantity !== null) {
        requestData.modified_quantity = modifiedQuantity;
    }
    
    fetch(`/weekly_orders/review/${registrationId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload(); // 重新載入頁面以顯示更新結果
        } else {
            alert('審查失敗：' + (data.message || '未知錯誤'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('審查失敗，請稍後再試');
    });
}

// 批量通過
function batchApprove() {
    const checkedBoxes = document.querySelectorAll('.registration-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('請選擇要通過的申請項目');
        return;
    }
    
    if (!confirm(`確定要通過選中的 ${checkedBoxes.length} 個申請項目嗎？`)) {
        return;
    }
    
    const registrationIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    fetch('/weekly_orders/batch_review', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            registration_ids: registrationIds,
            action: 'approved'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert('批量審查失敗：' + (data.message || '未知錯誤'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('批量審查失敗，請稍後再試');
    });
}

// 直接開啟「耗損分析與採購建議」模態視窗（跳過第一層零件詳情 modal）
function openConsumptionAnalysisDirect(partNumber, warehouseLocationId = null) {
    if (!partNumber) return;

    // 記錄使用者點擊的儲位（用於決定耗損視窗預設顯示哪個儲位）
    currentClickedLocationId = warehouseLocationId;

    // 先把耗損 modal 打開並顯示 loading，讓使用者有即時回饋
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

    // 載入資料後，直接呼叫既有的 showConsumptionAnalysis() 產生完整畫面
    fetch(`/api/part/${encodeURIComponent(partNumber)}?include_locations=true`)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            currentPartData = data;
            showConsumptionAnalysis(warehouseLocationId);
        })
        .catch(err => {
            console.error('openConsumptionAnalysisDirect error:', err);
            if (detailList) {
                detailList.innerHTML = `<div class="alert alert-danger m-3">載入失敗：${err.message}</div>`;
            }
        });
}

// 顯示零件詳情
function showPartDetails(partNumber, warehouseLocationId = null) {
    console.log('showPartDetails called with:', partNumber, warehouseLocationId);
    if (!partNumber) {
        console.log('No part number provided');
        return;
    }
    
    // 儲存點擊的儲位ID
    currentClickedLocationId = warehouseLocationId;
    
    const modalLabel = document.getElementById('detailModalLabel');
    const detailContent = document.getElementById('detailContent');
    const modalElement = document.getElementById('detailModal');
    const showConsumptionBtn = document.getElementById('showConsumptionAnalysisBtn');
    
    if (!modalLabel || !detailContent || !modalElement) {
        console.error('Modal elements not found');
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
    
    // 隱藏耗損分析按鈕
    if (showConsumptionBtn) {
        showConsumptionBtn.style.display = 'none';
    }
    
    // 重用或創建 modal 實例
    let modal = bootstrap.Modal.getInstance(modalElement);
    if (!modal) {
        modal = new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
    }
    modal.show();

    fetch(`/api/part/${encodeURIComponent(partNumber)}?include_locations=true`)
        .then(response => response.json())
        .then(data => {
            // 儲存當前零件資料供耗損分析使用
            currentPartData = data;
            
            // 獲取週期訂單相關數據
            return Promise.all([
                data,
                fetch(`/api/part/${encodeURIComponent(partNumber)}/weekly-orders`).then(r => r.json()).catch(() => null)
            ]);
        })
        .then(([data, weeklyOrderData]) => {
            if (data.error) {
                detailContent.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                return;
            }
            
            const part = data.part_info;
            const inventories = data.inventories || [];
            const orders = data.order_history || [];

            // 如果有指定儲位ID，只顯示該儲位的詳情（不顯示切換功能）
            let contentHtml = '';
            if (warehouseLocationId) {
                const targetInventory = inventories.find(inv => inv.warehouse_location_id === warehouseLocationId);
                contentHtml = renderSingleLocationDetailOnly(part, targetInventory, inventories, warehouseLocationId);
            } else {
                // 沒有指定儲位時，顯示全部儲位概覽
                contentHtml = renderAllLocationsOverview(part, inventories, orders);
            }

            detailContent.innerHTML = contentHtml;
            
            // 如果有庫存資料，顯示耗損分析按鈕
            if (showConsumptionBtn && inventories && inventories.length > 0) {
                showConsumptionBtn.style.display = 'inline-block';
                showConsumptionBtn.onclick = () => showConsumptionAnalysis(warehouseLocationId);
            }
        })
        .catch(error => {
            console.error('Error fetching part details:', error);
            detailContent.innerHTML = `<div class="alert alert-danger">載入零件詳情失敗：${error.message}</div>`;
        });
}

// 修改數量
function modifyQuantity(registrationId) {
    currentRegistrationId = registrationId;
    
    // 獲取當前項目詳細信息
    fetch(`/weekly_orders/registration/${registrationId}`)
        .then(response => response.json())
        .then(data => {
            currentRegistrationData = data;
            
            // 填充模態框
            document.getElementById('modifyItemInfo').value = `${data.part_number} - ${data.part_name}`;
            document.getElementById('originalQuantity').value = `${data.quantity} ${data.unit}`;
            document.getElementById('modifiedQuantity').value = data.quantity;
            document.getElementById('modifyReason').value = '';
            
            // 顯示模態框
            new bootstrap.Modal(document.getElementById('modifyModal')).show();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('載取項目信息失敗');
        });
}

// 確認修改數量
function confirmModify() {
    const modifiedQuantity = parseInt(document.getElementById('modifiedQuantity').value);
    const modifyReason = document.getElementById('modifyReason').value.trim();
    
    if (!modifiedQuantity || modifiedQuantity <= 0) {
        alert('請輸入有效的數量');
        return;
    }
    
    if (!modifyReason) {
        alert('請填寫修改說明');
        document.getElementById('modifyReason').focus();
        return;
    }
    
    if (modifiedQuantity === currentRegistrationData.quantity) {
        alert('修改後的數量與原數量相同，將直接核准');
        submitReview(currentRegistrationId, 'approved', modifyReason);
    } else {
        submitReview(currentRegistrationId, 'approved', modifyReason, modifiedQuantity);
    }
    
    // 隱藏模態框
    bootstrap.Modal.getInstance(document.getElementById('modifyModal')).hide();
}

// 渲染單一儲位詳情（不顯示切換功能，專用於週期訂單）
function renderSingleLocationDetailOnly(part, inventory, allInventories, locationId) {
    let warehouse, location, quantity, reserved_quantity, available;
    
    if (inventory) {
        if (inventory.warehouse && inventory.warehouse_location) {
            warehouse = inventory.warehouse;
            location = inventory.warehouse_location;
        } else {
            const locationData = part.locations?.find(loc => loc.id === locationId);
            if (locationData) {
                warehouse = { name: locationData.warehouse_name, code: locationData.warehouse_code };
                location = { location_code: locationData.location_code };
            } else {
                warehouse = { name: 'N/A', code: 'N/A' };
                location = { location_code: 'N/A' };
            }
        }
        quantity = inventory.quantity_on_hand || inventory.quantity || 0;
        reserved_quantity = inventory.reserved_quantity || 0;
        available = inventory.available_quantity || (quantity - reserved_quantity);
    } else {
        // 沒有庫存資料時
        const locationData = part.locations?.find(loc => loc.id === locationId);
        if (locationData) {
            warehouse = { name: locationData.warehouse_name, code: locationData.warehouse_code };
            location = { location_code: locationData.location_code };
        } else {
            warehouse = { name: 'N/A', code: 'N/A' };
            location = { location_code: 'N/A' };
        }
        quantity = 0;
        reserved_quantity = 0;
        available = 0;
    }
    
    return `
        <div class="row">
            <div class="col-md-6">
                <h6><i class="fas fa-info-circle me-2"></i>基本資訊</h6>
                <table class="table table-sm">
                    <tr><td><strong>零件編號：</strong></td><td>${(part && part.part_number) || 'N/A'}</td></tr>
                    <tr><td><strong>名稱：</strong></td><td>${(part && part.name) || 'N/A'}</td></tr>
                    <tr><td><strong>描述：</strong></td><td>${(part && part.description) || '無'}</td></tr>
                    <tr><td><strong>單位：</strong></td><td>${(part && part.unit) || 'N/A'}</td></tr>
                    <tr><td><strong>每盒數量：</strong></td><td>${(part && part.quantity_per_box) || 'N/A'}</td></tr>
                    <tr><td><strong>採購前置期：</strong></td><td>${(part && part.lead_time) || 'N/A'} 天</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6><i class="fas fa-warehouse me-2"></i>申請儲位詳情</h6>
                <div class="card border-primary">
                    <div class="card-body">
                        <h6 class="card-title text-primary">
                            <i class="fas fa-map-marker-alt me-2"></i>${warehouse.name || 'N/A'} - ${location.location_code || 'N/A'}
                        </h6>
                        <div class="row text-center mt-3">
                            <div class="col-4">
                                <div class="text-primary fw-bold fs-4">${quantity}</div>
                                <small class="text-muted">在庫數量</small>
                            </div>
                            <div class="col-4">
                                <div class="text-warning fw-bold fs-4">${reserved_quantity}</div>
                                <small class="text-muted">預留數量</small>
                            </div>
                            <div class="col-4">
                                <div class="text-success fw-bold fs-4">${available}</div>
                                <small class="text-muted">可用數量</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 渲染所有儲位概覽
function renderAllLocationsOverview(part, inventories, orders) {
    let inventoryHtml = '';
    const all_locations = (part && part.locations) ? part.locations : [];

    if (all_locations.length > 0) {
        inventoryHtml = all_locations.map(loc => {
            const inv = inventories.find(i => i.warehouse_location_id === loc.id);
            const quantity_on_hand = inv ? inv.quantity_on_hand : 0;
            const reserved_quantity = inv ? inv.reserved_quantity : 0;
            const available_quantity = inv ? inv.available_quantity : 0;

            return `
                <tr>
                    <td>${loc.warehouse_name} (${loc.warehouse_code})</td>
                    <td>${loc.location_code}</td>
                    <td class="text-end">${quantity_on_hand}</td>
                    <td class="text-end">${reserved_quantity}</td>
                    <td class="text-end"><strong>${available_quantity}</strong></td>
                </tr>
            `;
        }).join('');
    } else {
        inventoryHtml = '<tr><td colspan="5" class="text-center text-muted">此零件未設定儲位</td></tr>';
    }

    let historyHtml = '';
    if (orders && orders.length > 0) {
        const statusMap = {
            'registered': { text: '已登記', class: 'secondary' },
            'approved': { text: '已核准', class: 'primary' },
            'partially_received': { text: '部分到貨', class: 'info' },
            'completed': { text: '已完成', class: 'success' },
            'rejected': { text: '已拒絕', class: 'danger' }
        };

        historyHtml = orders.slice(0, 10).map(order => {
            const date = new Date(order.created_at || order.order_date);
            const formattedDate = date.getFullYear() + '-' +
                                  String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                  String(date.getDate()).padStart(2, '0');
            
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
                    <tr><td><strong>零件編號：</strong></td><td>${(part && part.part_number) || 'N/A'}</td></tr>
                    <tr><td><strong>名稱：</strong></td><td>${(part && part.name) || 'N/A'}</td></tr>
                    <tr><td><strong>描述：</strong></td><td>${(part && part.description) || '無'}</td></tr>
                    <tr><td><strong>單位：</strong></td><td>${(part && part.unit) || 'N/A'}</td></tr>
                    <tr><td><strong>每盒數量：</strong></td><td>${(part && part.quantity_per_box) || 'N/A'}</td></tr>
                    <tr><td><strong>採購前置期：</strong></td><td>${(part && part.lead_time) || 'N/A'} 天</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>各儲位庫存 <small class="text-muted">(點擊查看詳情)</small></h6>
                <div class="table-responsive">
                    <table class="table table-sm table-striped table-hover">
                        <thead>
                            <tr>
                                <th>倉庫</th>
                                <th>倉位</th>
                                <th class="text-end">在庫數量</th>
                                <th class="text-end">預留數量</th>
                                <th class="text-end">可用數量</th>
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

// 計算儲位健康度
function calculateLocationHealth(available, total) {
    let healthInfo = {
        badgeClass: 'bg-secondary',
        icon: '❓',
        text: '未知',
        tooltip: '無法判斷庫存狀況'
    };

    if (total === 0 && available === 0) {
        healthInfo = {
            badgeClass: 'bg-danger',
            icon: '🔴',
            text: '無庫存',
            tooltip: '此儲位無庫存'
        };
    } else if (available <= 0) {
        healthInfo = {
            badgeClass: 'bg-danger',
            icon: '🔴',
            text: '缺貨',
            tooltip: '可用庫存為零'
        };
    } else if (available <= 5) {
        healthInfo = {
            badgeClass: 'bg-warning',
            icon: '🟡',
            text: '偏低',
            tooltip: '庫存量偏低'
        };
    } else if (available <= 15) {
        healthInfo = {
            badgeClass: 'bg-info',
            icon: '🔵',
            text: '正常',
            tooltip: '庫存狀況正常'
        };
    } else {
        healthInfo = {
            badgeClass: 'bg-success',
            icon: '🟢',
            text: '充足',
            tooltip: '庫存充足'
        };
    }

    return healthInfo;
}

// 顯示耗損分析
function showConsumptionAnalysis(selectedLocationId = null) {
    if (!currentPartData || !currentPartData.inventories || currentPartData.inventories.length === 0) {
        alert('無庫存資料可分析');
        return;
    }
    
    const summarySection = document.getElementById('consumptionSummarySection');
    const detailList = document.getElementById('consumptionDetailList');
    const label = document.getElementById('consumptionDetailModalLabel');
    
    if (!summarySection || !detailList || !label) {
        alert('耗損分析模態視窗元素未找到');
        console.error('Missing elements:', { summarySection, detailList, label });
        return;
    }
    
    // 先隱藏零件詳情模態視窗
    const partDetailModal = bootstrap.Modal.getInstance(document.getElementById('detailModal'));
    if (partDetailModal) {
        partDetailModal.hide();
    }
    
    // 如果指定了儲位ID，使用該儲位；否則使用當前點擊的儲位或顯示全部
    const targetLocationId = selectedLocationId !== null ? selectedLocationId : (currentClickedLocationId || null);
    
    console.log('showConsumptionAnalysis called with:', { selectedLocationId, currentClickedLocationId, targetLocationId });
    console.log('Available inventories:', currentPartData.inventories.map(i => ({ 
        id: i.warehouse_location_id, 
        code: i.location_code,
        warehouse: i.warehouse_name 
    })));
    
    // 篩選要顯示的庫存資料
    const displayInventories = targetLocationId !== null
        ? currentPartData.inventories.filter(inv => inv.warehouse_location_id === targetLocationId)
        : currentPartData.inventories;
    
    console.log('Filtered displayInventories:', displayInventories.length, displayInventories);
    
    if (displayInventories.length === 0 && targetLocationId !== null) {
        // 如果找不到該儲位的庫存，顯示警告但仍然顯示全部儲位資料
        console.warn('指定儲位無庫存資料，顯示全部儲位');
        const allInventoriesDisplay = currentPartData.inventories;
        
        const allLocations = currentPartData.part_info.locations || [];
        let inventorySummaryHtml = '';
        
        if (window.ConsumptionUtils && allLocations.length > 1) {
            inventorySummaryHtml = renderClickableInventorySummaryTable(currentPartData.inventories, null);
        } else if (window.ConsumptionUtils) {
            inventorySummaryHtml = window.ConsumptionUtils.renderInventorySummaryTable(allInventoriesDisplay);
        }
        
        const summaryRow = `
            <div class="alert alert-warning mb-3">
                <i class="fas fa-exclamation-triangle me-2"></i>該儲位暫無詳細分析資料，顯示全部儲位資訊
            </div>
            <div class="row mb-4 g-3">
                <div class="col-md-5">
                    ${window.ConsumptionUtils ? window.ConsumptionUtils.renderPartBasicInfoCard(currentPartData.part_info) : '<div class="alert alert-warning">消耗分析工具未載入</div>'}
                </div>
                <div class="col-md-7">
                    ${inventorySummaryHtml || '<div class="alert alert-warning">消耗分析工具未載入</div>'}
                </div>
            </div>
            <hr class="my-4 border-2 opacity-25">
            <h5 class="fw-bold mb-4"><i class="fas fa-list me-2"></i> 詳細分析清單</h5>
        `;
        
        summarySection.innerHTML = summaryRow;
        detailList.innerHTML = allInventoriesDisplay.map(inv => 
            window.ConsumptionUtils.renderLocationDetailCard(inv, currentPartData.part_info.locations)
        ).join('<hr class="my-5 border-2 opacity-50">');
        
        label.innerHTML = `<i class="fas fa-chart-pie me-2 text-primary"></i>零件耗損詳細分析 (${currentPartData.part_info.part_number})`;
        
        // 確保模態視窗正確顯示
        const modalElement = document.getElementById('consumptionDetailModal');
        let consumptionModal = bootstrap.Modal.getInstance(modalElement);
        if (!consumptionModal) {
            consumptionModal = new bootstrap.Modal(modalElement);
        }
        consumptionModal.show();
        return;
    }
    
    // 建立可點擊的全區庫存分佈表格（在摘要資訊中）
    const allLocations = currentPartData.part_info.locations || [];
    let inventorySummaryHtml = '';
    
    if (window.ConsumptionUtils) {
        // 如果有多個儲位，在庫存摘要表格中加入點擊提示
        if (allLocations.length > 1) {
            inventorySummaryHtml = renderClickableInventorySummaryTable(currentPartData.inventories, targetLocationId);
        } else {
            inventorySummaryHtml = window.ConsumptionUtils.renderInventorySummaryTable(displayInventories);
        }
    }
    
    const summaryRow = `
        <div class="row mb-4 g-3">
            <div class="col-md-5">
                ${window.ConsumptionUtils ? window.ConsumptionUtils.renderPartBasicInfoCard(currentPartData.part_info) : '<div class="alert alert-warning">消耗分析工具未載入</div>'}
            </div>
            <div class="col-md-7">
                ${inventorySummaryHtml || '<div class="alert alert-warning">消耗分析工具未載入</div>'}
            </div>
        </div>
        <hr class="my-4 border-2 opacity-25">
        <h5 class="fw-bold mb-4"><i class="fas fa-list me-2"></i> 詳細分析清單 ${targetLocationId !== null ? '<small class="text-muted">(當前檢視單一儲位)</small>' : ''}</h5>
    `;
    
    label.innerHTML = `<i class="fas fa-chart-pie me-2 text-primary"></i>零件耗損詳細分析 (${currentPartData.part_info.part_number})`;
    
    if (window.ConsumptionUtils) {
        summarySection.innerHTML = summaryRow;
        detailList.innerHTML = displayInventories.map(inv => 
            window.ConsumptionUtils.renderLocationDetailCard(inv, currentPartData.part_info.locations)
        ).join('<hr class="my-5 border-2 opacity-50">');
    } else {
        summarySection.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>消耗分析工具未載入</h6>
                <p>請確保 consumption_utils.js 檔案已正確載入。</p>
            </div>
        `;
        detailList.innerHTML = '';
    }
    
    // 確保模態視窗正確顯示，避免backdrop問題
    const modalElement = document.getElementById('consumptionDetailModal');
    let consumptionModal = bootstrap.Modal.getInstance(modalElement);
    if (!consumptionModal) {
        consumptionModal = new bootstrap.Modal(modalElement);
    }
    
    // 清除可能存在的舊backdrop
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        if (backdrop.style.zIndex < 1055) {  // 只移除舊的backdrop
            backdrop.remove();
        }
    });
    
    consumptionModal.show();
}

// 渲染可點擊的庫存摘要表格
function renderClickableInventorySummaryTable(inventories, currentLocationId) {
    if (!inventories || inventories.length === 0) {
        return '<div class="alert alert-info">暫無庫存資料</div>';
    }
    
    const tableRows = inventories.map(inv => {
        const statusClass = inv.consumption_analysis?.stock_status === 'critical' ? 'text-danger fw-bold' :
                           inv.consumption_analysis?.stock_status === 'warning' ? 'text-warning fw-bold' : 
                           'text-success';
        const statusIcon = inv.consumption_analysis?.stock_status === 'critical' ? '🔴' :
                          inv.consumption_analysis?.stock_status === 'warning' ? '🟡' : '🟢';
        
        const isCurrentLocation = currentLocationId === inv.warehouse_location_id;
        const rowClass = isCurrentLocation ? 'table-warning' : '';
        const currentLabel = isCurrentLocation ? '<i class="fas fa-arrow-right me-1 text-primary"></i>' : '';
        
        return `
            <tr class="${rowClass} location-row" style="cursor: pointer;" onclick="showConsumptionAnalysis(${inv.warehouse_location_id})" title="點擊查看此儲位詳細分析">
                <td>${currentLabel}${inv.warehouse_name || 'N/A'}</td>
                <td>${inv.location_code || 'N/A'}</td>
                <td class="text-end">${inv.available_quantity || 0}</td>
                <td class="text-center ${statusClass}">${statusIcon}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card h-100">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="fas fa-warehouse me-2"></i>全區庫存分佈 <small class="text-muted">(點擊切換儲位)</small></h6>
            </div>
            <div class="card-body p-0">
                <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                    <table class="table table-sm table-hover mb-0">
                        <thead class="bg-light" style="position: sticky; top: 0; z-index: 1;">
                            <tr>
                                <th>倉庫</th>
                                <th>儲位</th>
                                <th class="text-end">可用庫存</th>
                                <th class="text-center">狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// 切換儲位 - 不關閉模態視窗，直接更新內容
// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    // 耗損分析按鈕事件
    const showConsumptionBtn = document.getElementById('showConsumptionAnalysisBtn');
    if (showConsumptionBtn) {
        showConsumptionBtn.addEventListener('click', showConsumptionAnalysis);
    }
});
