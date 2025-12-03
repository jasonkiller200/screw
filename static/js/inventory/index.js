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
    
    // Show/Hide relevant sections
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

    // Show/Hide relevant sections
    document.getElementById('transactionTypeInGroup').style.display = 'none';
    document.getElementById('transactionTypeOutGroup').style.display = 'block';
    
    // Trigger change event to show/hide work order field based on default selection
    const transactionTypeOut = document.getElementById('actionTransactionTypeOut');
    const workOrderIdInput = document.getElementById('actionWorkOrderId');
    const actionNotesInput = document.getElementById('actionNotes');

    if (transactionTypeOut.value === 'OUT_WORK_ORDER') {
        document.getElementById('workOrderGroup').style.display = 'block';
        // Set initial notes for work order
        if (workOrderIdInput.value) {
            actionNotesInput.value = `工單領用 - 工單編號: ${workOrderIdInput.value}`;
        }
    } else {
        document.getElementById('workOrderGroup').style.display = 'none';
        actionNotesInput.value = ''; // Clear notes if not work order
    }
    validateQuickActionWorkOrderId(); // Initial validation on modal open
    const modal = new bootstrap.Modal(document.getElementById('quickActionModal'));
    modal.show();
}

// Listen for changes on the stock-out transaction type dropdown
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
        actionNotesInput.value = ''; // Clear notes if not work order
    }
    validateQuickActionWorkOrderId(); // Re-validate on type change
});

// Listen for changes on the work order ID input to update notes
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
    validateQuickActionWorkOrderId(); // Re-validate on input change
});

// 提交快速操作
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
    
    let url, payload;
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
    } else { // OUT
        url = '/api/inventory/stock-out';
        const transactionType = document.getElementById('actionTransactionTypeOut').value;
        if (!transactionType) {
            alert('請選擇一個有效的出庫類型');
            return;
        }

        // Perform work order ID validation before proceeding
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
        // If work order, add work_order_id to payload
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
            alert(data.message);
            location.reload();
        } else {
            alert('操作失敗：' + data.error);
        }
    })
    .catch(err => {
        alert('網路錯誤：' + err.message);
    });
    
    bootstrap.Modal.getInstance(document.getElementById('quickActionModal')).hide();
});

// 匯出庫存 - 使用當前篩選條件
function exportInventory() {
    // 取得當前 URL 的查詢參數
    const currentUrl = new URL(window.location);
    const warehouseId = currentUrl.searchParams.get('warehouse_id');
    
    let exportUrl = '/api/inventory/stock/export?';
    const params = new URLSearchParams();
    
    if (warehouseId) params.append('warehouse_id', warehouseId);
    
    exportUrl += params.toString();
    
    // 開啟新視窗下載 XLSX 檔案
    window.open(exportUrl, '_blank');
}

// 匯出所有倉庫的庫存
function exportAllInventory() {
    window.open('/api/inventory/stock/export', '_blank');
}

// 匯出低庫存清單
function exportLowStock() {
    const currentUrl = new URL(window.location);
    const warehouseId = currentUrl.searchParams.get('warehouse_id');
    
    let exportUrl = '/api/inventory/low-stock/export';
    if (warehouseId) {
        exportUrl += `?warehouse_id=${warehouseId}`;
    }
    
    window.open(exportUrl, '_blank');
}

// 顯示進階匯出選項（未來擴展用）
function showExportOptions() {
    alert('進階匯出選項功能將在下個版本中提供');
}

// Function to validate work order ID for quick action modal
function validateQuickActionWorkOrderId() {
    const transactionTypeSelect = document.getElementById('actionTransactionTypeOut');
    const workOrderIdInput = document.getElementById('actionWorkOrderId');
    const workOrderIdFeedback = document.getElementById('action-work-order-id-feedback');
    
    const isWorkOrderType = transactionTypeSelect.value === 'OUT_WORK_ORDER';
    let isValid = true;
    let feedbackMessage = '';

    if (isWorkOrderType) {
        workOrderIdInput.setAttribute('required', 'required');
        if (workOrderIdInput.value.trim() === '') {
            isValid = false;
            feedbackMessage = '工單編號為必填項。';
        } else if (workOrderIdInput.value.trim().length < 9) {
            isValid = false;
            feedbackMessage = '工單編號至少需要9碼。';
        }
    } else {
        workOrderIdInput.removeAttribute('required');
    }

    if (isValid) {
        workOrderIdInput.classList.remove('is-invalid');
        workOrderIdInput.classList.add('is-valid');
        workOrderIdFeedback.textContent = '';
    } else {
        workOrderIdInput.classList.add('is-invalid');
        workOrderIdInput.classList.remove('is-valid');
        workOrderIdFeedback.textContent = feedbackMessage;
    }
    return isValid;
}

document.addEventListener('DOMContentLoaded', () => {
    // 初始化所有行的原始值並進行驗證
    const allRows = document.querySelectorAll('.inventory-row');
    allRows.forEach(row => {
        const partId = row.dataset.partId;
        const locationId = row.dataset.locationId;
        const key = `${partId}-${locationId}`;
        
        const safetyStockInput = row.querySelector('.safety-stock-input');
        const reorderPointInput = row.querySelector('.reorder-point-input');
        
        // 儲存原始值
        originalValues.set(key, {
            safety: parseFloat(safetyStockInput.value) || 0,
            reorder: parseFloat(reorderPointInput.value) || 0
        });
        
        // 初始驗證
        if (reorderPointInput) {
            validateStockLevels(reorderPointInput);
        }
        
        // 監聽輸入變更
        safetyStockInput.addEventListener('input', function() {
            checkIfModified(this);
        });
        
        reorderPointInput.addEventListener('input', function() {
            checkIfModified(this);
        });
    });
    
    // 離開頁面前檢查是否有未儲存的變更
    window.addEventListener('beforeunload', (event) => {
        const hasUnsavedChanges = document.querySelectorAll('.row-modified').length > 0;
        
        if (hasUnsavedChanges) {
            const message = '您有未儲存的庫存設定變更，確定要離開嗎？';
            event.preventDefault();
            event.returnValue = message; // 標準寫法
            return message; // 部分瀏覽器需要
        }
    });
    
    const saveButtons = document.querySelectorAll('.save-stock-levels-btn');

    saveButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const row = event.currentTarget.closest('.inventory-row');
            const partId = row.dataset.partId;
            
            const safetyStockInput = row.querySelector('.safety-stock-input');
            const reorderPointInput = row.querySelector('.reorder-point-input');

            const safetyStock = parseFloat(safetyStockInput.value);
            const reorderPoint = parseFloat(reorderPointInput.value);

            if (!partId || safetyStock === '' || reorderPoint === '') {
                alert('無法獲取零件ID或庫存值');
                return;
            }
            
            // 驗證數值合理性
            if (safetyStock < 0 || reorderPoint < 0) {
                alert('❌ 安全庫存和補貨點不能為負數');
                return;
            }
            
            // 驗證補貨點是否小於安全庫存（不允許儲存）
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
                
                // 觸發驗證顯示錯誤訊息
                validateStockLevels(reorderPointInput);
                return;
            }else if (reorderPoint === safetyStock && reorderPoint > 0) {
                // 警告：補貨點等於安全庫存
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

            // Add visual feedback that something is happening
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            fetch(`/api/parts/${partId}/update_inventory_policy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    warehouse_id: row.dataset.warehouseId,
                    warehouse_location_id: row.dataset.locationId, // 添加儲位ID
                    safety_stock: safetyStock,
                    reorder_point: reorderPoint,
                }),
            })
            .then(response => {
                if (!response.ok) {
                    // If response is not OK, read the error message from JSON body
                    return response.json().then(err => { throw new Error(err.error || '伺服器錯誤') });
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // 更新原始值（儲存成功後）
                    const locationId = row.dataset.locationId;
                    const key = `${partId}-${locationId}`;
                    originalValues.set(key, {
                        safety: safetyStock,
                        reorder: reorderPoint
                    });
                    
                    // 移除修改標記
                    markRowAsModified(row, false);
                    
                    // Visual feedback for success
                    row.style.transition = 'background-color 0.5s ease';
                    row.style.backgroundColor = '#d4edda'; // Light green
                    
                    // 顯示成功訊息
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
                        row.style.backgroundColor = ''; // Reset background
                        successMsg.remove();
                    }, 3000);
                    
                    // 清除驗證提示
                    validateStockLevels(reorderPointInput);
                } else {
                    throw new Error(data.error || '更新失敗');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`❌ 更新失敗: ${error.message}`);
                // Visual feedback for error
                row.style.backgroundColor = '#f8d7da'; // Light red
                setTimeout(() => {
                    row.style.backgroundColor = ''; // Reset background
                }, 2000);
            })
            .finally(() => {
                // Restore button state
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-save"></i>';
            });
        });
    });
});

// 顯示零件詳情
function showPartDetails(partNumber) {
    if (!partNumber) {
        return;
    }
    
    const modalLabel = document.getElementById('partDetailModalLabel');
    const detailContent = document.getElementById('partDetailContent');
    const modalElement = document.getElementById('partDetailModal');
    
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
    
    const modal = new bootstrap.Modal(modalElement);
    modal.show();

    fetch(`/api/part/${encodeURIComponent(partNumber)}?include_locations=true`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                detailContent.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                return;
            }

            const part = data.part_info;
            const history = data.order_history || [];
            const inventories = data.inventories || [];

            let historyHtml = '';
            if (history.length > 0) {
                const statusMap = {
                    'registered': { text: '已登記', class: 'secondary' },
                    'approved': { text: '已核准', class: 'primary' },
                    'partially_received': { text: '部分到貨', class: 'info' },
                    'completed': { text: '已完成', class: 'success' },
                    'rejected': { text: '已拒絕', class: 'danger' }
                };

                historyHtml = history.map(reg => {
                    const date = new Date(reg.created_at);
                    const formattedDate = date.getFullYear() + '-' +
                                          String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                          String(date.getDate()).padStart(2, '0');
                    
                    const statusInfo = statusMap[reg.status] || { text: reg.status, class: 'light' };

                    return `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${reg.applicant_name || 'N/A'}</td>
                            <td>${reg.location_display || '無指定'}</td>
                            <td>${reg.quantity}</td>
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

            let inventoryHtml = '';
            const all_locations = (part && part.locations) ? part.locations : [];

            if (all_locations.length > 0) {
                inventoryHtml = all_locations.map(loc => {
                    // 從 inventories 陣列中尋找此儲位的庫存記錄（改用 location_id 匹配）
                    const inv = inventories.find(i => i.warehouse_location_id === loc.id);

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

            detailContent.innerHTML = `
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
        })
        .catch(error => {
            console.error('Error fetching part details:', error);
            detailContent.innerHTML = `<div class="alert alert-danger">載入零件詳情失敗：${error.message}</div>`;
        });
}
