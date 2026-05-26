// 追蹤每行的原始值
const originalValues = new Map();

// 標記該行有未儲存的變更
function markRowAsModified(row, isModified) {
    const saveBtn = row.querySelector('.save-stock-levels-btn');
    
    if (isModified) {
        // 標記為已修改
        row.classList.add('row-modified');
        saveBtn.classList.remove('btn-outline-primary');
        saveBtn.classList.add('btn-warning');
        saveBtn.innerHTML = '<i class="fas fa-save"></i> 儲存變更';
        saveBtn.title = '有未儲存的變更，點擊儲存';
        
        // 閃爍提示
        saveBtn.style.animation = 'pulse 1.5s ease-in-out 3';
    } else {
        // 移除修改標記
        row.classList.remove('row-modified');
        saveBtn.classList.remove('btn-warning');
        saveBtn.classList.add('btn-outline-primary');
        saveBtn.innerHTML = '<i class="fas fa-save"></i>';
        saveBtn.title = '儲存變更';
        saveBtn.style.animation = '';
    }
}

// 檢查值是否有變更
function checkIfModified(inputElement) {
    const row = inputElement.closest('.inventory-row');
    const partId = row.dataset.partId;
    const locationId = row.dataset.locationId;
    const key = `${partId}-${locationId}`;
    
    const safetyStockInput = row.querySelector('.safety-stock-input');
    const reorderPointInput = row.querySelector('.reorder-point-input');
    
    const currentSafety = parseFloat(safetyStockInput.value) || 0;
    const currentReorder = parseFloat(reorderPointInput.value) || 0;
    
    const original = originalValues.get(key);
    if (!original) {
        // 初始化原始值
        originalValues.set(key, {
            safety: currentSafety,
            reorder: currentReorder
        });
        return false;
    }
    
    // 檢查是否有變更
    const isModified = (currentSafety !== original.safety) || (currentReorder !== original.reorder);
    markRowAsModified(row, isModified);
    
    return isModified;
}

// 驗證安全庫存和補貨點的合理性
function validateStockLevels(inputElement) {
    const row = inputElement.closest('.inventory-row');
    const safetyStockInput = row.querySelector('.safety-stock-input');
    const reorderPointInput = row.querySelector('.reorder-point-input');
    
    const safetyStock = parseFloat(safetyStockInput.value) || 0;
    const reorderPoint = parseFloat(reorderPointInput.value) || 0;
    
    // 檢查是否有變更
    checkIfModified(inputElement);
    
    // 移除舊的警告樣式
    safetyStockInput.classList.remove('is-invalid', 'border-warning');
    reorderPointInput.classList.remove('is-invalid', 'border-warning');
    
    // 移除舊的提示訊息
    const oldFeedback = row.querySelectorAll('.invalid-feedback, .warning-feedback');
    oldFeedback.forEach(el => el.remove());
    
    let hasError = false;
    let hasWarning = false;
    
    // 檢查補貨點是否小於安全庫存（錯誤）
    if (reorderPoint > 0 && safetyStock > 0 && reorderPoint < safetyStock) {
        reorderPointInput.classList.add('is-invalid');
        const feedback = document.createElement('div');
        feedback.className = 'invalid-feedback d-block';
        feedback.style.fontSize = '0.7rem';
        feedback.innerHTML = '<i class="fas fa-exclamation-circle"></i> 補貨點不應小於安全庫存';
        reorderPointInput.parentElement.appendChild(feedback);
        hasError = true;
    }
    
    // 檢查補貨點是否等於安全庫存（警告）
    if (!hasError && reorderPoint > 0 && safetyStock > 0 && reorderPoint === safetyStock) {
        reorderPointInput.classList.add('border-warning');
        const feedback = document.createElement('div');
        feedback.className = 'warning-feedback d-block text-warning';
        feedback.style.fontSize = '0.7rem';
        feedback.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 建議補貨點 = (日用量 × 前置期) + 安全庫存';
        reorderPointInput.parentElement.appendChild(feedback);
        hasWarning = true;
    }
    
    // 更新提示文字顏色
    const hintText = row.querySelector('.reorder-hint .hint-text');
    if (hintText) {
        if (hasError) {
            hintText.className = 'hint-text text-danger';
            hintText.innerHTML = '必須 ≥ 安全庫存';
        } else if (hasWarning) {
            hintText.className = 'hint-text text-warning';
            hintText.innerHTML = '建議使用公式計算';
        } else if (reorderPoint > safetyStock) {
            hintText.className = 'hint-text text-success';
            hintText.innerHTML = '✓ 設定合理';
        } else {
            hintText.className = 'hint-text';
            hintText.innerHTML = '應 ≥ 安全庫存';
        }
    }
    
    return !hasError;
}

// 快速入庫
function quickStockIn(partNumber, locationId) {
    document.getElementById('quickActionTitle').textContent = '快速入庫';
    document.getElementById('actionPartNumber').value = partNumber;
    document.getElementById('actionLocationId').value = locationId;
    document.getElementById('actionType').value = 'IN';
    document.getElementById('displayPartNumber').value = partNumber;
    document.getElementById('actionQuantity').value = '';
    document.getElementById('actionNotes').value = '';
    
    document.getElementById('transactionTypeInGroup').style.display = 'block';
    document.getElementById('transactionTypeOutGroup').style.display = 'none';
    document.getElementById('workOrderGroup').style.display = 'none';

    const modal = new bootstrap.Modal(document.getElementById('quickActionModal'));
    modal.show();
}

// 快速出庫
function quickStockOut(partNumber, locationId) {
    document.getElementById('quickActionTitle').textContent = '快速出庫';
    document.getElementById('actionPartNumber').value = partNumber;
    document.getElementById('actionLocationId').value = locationId;
    document.getElementById('actionType').value = 'OUT';
    document.getElementById('displayPartNumber').value = partNumber;
    document.getElementById('actionQuantity').value = '';
    document.getElementById('actionNotes').value = '';

    document.getElementById('transactionTypeInGroup').style.display = 'none';
    document.getElementById('transactionTypeOutGroup').style.display = 'block';
    
    const transactionTypeOut = document.getElementById('actionTransactionTypeOut');
    const workOrderIdInput = document.getElementById('actionWorkOrderId');
    const actionNotesInput = document.getElementById('actionNotes');

    if (transactionTypeOut.value === 'OUT_WORK_ORDER') {
        document.getElementById('workOrderGroup').style.display = 'block';
        if (workOrderIdInput.value) {
            actionNotesInput.value = `工單領用 - 工單編號: ${workOrderIdInput.value}`;
        }
    } else {
        document.getElementById('workOrderGroup').style.display = 'none';
        actionNotesInput.value = '';
    }
    validateQuickActionWorkOrderId();
    const modal = new bootstrap.Modal(document.getElementById('quickActionModal'));
    modal.show();
}

document.getElementById('actionTransactionTypeOut').addEventListener('change', function() {
    const workOrderGroup = document.getElementById('workOrderGroup');
    const workOrderIdInput = document.getElementById('actionWorkOrderId');
    const actionNotesInput = document.getElementById('actionNotes');

    if (this.value === 'OUT_WORK_ORDER') {
        workOrderGroup.style.display = 'block';
        if (workOrderIdInput.value) {
            actionNotesInput.value = `工單領用 - 工單編號: ${workOrderIdInput.value}`;
        }
    } else {
        workOrderGroup.style.display = 'none';
        actionNotesInput.value = '';
    }
    validateQuickActionWorkOrderId();
});

document.getElementById('actionWorkOrderId').addEventListener('input', function() {
    const transactionTypeOut = document.getElementById('actionTransactionTypeOut');
    const actionNotesInput = document.getElementById('actionNotes');
    if (transactionTypeOut.value === 'OUT_WORK_ORDER') {
        if (this.value) {
            actionNotesInput.value = `工單領用 - 工單編號: ${this.value}`;
        } else {
            actionNotesInput.value = '工單領用 - 工單編號: ';
        }
    }
    validateQuickActionWorkOrderId();
});

document.getElementById('submitQuickAction').addEventListener('click', function() {
    const partNumber = document.getElementById('actionPartNumber').value;
    const locationId = document.getElementById('actionLocationId').value;
    const actionType = document.getElementById('actionType').value;
    const quantity = document.getElementById('actionQuantity').value;
    const notes = document.getElementById('actionNotes').value;
    
    if (!quantity || quantity <= 0) {
        alert('請輸入有效的數量');
        return;
    }
    
    let url;
    let payload;
    if (actionType === 'IN') {
        url = '/api/inventory/stock-in';
        const transactionType = document.getElementById('actionTransactionTypeIn').value;
        if (!transactionType) {
            alert('請選擇一個有效的入庫類型');
            return;
        }
        payload = {
            part_number: partNumber,
            warehouse_location_id: parseInt(locationId),
            quantity: parseInt(quantity),
            transaction_type: transactionType,
            notes: notes
        };
    } else {
        url = '/api/inventory/stock-out';
        const transactionType = document.getElementById('actionTransactionTypeOut').value;
        if (!transactionType) {
            alert('請選擇一個有效的出庫類型');
            return;
        }

        if (transactionType === 'OUT_WORK_ORDER' && !validateQuickActionWorkOrderId()) {
            alert('請修正工單編號。');
            return;
        }

        payload = {
            part_number: partNumber,
            warehouse_location_id: parseInt(locationId),
            quantity: parseInt(quantity),
            transaction_type: transactionType,
            notes: notes
        };
        if (transactionType === 'OUT_WORK_ORDER') {
            payload.work_order_id = document.getElementById('actionWorkOrderId').value;
        }
    }
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message || '操作成功！');
                location.reload();
            } else {
                alert(data.error || '操作失敗');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('操作失敗，請稍後再試');
        });
});

function validateQuickActionWorkOrderId() {
    const transactionTypeOut = document.getElementById('actionTransactionTypeOut');
    const workOrderIdInput = document.getElementById('actionWorkOrderId');

    if (transactionTypeOut.value !== 'OUT_WORK_ORDER') {
        workOrderIdInput.classList.remove('is-invalid');
        return true;
    }

    const workOrderId = workOrderIdInput.value.trim();
    const isValid = /^\d{5}$/.test(workOrderId);
    workOrderIdInput.classList.toggle('is-invalid', !isValid);
    return isValid;
}

function exportInventory() {
    const urlParams = new URLSearchParams(window.location.search);
    const warehouseId = urlParams.get('warehouse_id') || '';
    const exportUrl = warehouseId ? `/api/inventory/stock/export?warehouse_id=${warehouseId}` : '/api/inventory/stock/export';
    window.open(exportUrl, '_blank');
}

function exportAllInventory() {
    window.open('/api/export/all-inventory-excel', '_blank');
}

function exportLowStock() {
    const urlParams = new URLSearchParams(window.location.search);
    const warehouseId = urlParams.get('warehouse_id') || '';
    const exportUrl = warehouseId ? `/api/export/low-stock-excel?warehouse_id=${warehouseId}` : '/api/export/low-stock-excel';
    window.open(exportUrl, '_blank');
}

function showExportOptions() {
    const modal = new bootstrap.Modal(document.getElementById('exportOptionsModal'));
    modal.show();
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.inventory-row').forEach(row => {
        const partId = row.dataset.partId;
        const locationId = row.dataset.locationId;
        const key = `${partId}-${locationId}`;

        const safetyStockInput = row.querySelector('.safety-stock-input');
        const reorderPointInput = row.querySelector('.reorder-point-input');

        originalValues.set(key, {
            safety: parseFloat(safetyStockInput.value) || 0,
            reorder: parseFloat(reorderPointInput.value) || 0
        });

        safetyStockInput.addEventListener('input', function() {
            validateStockLevels(this);
        });

        reorderPointInput.addEventListener('input', function() {
            validateStockLevels(this);
        });

        const saveButton = row.querySelector('.save-stock-levels-btn');
        saveButton.addEventListener('click', function() {
            const button = this;
            const safetyStock = parseInt(safetyStockInput.value) || 0;
            const reorderPoint = parseInt(reorderPointInput.value) || 0;

            if (reorderPoint < safetyStock) {
                const partNumber = row.dataset.partNumber;
                const partName = row.dataset.partName;

                alert(
                    `❌ 補貨點設定錯誤，無法儲存\n\n` +
                    `零件：${partNumber} - ${partName}\n` +
                    `安全庫存：${safetyStock}\n` +
                    `補貨點：${reorderPoint}\n\n` +
                    `❌ 補貨點 (${reorderPoint}) 不能小於安全庫存 (${safetyStock})\n\n` +
                    `📝 建議公式：\n` +
                    `補貨點 = (平均每日用量 × 採購前置期) + 安全庫存\n\n` +
                    `範例：日用量100個 × 前置期5天 + 安全庫存300 = 800`
                );

                validateStockLevels(reorderPointInput);
                return;
            } else if (reorderPoint === safetyStock && reorderPoint > 0) {
                const confirmed = confirm(
                    `⚠️ 補貨點設定提醒\n\n` +
                    `補貨點 (${reorderPoint}) 等於安全庫存 (${safetyStock})\n\n` +
                    `📝 建議使用公式計算：\n` +
                    `補貨點 = (平均每日用量 × 採購前置期) + 安全庫存\n\n` +
                    `範例：日用量100個 × 前置期5天 + 安全庫存300 = 800\n\n` +
                    `是否繼續儲存？`
                );

                if (!confirmed) {
                    return;
                }
            }

            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            fetch(`/api/parts/${partId}/update_inventory_policy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    warehouse_id: row.dataset.warehouseId,
                    warehouse_location_id: row.dataset.locationId,
                    safety_stock: safetyStock,
                    reorder_point: reorderPoint,
                }),
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.error || '伺服器錯誤'); });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const saveKey = `${partId}-${row.dataset.locationId}`;
                    originalValues.set(saveKey, {
                        safety: safetyStock,
                        reorder: reorderPoint
                    });

                    markRowAsModified(row, false);

                    row.style.transition = 'background-color 0.5s ease';
                    row.style.backgroundColor = '#d4edda';

                    const successMsg = document.createElement('div');
                    successMsg.className = 'alert alert-success alert-dismissible fade show position-fixed';
                    successMsg.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
                    successMsg.innerHTML = `
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>設定已儲存</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    `;
                    document.body.appendChild(successMsg);

                    setTimeout(() => {
                        row.style.backgroundColor = '';
                        successMsg.remove();
                    }, 3000);

                    validateStockLevels(reorderPointInput);
                } else {
                    throw new Error(data.error || '更新失敗');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`❌ 更新失敗: ${error.message}`);
                row.style.backgroundColor = '#f8d7da';
                setTimeout(() => {
                    row.style.backgroundColor = '';
                }, 2000);
            })
            .finally(() => {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-save"></i>';
            });
        });
    });
});

function getCurrentPartData() {
    return window.PartDetailModal ? window.PartDetailModal.getCurrentPartData() : null;
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

// 切換顯示所有儲位
function showAllLocations() {
    currentClickedLocationId = null;
    if (currentPartData) {
        const part = currentPartData.part_info;
        const inventories = currentPartData.inventories;
        const orders = currentPartData.orders;
        const detailContent = document.getElementById('partDetailContent');
        detailContent.innerHTML = renderAllLocationsOverview(part, inventories, orders);
    }
}

// 計算儲位健康度
function calculateLocationHealth(available, total) {
    let healthInfo = {
        badgeClass: 'bg-secondary',
        icon: '❓',
        text: '未知',
        tooltip: '無法判斷庫存狀況'
    };
    
    if (total === 0) {
        healthInfo = {
            badgeClass: 'bg-light text-dark',
            icon: '⚪',
            text: '無庫存',
            tooltip: '此儲位目前無庫存'
        };
    } else if (available <= 0) {
        healthInfo = {
            badgeClass: 'bg-danger',
            icon: '🔴',
            text: '缺貨',
            tooltip: '可用庫存為零，需要補貨'
        };
    } else if (available <= 3) {
        healthInfo = {
            badgeClass: 'bg-warning',
            icon: '🟡',
            text: '偏低',
            tooltip: '庫存偏低，建議關注補貨'
        };
    } else if (available <= 10) {
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

// 檢查週期訂單系統相容性
function checkWeeklyOrderCompatibility(weeklyOrderData) {
    if (!weeklyOrderData) {
        return '週期訂單資料載入失敗或模組未啟用';
    }
    
    if (weeklyOrderData.error) {
        return `週期訂單 API 錯誤：${weeklyOrderData.error}`;
    }
    
    if (!weeklyOrderData.hasOwnProperty('registrations')) {
        return '週期訂單資料格式不相容，缺少 registrations 欄位';
    }
    
    if (!Array.isArray(weeklyOrderData.registrations)) {
        return '週期訂單資料格式錯誤，registrations 應為陣列格式';
    }
    
    // 檢查資料結構
    if (weeklyOrderData.registrations.length > 0) {
        const firstReg = weeklyOrderData.registrations[0];
        const requiredFields = ['warehouse_location_id', 'status', 'quantity'];
        const missingFields = requiredFields.filter(field => !firstReg.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            return `週期訂單資料缺少必要欄位：${missingFields.join(', ')}`;
        }
    }
    
    return null; // 無錯誤
}

// 輔助函數：獲取狀態徽章樣式
function getStatusBadgeClass(status) {
    switch(status) {
        case 'approved': return 'bg-success';
        case 'completed': return 'bg-primary';
        case 'partially_received': return 'bg-warning';
        case 'rejected': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

// 輔助函數：獲取狀態文字
function getStatusText(status) {
    switch(status) {
        case 'registered': return '已登記';
        case 'approved': return '已核准';
        case 'completed': return '已完成';
        case 'partially_received': return '部分入庫';
        case 'rejected': return '已拒絕';
        default: return status || 'N/A';
    }
}

// 清理模態視窗背景遮罩的輔助函數
function cleanupModalBackdrops() {
    // 移除所有殘留的背景遮罩
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
    
    // 重置body樣式
    document.body.classList.remove('modal-open');
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
}

// 顯示耗損分析
function showConsumptionAnalysis() {
    if (!currentPartData || !currentPartData.inventories || currentPartData.inventories.length === 0) {
        alert('無庫存資料可分析');
        return;
    }
    
    // 嘗試獲取分離的容器（新版結構）
    const summarySection = document.getElementById('consumptionSummarySection');
    const detailList = document.getElementById('consumptionDetailList');
    const label = document.getElementById('consumptionDetailModalLabel');
    
    // 如果找不到新版結構，嘗試舊版結構（兼容性）
    const legacyContent = document.getElementById('consumptionDetailContent');
    
    if ((!summarySection || !detailList) && !legacyContent) {
        alert('耗損分析模態視窗元素未找到');
        return;
    }
    
    if (!label) {
        console.error('Modal label element not found');
        return;
    }
    
    // 先隱藏零件詳情模態視窗，等待完全關閉後再打開耗損分析模態視窗
    const partDetailModalElement = document.getElementById('partDetailModal');
    const partDetailModal = bootstrap.Modal.getInstance(partDetailModalElement);
    
    // 準備內容的函數
    function prepareAndShowModal() {
        label.innerHTML = `<i class="fas fa-chart-pie me-2 text-primary"></i>零件耗損詳細分析 (${currentPartData.part_info.part_number})`;
        
        if (window.ConsumptionUtils) {
            // 確保 switchLocationDetail 全域可用
            window.switchLocationDetail = switchLocationDetail;

            // 1. 決定初始顯示的儲位
            let initialLocationId = null;
            
            if (currentClickedLocationId) {
                const exists = currentPartData.inventories.some(inv => inv.warehouse_location_id === currentClickedLocationId);
                if (exists) {
                    initialLocationId = currentClickedLocationId;
                }
            }
            
            if (!initialLocationId && currentPartData.inventories.length > 0) {
                initialLocationId = currentPartData.inventories[0].warehouse_location_id;
            }

            // 2. 準備基本資料與庫存分佈內容
            const partNumber = currentPartData.part_info.part_number;
            const originalSummaryTable = window.ConsumptionUtils.renderInventorySummaryTable(currentPartData.inventories);
            const enhancedSummaryTable = enhanceInventorySummaryTableWithClicks(originalSummaryTable, partNumber, currentPartData.inventories);
            
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
            
            // 填入上方摘要區域
            if (summarySection) {
                summarySection.innerHTML = summaryHtml;
            } else if (legacyContent) {
                legacyContent.innerHTML = `<div class="sticky-top bg-white border-bottom p-3 mb-3">${summaryHtml}</div><div id="legacy-detail-container"></div>`;
            }

            // 3. 渲染初始儲位的詳細分析卡片
            if (initialLocationId) {
                switchLocationDetail(partNumber, initialLocationId);
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
        
        // 打開耗損分析模態視窗
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
    
    // 如果零件詳情模態視窗是打開的，先關閉它
    if (partDetailModal) {
        partDetailModalElement.addEventListener('hidden.bs.modal', function() {
            prepareAndShowModal();
        }, { once: true });
        partDetailModal.hide();
    } else {
        // 沒有需要關閉的模態視窗，直接打開
        prepareAndShowModal();
    }
}

// 增強庫存分布表格，加入 ID 和樣式
function enhanceInventorySummaryTableWithClicks(originalTableHtml, partNumber, inventories) {
    if (!originalTableHtml || !inventories) {
        return originalTableHtml;
    }
    
    // 為表格加入 hover 樣式
    let enhancedHtml = originalTableHtml.replace(
        '<table class="table',
        '<table class="table table-hover'
    );
    
    // 為每一行加入 ID 以便後續高亮（不再使用 onclick，改用事件委派）
    inventories.forEach((inv, index) => {
        const warehouseLocationId = inv.warehouse_location_id;
        if (warehouseLocationId) {
            const rowPattern = new RegExp(`(<tr[^>]*class="js-location-row-click"[^>]*data-location-id="${warehouseLocationId}"[^>]*>)`, 'g');
            
            enhancedHtml = enhancedHtml.replace(rowPattern, (match) => {
                // 只添加 id 屬性，不添加 onclick
                return match.replace('<tr', `<tr id="summary-row-${warehouseLocationId}"`);
            });
        }
    });
    
    return enhancedHtml;
}

// 切換顯示特定儲位的詳情
function switchLocationDetail(partNumber, warehouseLocationId) {
    console.group('switchLocationDetail Debug');
    console.log('Inputs:', { partNumber, warehouseLocationId });
    
    if (!currentPartData || !currentPartData.inventories) {
        console.error('❌ currentPartData is missing');
        console.groupEnd();
        return;
    }

    // 1. 找出目標儲位資料 (使用寬鬆比較以容許字串/數字差異)
    const targetInventory = currentPartData.inventories.find(inv => inv.warehouse_location_id == warehouseLocationId);
    
    if (!targetInventory) {
        console.error('❌ Target inventory not found for location ID:', warehouseLocationId);
        console.log('Available inventories:', currentPartData.inventories.map(i => ({id: i.warehouse_location_id, code: i.location_code})));
        console.groupEnd();
        return;
    }

    console.log('✅ Found inventory:', {
        location: targetInventory.location_code,
        warehouse: targetInventory.warehouse_name,
        qty: targetInventory.quantity_on_hand
    });

    // 2. 準備 HTML
    const detailHtml = `
        <h5 class="fw-bold mb-4">
            <i class="fas fa-list me-2"></i> 詳細分析清單 
            <small class="text-muted ms-2" style="font-size: 0.9rem; font-weight: normal;">(${targetInventory.warehouse_name} - ${targetInventory.location_code})</small>
        </h5>
        ${window.ConsumptionUtils.renderLocationDetailCard(targetInventory, currentPartData.part_info.locations)}
    `;

    // 3. 更新顯示區域
    const detailList = document.getElementById('consumptionDetailList');
    const legacyContainer = document.getElementById('legacy-detail-container');
    const container = detailList || legacyContainer;
    
    console.log('🔍 Container search:', {
        detailList: detailList ? 'Found' : 'Not found',
        legacyContainer: legacyContainer ? 'Found' : 'Not found',
        container: container ? 'Using container' : 'No container'
    });
    
    if (container) {
        console.log('✅ Updating container with new detail HTML');
        // 強制清空並重繪
        container.innerHTML = '';
        
        // 使用 requestAnimationFrame 確保 DOM 更新
        requestAnimationFrame(() => {
            container.innerHTML = detailHtml;
            container.scrollTop = 0; // 重置滾動條
            console.log('✅ Container updated successfully');
            
            // 視覺回饋：閃爍效果
            container.animate([
                { opacity: 0.5 },
                { opacity: 1 }
            ], {
                duration: 300,
                easing: 'ease-out'
            });
        });
    } else {
        console.error('❌ Detail container not found in DOM');
    }

    // 4. 更新上方表格的高亮狀態
    updateSummaryTableHighlight(warehouseLocationId);
    
    console.groupEnd();
}

// 輔助函數：更新高亮狀態
function updateSummaryTableHighlight(activeLocationId) {
    // 移除所有行的高亮
    document.querySelectorAll('[id^="summary-row-"]').forEach(row => {
        row.classList.remove('table-primary', 'border-primary', 'shadow-sm');
        row.style.fontWeight = 'normal';
        row.style.borderLeft = '';
    });

    // 加入當前行的高亮
    const activeRow = document.getElementById(`summary-row-${activeLocationId}`);
    if (activeRow) {
        activeRow.classList.add('table-primary', 'border-primary', 'shadow-sm');
        activeRow.style.fontWeight = 'bold';
        activeRow.style.borderLeft = '4px solid #0d6efd';
    }
}

// 暴露給全局，因為 enhanceInventorySummaryTableWithClicks 生成的 HTML 會直接調用它
window.switchLocationDetail = switchLocationDetail;

// 保留舊函數名以防有其他地方呼叫 (雖然主要都已替換)
const jumpToLocationDetail = switchLocationDetail;

// 確保模態視窗正確關閉的通用函數
function safeCloseModal(modalElement) {
    if (!modalElement) return;
    
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) {
        modalInstance.hide();
        
        // 監聽隱藏完成事件
        modalElement.addEventListener('hidden.bs.modal', function() {
            cleanupModalBackdrops();
        }, { once: true });
    }
}

// 初始化事件監聽器
document.addEventListener('DOMContentLoaded', function() {
    // 為週期訂單模態視窗添加關閉清理事件
    const weeklyOrderModalElement = document.getElementById('weeklyOrderModal');
    if (weeklyOrderModalElement) {
        weeklyOrderModalElement.addEventListener('hidden.bs.modal', function() {
            console.log('🧹 Weekly order modal closed, cleaning up');
            setTimeout(cleanupModalBackdrops, 100);
        });
    }

    // 處理動態產生的「加入週期申請」按鈕點擊事件 和 庫存分佈表格行點擊事件
    document.body.addEventListener('click', function(e) {
        // 處理庫存分佈表格行點擊
        const locationRow = e.target.closest('.js-location-row-click');
        if (locationRow) {
            e.preventDefault();
            e.stopPropagation();
            const locationId = locationRow.getAttribute('data-location-id');
            const currentPartData = getCurrentPartData();
            if (locationId && currentPartData && currentPartData.part_info) {
                console.log('📍 Location row clicked:', locationId);
                window.switchLocationDetail(currentPartData.part_info.part_number, locationId);
            }
            return;
        }

        // 處理「加入週期申請」按鈕
        if (e.target.matches('.js-add-to-weekly-order-detail') || e.target.closest('.js-add-to-weekly-order-detail')) {
            const btn = e.target.matches('.js-add-to-weekly-order-detail') ? e.target : e.target.closest('.js-add-to-weekly-order-detail');
            
            const partNumber = btn.getAttribute('data-part-number');
            const partName = btn.getAttribute('data-part-name');
            const locationId = btn.getAttribute('data-location-id');
            const quantity = btn.getAttribute('data-suggested-quantity');
            const unit = btn.getAttribute('data-unit');
            const locations = btn.getAttribute('data-locations'); // Get all locations
            const partType = btn.getAttribute('data-part-type');

            if (!partNumber) {
                alert('缺少零件編號，無法加入訂單');
                return;
            }
            
            // 暫時隱藏耗損分析模態框 (如果開啟的話)
            const consumptionModal = bootstrap.Modal.getInstance(document.getElementById('consumptionDetailModal'));
            if (consumptionModal) {
                consumptionModal.hide();
            }

            // 開啟週期訂單模態框
            addToWeeklyOrder(partNumber, partName, unit, partType, locations, locationId, quantity);
        }
    });

    // 加入週期申請 (新版：使用獨立模態視窗)
    function addToWeeklyOrder(partNumber, partName, unit, partType, locationsString, preSelectedLocationId = null, suggestedQuantity = null) {
        const normalizedUnit = unit || 'pcs';
        const partDisplayElement = document.getElementById('weeklyOrderPartDisplay');
        const unitDisplayElement = document.getElementById('weeklyOrderUnitDisplay');

        // 填充模態視窗中的零件資訊
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = normalizedUnit;
        document.getElementById('weeklyOrderPartType').value = partType; 
        if (partDisplayElement) {
            partDisplayElement.textContent = unitDisplayElement
                ? `${partNumber} (${partName})`
                : `${partNumber} (${partName}) | 單位: ${normalizedUnit}`;
        }
        if (unitDisplayElement) {
            unitDisplayElement.textContent = normalizedUnit;
        }

        // 清除舊的錯誤訊息並重設表單
        document.getElementById('weeklyOrderError').style.display = 'none';
        document.getElementById('weeklyOrderForm').reset();

        // 重新設定零件資訊（reset() 會清除所有值，需重設）
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = normalizedUnit;
        document.getElementById('weeklyOrderPartType').value = partType || 'N/A';
        if (partDisplayElement) {
            partDisplayElement.textContent = unitDisplayElement
                ? `${partNumber} (${partName})`
                : `${partNumber} (${partName}) | 單位: ${normalizedUnit}`;
        }
        if (unitDisplayElement) {
            unitDisplayElement.textContent = normalizedUnit;
        }

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
            // 解析 locations 字串 (如果是字串的話)
            let locations = locationsString;
            if (typeof locationsString === 'string') {
                locations = JSON.parse(locationsString);
            }

            if (locations && locations.length > 0) {
                // 有儲位資料
                locationDropdown.disabled = false;
                locationDropdown.required = true;
                locationStar.style.display = 'inline';

                locationDropdown.add(new Option('請選擇儲位...', ''));
                locations.forEach(loc => {
                    const optionText = `${loc.warehouse_name} - ${loc.location_code}`;
                    // 注意：这里的 loc.id 可能是 warehouse_location_id
                    // 需要确认 data-locations 中的结构与 loc.id 的对应关系
                    const locId = loc.id || loc.warehouse_location_id; 
                    const option = new Option(optionText, locId);
                    locationDropdown.add(option);

                    // 如果有預選儲位，在此處標記
                    if (preSelectedLocationId && String(locId) === String(preSelectedLocationId)) {
                        option.selected = true;
                    }
                });

                // 如果已自動選擇儲位，觸發變更邏輯
                if (locationDropdown.value) {
                    handleLocationChange();
                }

                // 如果只有一個儲位，自動選取
                if (locations.length === 1) {
                    locationDropdown.value = locations[0].id || locations[0].warehouse_location_id;
                }

                // 備註非必填
                notesField.required = false;
                notesStar.style.display = 'none';
            } else {
                // 無儲位資料
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
            locationDropdown.removeEventListener('change', handleLocationChange); // 避免重複綁定
            locationDropdown.addEventListener('change', handleLocationChange);

        } catch (e) {
            console.error("解析儲位資料失敗:", e);
            locationDropdown.innerHTML = '<option value="">讀取儲位失敗</option>';
            locationDropdown.disabled = true;
            locationStar.style.display = 'none';
        }

        // 顯示模態視窗
        const modalElement = document.getElementById('weeklyOrderModal');
        // 重用或創建 modal 實例，並確保 backdrop 設置正確
        let weeklyOrderModal = bootstrap.Modal.getInstance(modalElement);
        if (!weeklyOrderModal) {
            weeklyOrderModal = new bootstrap.Modal(modalElement, {
                backdrop: true,
                keyboard: true,
                focus: true
            });
        }
        weeklyOrderModal.show();
    }

    // 提交週期訂單申請
    const submitBtn = document.getElementById('submitWeeklyOrder');
    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
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
            if (warningDiv && warningDiv.dataset.confirmed === 'true') {
                warningDiv.dataset.confirmed = '';
                doSubmitWeeklyOrderInv(data, submitButton, errorDiv);
                return;
            }

            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 檢查中...';

            fetch('/api/weekly-orders/check-pending-inbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    part_number: data.part_number,
                    warehouse_location_id: data.warehouse_location_id,
                    only_pending_inbound: true,
                    require_location: true
                })
            })
            .then(r => r.json())
            .then(checkResult => {
                if (checkResult.has_pending) {
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
                        if (confirm(`⚠️ 此零件已有 ${checkResult.items.length} 筆待處理項目，確定要再次申請嗎？`)) {
                            doSubmitWeeklyOrderInv(data, submitButton, errorDiv);
                        } else {
                            submitButton.disabled = false;
                            submitButton.innerHTML = '確認申請';
                        }
                    }
                } else {
                    doSubmitWeeklyOrderInv(data, submitButton, errorDiv);
                }
            })
            .catch(err => {
                console.warn('檢查待入庫失敗，直接送出:', err);
                doSubmitWeeklyOrderInv(data, submitButton, errorDiv);
            });
        });
    }

    function doSubmitWeeklyOrderInv(data, submitButton, errorDiv) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 正在提交...';

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
});

if (window.PartDetailModal) {
    window.openConsumptionAnalysisDirect = window.PartDetailModal.openConsumptionAnalysisDirect;
    window.showPartDetails = window.PartDetailModal.showPartDetails;
    window.showConsumptionAnalysis = window.PartDetailModal.showConsumptionAnalysis;
    window.switchLocationDetail = window.PartDetailModal.switchLocationDetail;
}
