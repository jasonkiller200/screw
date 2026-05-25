let currentRegistrationId = null;
let currentRegistrationData = null;
let currentPartData = null; // 用於儲存零件詳情資料供耗損分析使用
let currentClickedLocationId = null; // 用於跟蹤當前點擊的儲位ID

// 儲存頁面載入後查到的重複資訊 { regId: { count, items } }
let pendingInboundCache = {};

// 初始化：清理可能殘留的 backdrop
document.addEventListener('DOMContentLoaded', function() {
    // 清理頁面加載時可能殘留的 backdrop
    cleanupBackdrops();
    
    // 為所有模態添加關閉事件監聯
    const modals = ['rejectModal', 'modifyModal', 'consumptionDetailModal'];
    modals.forEach(modalId => {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement.addEventListener('hidden.bs.modal', function () {
                cleanupBackdrops();
                document.body.classList.remove('modal-open');
                document.body.style.overflow = '';
                document.body.style.paddingRight = '';
            });
        }
    });

    // 頁面載入後：批量檢查所有待審查項目是否有重複
    checkAllPendingInbound();
});

// 清理 backdrop 的通用函數
function cleanupBackdrops() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
}

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
        
        // 清除舊的 backdrop 避免層疊
        cleanupBackdrops();
        
        const modalElement = document.getElementById('rejectModal');
        const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement, {
            backdrop: true,
            keyboard: true,
            focus: true
        });
        
        // 清空輸入框
        document.getElementById('rejectReason').value = '';
        
        modal.show();
        
        // 確保焦點在輸入框上
        setTimeout(() => {
            const rejectReasonField = document.getElementById('rejectReason');
            if (rejectReasonField) {
                rejectReasonField.focus();
            }
        }, 300);
        
        return;
    }
    
    // 核准操作：先檢查重複
    checkBeforeApprove(registrationId, function() {
        submitReview(registrationId, action, '');
    });
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
    
    const registrationIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    // 檢查選中項目中有多少有重複
    let duplicateCount = 0;
    let duplicateDetails = [];
    registrationIds.forEach(id => {
        if (pendingInboundCache[id]) {
            duplicateCount++;
            const row = document.querySelector(`tr[data-reg-id="${id}"]`);
            const pn = row ? row.dataset.partNumber : `ID:${id}`;
            duplicateDetails.push(pn);
        }
    });
    
    let confirmMsg = `確定要通過選中的 ${checkedBoxes.length} 個申請項目嗎？`;
    if (duplicateCount > 0) {
        confirmMsg = `⚠️ 選中的 ${checkedBoxes.length} 個項目中，有 ${duplicateCount} 個存在待入庫/已登記的重複項目：\n\n` +
                     duplicateDetails.join('、') +
                     `\n\n確定要全部通過嗎？`;
    }
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
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
    
    // 清除舊的 backdrop 避免層疊
    cleanupBackdrops();
    
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
            const modalElement = document.getElementById('modifyModal');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
            modal.show();
            
            // 確保焦點在數量輸入框上
            setTimeout(() => {
                const quantityField = document.getElementById('modifiedQuantity');
                if (quantityField) {
                    quantityField.focus();
                    quantityField.select();
                }
            }, 300);
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
    
    // 隱藏模態框
    bootstrap.Modal.getInstance(document.getElementById('modifyModal')).hide();

    // 修改數量後核准：也先檢查重複
    checkBeforeApprove(currentRegistrationId, function() {
        if (modifiedQuantity === currentRegistrationData.quantity) {
            submitReview(currentRegistrationId, 'approved', modifyReason);
        } else {
            submitReview(currentRegistrationId, 'approved', modifyReason, modifiedQuantity);
        }
    });
}

// 渲染單一儲位詳情（不顯示切換功能，專用於週期訂單）
function renderSingleLocationDetailOnly(part, inventory, allInventories, locationId) {
    let warehouse, location, quantity, reserved_quantity, available;
    const currentIdleAnalysis = inventory?.idle_analysis || null;
    const currentIdleDisplay = formatIdleAnalysis(currentIdleAnalysis);
    
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
            const idleDisplay = formatIdleAnalysis(inv?.idle_analysis);

            return `
                <tr>
                    <td>${loc.warehouse_name} (${loc.warehouse_code})</td>
                    <td>${loc.location_code}</td>
                    <td class="text-end">${quantity_on_hand}</td>
                    <td class="text-end">${reserved_quantity}</td>
                    <td class="text-end"><strong>${available_quantity}</strong></td>
                    <td>${idleDisplay.lastConsumptionLabel}</td>
                    <td class="text-center"><span class="badge ${idleDisplay.badgeClass}">${idleDisplay.idleDaysLabel}</span></td>
                </tr>
            `;
        }).join('');
    } else {
        inventoryHtml = '<tr><td colspan="7" class="text-center text-muted">此零件未設定儲位</td></tr>';
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
    if (!currentPartData) {
        alert('無零件資料');
        return;
    }
    
    // 如果沒有庫存資料，顯示週期採購資訊
    if (!currentPartData.inventories || currentPartData.inventories.length === 0) {
        showWeeklyOrderInfoForPartWithoutLocation(currentPartData.part_info);
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
        const available = inv.available_quantity || 0;
        const statusClass = inv.consumption_analysis?.stock_status === 'critical' ? 'text-danger fw-bold' :
                           inv.consumption_analysis?.stock_status === 'warning' ? 'text-warning fw-bold' : 
                           'text-success';
        const statusIcon = inv.consumption_analysis?.stock_status === 'critical' ? '🔴' :
                          inv.consumption_analysis?.stock_status === 'warning' ? '🟡' : '🟢';
        
        const isCurrentLocation = currentLocationId === inv.warehouse_location_id;
        const rowClass = isCurrentLocation ? 'table-warning' : '';
        const currentLabel = isCurrentLocation ? '<i class="fas fa-arrow-right me-1 text-primary"></i>' : '';
        
        // 取得耗損分析資料
        const analysis = inv.consumption_analysis || {};
        const avgDaily = analysis.avg_daily_consumption || 0;
        const daysOfStock = analysis.days_of_stock || 0;
        
        // 格式化日平均用量
        const avgDailyText = avgDaily > 0 ? avgDaily.toFixed(1) : '-';
        
        // 格式化庫存天數，並根據天數設定顏色
        let daysText = '-';
        let daysClass = '';
        if (avgDaily > 0 && available > 0) {
            daysText = daysOfStock.toFixed(1);
            if (daysOfStock < 7) {
                daysClass = 'text-danger fw-bold';
            } else if (daysOfStock < 14) {
                daysClass = 'text-warning fw-bold';
            } else {
                daysClass = 'text-success';
            }
        } else if (available <= 0) {
            daysText = '0.0';
            daysClass = 'text-danger fw-bold';
        }
        
        return `
            <tr class="${rowClass} location-row" style="cursor: pointer;" onclick="showConsumptionAnalysis(${inv.warehouse_location_id})" title="點擊查看此儲位詳細分析">
                <td>${currentLabel}${inv.warehouse_name || 'N/A'}</td>
                <td>${inv.location_code || 'N/A'}</td>
                <td class="text-end">${available}</td>
                <td class="text-end text-muted">${avgDailyText}</td>
                <td class="text-end ${daysClass}">${daysText}</td>
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
                                <th class="text-end">日平均用量</th>
                                <th class="text-end">庫存天數</th>
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

// 顯示沒有儲位的零件的週期採購資訊
function showWeeklyOrderInfoForPartWithoutLocation(partInfo) {
    const summarySection = document.getElementById('consumptionSummarySection');
    const detailList = document.getElementById('consumptionDetailList');
    const label = document.getElementById('consumptionDetailModalLabel');
    
    if (!summarySection || !detailList || !label) {
        alert('模態視窗元素未找到');
        return;
    }
    
    label.innerHTML = `<i class="fas fa-info-circle me-2 text-primary"></i>零件資訊 (${partInfo.part_number})`;
    
    // 載入週期採購資訊
    fetch(`/api/part/${encodeURIComponent(partInfo.part_number)}/weekly-orders`)
        .then(r => r.json())
        .then(weeklyOrderData => {
            const summaryHtml = `
                <div class="alert alert-info mb-3">
                    <i class="fas fa-info-circle me-2"></i>此零件尚未設定儲位，僅顯示基本資訊與近期週期採購記錄
                </div>
                <div class="row mb-4 g-3">
                    <div class="col-md-12">
                        ${window.ConsumptionUtils ? window.ConsumptionUtils.renderPartBasicInfoCard(partInfo) : '<div class="alert alert-warning">消耗分析工具未載入</div>'}
                    </div>
                </div>
            `;
            
            let detailHtml = '<h5 class="fw-bold mb-4"><i class="fas fa-calendar-week me-2"></i>近期週期採購記錄</h5>';
            
            if (weeklyOrderData && weeklyOrderData.registrations && weeklyOrderData.registrations.length > 0) {
                // 只顯示最近的記錄
                const recentOrders = weeklyOrderData.registrations.slice(0, 10);
                
                detailHtml += `
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead class="table-light">
                                <tr>
                                    <th>週期</th>
                                    <th>申請日期</th>
                                    <th>申請人</th>
                                    <th class="text-end">申請數量</th>
                                    <th class="text-end">已入庫</th>
                                    <th>狀態</th>
                                    <th>備註</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentOrders.map(order => {
                                    const statusBadge = getWeeklyOrderStatusBadge(order.status);
                                    const createdDate = order.created_at ? new Date(order.created_at).toLocaleDateString('zh-TW') : '-';
                                    const quantityReceived = order.quantity_received || 0;
                                    const quantityOrdered = order.quantity || 0;
                                    const progressPercent = quantityOrdered > 0 ? Math.round((quantityReceived / quantityOrdered) * 100) : 0;
                                    
                                    return `
                                        <tr>
                                            <td><strong>${order.cycle_name || '-'}</strong></td>
                                            <td>${createdDate}</td>
                                            <td>${order.applicant_name || '-'}</td>
                                            <td class="text-end">${quantityOrdered}</td>
                                            <td class="text-end">
                                                ${quantityReceived}
                                                ${quantityOrdered > 0 ? `<small class="text-muted">(${progressPercent}%)</small>` : ''}
                                            </td>
                                            <td>${statusBadge}</td>
                                            <td><small class="text-muted">${order.purpose_notes || '-'}</small></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                
                // 統計資訊
                const totalOrdered = recentOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
                const totalReceived = recentOrders.reduce((sum, o) => sum + (o.quantity_received || 0), 0);
                const pendingCount = recentOrders.filter(o => o.status === 'registered' || o.status === 'approved').length;
                
                detailHtml += `
                    <div class="row mt-4">
                        <div class="col-md-4">
                            <div class="card border-primary">
                                <div class="card-body text-center">
                                    <h3 class="text-primary mb-0">${totalOrdered}</h3>
                                    <small class="text-muted">總申請數量</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card border-success">
                                <div class="card-body text-center">
                                    <h3 class="text-success mb-0">${totalReceived}</h3>
                                    <small class="text-muted">已入庫數量</small>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card border-warning">
                                <div class="card-body text-center">
                                    <h3 class="text-warning mb-0">${pendingCount}</h3>
                                    <small class="text-muted">待處理申請</small>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                detailHtml += `
                    <div class="alert alert-secondary">
                        <i class="fas fa-inbox me-2"></i>此零件暫無週期採購記錄
                    </div>
                `;
            }
            
            summarySection.innerHTML = summaryHtml;
            detailList.innerHTML = detailHtml;
            
            // 顯示模態視窗
            const modalElement = document.getElementById('consumptionDetailModal');
            let modal = bootstrap.Modal.getInstance(modalElement);
            if (!modal) {
                modal = new bootstrap.Modal(modalElement);
            }
            modal.show();
        })
        .catch(err => {
            console.error('載入週期採購資訊失敗:', err);
            summarySection.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>此零件尚未設定儲位
                </div>
            `;
            detailList.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-times-circle me-2"></i>載入週期採購資訊失敗：${err.message}
                </div>
            `;
            
            // 顯示模態視窗
            const modalElement = document.getElementById('consumptionDetailModal');
            let modal = bootstrap.Modal.getInstance(modalElement);
            if (!modal) {
                modal = new bootstrap.Modal(modalElement);
            }
            modal.show();
        });
}

// 取得週期訂單狀態徽章
function getWeeklyOrderStatusBadge(status) {
    const statusMap = {
        'registered': { text: '已登記', class: 'secondary' },
        'approved': { text: '已核准', class: 'primary' },
        'partially_received': { text: '部分到貨', class: 'info' },
        'completed': { text: '已完成', class: 'success' },
        'rejected': { text: '已拒絕', class: 'danger' }
    };
    
    const statusInfo = statusMap[status] || { text: status || '未知', class: 'secondary' };
    return `<span class="badge bg-${statusInfo.class}">${statusInfo.text}</span>`;
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

// ============================================================================
// 防重複訂購檢查功能
// ============================================================================

/**
 * 頁面載入時：批量檢查所有待審查項目是否存在待入庫/已登記的重複項目
 * 查到的結果存入 pendingInboundCache，並在表格行上顯示 ⚠️ 標記
 */
function checkAllPendingInbound() {
    const rows = document.querySelectorAll('tr.registration-row[data-status="registered"]');
    if (rows.length === 0) return;

    // 收集所有待審查項目
    const items = [];
    rows.forEach(row => {
        items.push({
            part_number: row.dataset.partNumber,
            warehouse_location_id: row.dataset.locationId || null,
            exclude_id: row.dataset.regId  // 排除自身
        });
    });

    fetch('/api/weekly-orders/check-pending-inbound-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items })
    })
    .then(r => r.json())
    .then(data => {
        if (!data.results) return;

        rows.forEach(row => {
            const pn = row.dataset.partNumber;
            const locId = row.dataset.locationId || 'any';
            const key = `${pn}_${locId}`;
            const regId = row.dataset.regId;
            const result = data.results[key];

            if (result && result.has_pending) {
                // 存入快取
                pendingInboundCache[regId] = result;

                // 更新行樣式
                row.classList.add('row-has-duplicate');

                // 在狀態欄插入 ⚠️ badge
                const badgeContainer = row.querySelector(`.pending-inbound-badge[data-reg-id="${regId}"]`);
                if (badgeContainer) {
                    const badge = document.createElement('span');
                    badge.className = 'badge bg-warning text-dark badge-duplicate ms-1';
                    badge.setAttribute('tabindex', '0');
                    badge.setAttribute('data-bs-toggle', 'popover');
                    badge.setAttribute('data-bs-trigger', 'click');
                    badge.setAttribute('data-bs-html', 'true');
                    badge.setAttribute('data-bs-placement', 'left');
                    badge.setAttribute('title', `⚠️ 已有 ${result.count} 筆待處理`);
                    badge.setAttribute('data-bs-content', formatPendingItemsTable(result.items));
                    badge.innerHTML = `⚠️ ${result.count}`;
                    badgeContainer.appendChild(badge);

                    // 初始化 popover
                    new bootstrap.Popover(badge, {
                        container: 'body',
                        sanitize: false
                    });
                }
            }
        });
    })
    .catch(err => {
        console.warn('批量檢查待入庫項目失敗:', err);
    });
}

/**
 * 單筆核准前檢查：如有待入庫項目，彈出確認對話框
 * @param {number} registrationId - 登記項目 ID
 * @param {Function} onConfirm - 確認後的回調
 */
function checkBeforeApprove(registrationId, onConfirm) {
    // 先檢查快取
    const cached = pendingInboundCache[registrationId];
    if (cached && cached.has_pending) {
        const msg = buildApproveConfirmMessage(cached);
        if (confirm(msg)) {
            onConfirm();
        }
        return;
    }

    // 快取未命中，即時查詢
    const row = document.querySelector(`tr[data-reg-id="${registrationId}"]`);
    if (!row) {
        onConfirm();
        return;
    }

    const partNumber = row.dataset.partNumber;
    const locationId = row.dataset.locationId || null;

    fetch('/api/weekly-orders/check-pending-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            part_number: partNumber,
            warehouse_location_id: locationId,
            exclude_id: registrationId
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.has_pending) {
            pendingInboundCache[registrationId] = data;
            const msg = buildApproveConfirmMessage(data);
            if (confirm(msg)) {
                onConfirm();
            }
        } else {
            onConfirm();
        }
    })
    .catch(err => {
        console.warn('檢查待入庫項目失敗，直接繼續:', err);
        onConfirm();
    });
}

/**
 * 建構核准確認對話框訊息
 */
function buildApproveConfirmMessage(data) {
    let msg = `⚠️ 此零件已有 ${data.items.length} 筆待處理項目：\n\n`;

    data.items.forEach(item => {
        const loc = item.location_display || '未指定儲位';
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString('zh-TW') : '-';
        if (item.type === 'pending_inbound') {
            msg += `• [${item.status_text}] ${item.quantity} 個 (已入庫 ${item.quantity_received}，剩餘 ${item.remaining}) - ${item.applicant_name} (${date})\n`;
        } else {
            msg += `• [${item.status_text}] ${item.quantity} 個 - ${item.applicant_name} (${date})\n`;
        }
        msg += `  儲位: ${loc}\n`;
    });

    msg += '\n確定要核准此申請嗎？';
    return msg;
}

/**
 * 格式化待入庫項目為 HTML 表格（用於 popover）
 */
function formatPendingItemsTable(items) {
    if (!items || items.length === 0) return '無資料';

    let html = '<table class="table table-sm table-bordered">';
    html += '<thead><tr><th>狀態</th><th>數量</th><th>剩餘</th><th>申請人</th><th>日期</th></tr></thead><tbody>';

    items.forEach(item => {
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString('zh-TW') : '-';
        const statusClass = item.type === 'pending_inbound' ? 'text-primary' : 'text-secondary';
        html += `<tr>
            <td class="${statusClass}"><small>${item.status_text}</small></td>
            <td class="text-end">${item.quantity}</td>
            <td class="text-end">${item.remaining}</td>
            <td><small>${item.applicant_name}</small></td>
            <td><small>${date}</small></td>
        </tr>`;
    });

    html += '</tbody></table>';
    if (items.length > 0 && items[0].location_display) {
        html += `<small class="text-muted">儲位: ${items[0].location_display}</small>`;
    }
    return html;
}
