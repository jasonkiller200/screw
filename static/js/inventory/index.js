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

// 全域變數用於儲存當前零件資料
let currentPartData = null;
let currentClickedLocationId = null;

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
            showConsumptionAnalysis();
        })
        .catch(err => {
            console.error('openConsumptionAnalysisDirect error:', err);
            if (detailList) {
                detailList.innerHTML = `<div class="alert alert-danger m-3">載入失敗：${err.message}</div>`;
            }
        });
}

// 顯示零件詳情（支援儲位參數）
function showPartDetails(partNumber, warehouseLocationId = null) {
    if (!partNumber) {
        return;
    }
    
    // 儲存點擊的儲位ID
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
        
        // 只在第一次創建時添加清理事件
        modalElement.addEventListener('hidden.bs.modal', function() {
            cleanupModalBackdrops();
        }, { once: true });
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
            
            // 儲存當前零件資料供耗損分析使用
            currentPartData = data;

            const part = data.part_info;
            const inventories = data.inventories || [];
            const orders = data.order_history || [];

            // 決定顯示模式：如果有指定儲位ID，優先顯示該儲位詳情
            const targetInventory = currentClickedLocationId ? 
                inventories?.find(inv => inv.warehouse_location_id === currentClickedLocationId) : 
                null;

            let contentHtml = '';

            if (targetInventory) {
                // 顯示單一儲位詳情
                contentHtml = renderSingleLocationDetail(part, targetInventory, inventories, weeklyOrderData);
            } else {
                // 顯示所有儲位概覽（保持原有邏輯）
                contentHtml = renderAllLocationsOverview(part, inventories, orders);
            }

            detailContent.innerHTML = contentHtml;
            
            // 如果有庫存資料，顯示耗損分析按鈕
            if (showConsumptionBtn && inventories && inventories.length > 0) {
                showConsumptionBtn.style.display = 'inline-block';
                // 確保按鈕事件監聽器正確設置
                showConsumptionBtn.onclick = showConsumptionAnalysis;
            }
        })
        .catch(error => {
            console.error('Error fetching part details:', error);
            detailContent.innerHTML = `<div class="alert alert-danger">載入零件詳情失敗：${error.message}</div>`;
        });
}


// 渲染單一儲位詳情
function renderSingleLocationDetail(part, inventory, allInventories, weeklyOrderData) {
    // 處理庫存數據，適配不同的數據結構
    let warehouse, location, quantity, reserved_quantity, available;
    
    if (inventory.warehouse && inventory.warehouse_location) {
        // 新的數據結構
        warehouse = inventory.warehouse;
        location = inventory.warehouse_location;
        quantity = inventory.quantity_on_hand || inventory.quantity || 0;
        reserved_quantity = inventory.reserved_quantity || 0;
        available = inventory.available_quantity || (quantity - reserved_quantity);
    } else {
        // 從 part.locations 中尋找對應的儲位資料
        const locationData = part.locations?.find(loc => loc.id === currentClickedLocationId);
        if (locationData) {
            warehouse = { name: locationData.warehouse_name, code: locationData.warehouse_code };
            location = { location_code: locationData.location_code };
            quantity = inventory.quantity_on_hand || inventory.quantity || 0;
            reserved_quantity = inventory.reserved_quantity || 0;
            available = inventory.available_quantity || (quantity - reserved_quantity);
        } else {
            warehouse = { name: 'N/A', code: 'N/A' };
            location = { location_code: 'N/A' };
            quantity = inventory.quantity || 0;
            reserved_quantity = inventory.reserved_quantity || 0;
            available = quantity - reserved_quantity;
        }
    }

    // 生成所有儲位的表格，並高亮當前儲位
    let inventoryHtml = '';
    const all_locations = (part && part.locations) ? part.locations : [];

    if (all_locations.length > 0) {
        inventoryHtml = all_locations.map(loc => {
            // 從 allInventories 陣列中尋找此儲位的庫存記錄
            const inv = allInventories.find(i => i.warehouse_location_id === loc.id);
            const quantity_on_hand = inv ? inv.quantity_on_hand : 0;
            const reserved_quantity = inv ? inv.reserved_quantity : 0;
            const available_quantity = inv ? inv.available_quantity : 0;
            
            // 計算健康度
            const healthInfo = calculateLocationHealth(available_quantity, quantity_on_hand);
            const isCurrentLocation = loc.id === currentClickedLocationId;
            const rowClass = isCurrentLocation ? 'table-warning' : '';
            const currentLabel = isCurrentLocation ? '<i class="fas fa-arrow-right me-1 text-primary"></i>' : '';

            return `
                <tr class="${rowClass}" style="cursor: pointer;" onclick="openConsumptionAnalysisDirect('${part.part_number}', ${loc.id})">
                    <td>${currentLabel}${loc.warehouse_name} (${loc.warehouse_code})</td>
                    <td>${loc.location_code}</td>
                    <td class="text-end">${quantity_on_hand}</td>
                    <td class="text-end">${reserved_quantity}</td>
                    <td class="text-end"><strong>${available_quantity}</strong></td>
                    <td class="text-center">
                        <span class="badge ${healthInfo.badgeClass}" title="${healthInfo.tooltip}">
                            ${healthInfo.icon} ${healthInfo.text}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        inventoryHtml = '<tr><td colspan="6" class="text-center text-muted">此零件未設定儲位</td></tr>';
    }
    
    // 週期訂單相關數據
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
        const locationOrders = weeklyOrderData.registrations.filter(reg => 
            reg.warehouse_location_id === (inventory.warehouse_location_id || currentClickedLocationId)
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
                                    ${locationOrders.map(order => `
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
                    <tr><td><strong>零件編號：</strong></td><td>${(part && part.part_number) || 'N/A'}</td></tr>
                    <tr><td><strong>名稱：</strong></td><td>${(part && part.name) || 'N/A'}</td></tr>
                    <tr><td><strong>描述：</strong></td><td>${(part && part.description) || '無'}</td></tr>
                    <tr><td><strong>單位：</strong></td><td>${(part && part.unit) || 'N/A'}</td></tr>
                    <tr><td><strong>每盒數量：</strong></td><td>${(part && part.quantity_per_box) || 'N/A'}</td></tr>
                    <tr><td><strong>採購前置期：</strong></td><td>${(part && part.lead_time) || 'N/A'} 天</td></tr>
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

// 渲染所有儲位概覽
function renderAllLocationsOverview(part, inventories, orders) {
    // 生成庫存表格 HTML
    let inventoryHtml = '';
    const all_locations = (part && part.locations) ? part.locations : [];

    if (all_locations.length > 0) {
        inventoryHtml = all_locations.map(loc => {
            // 從 inventories 陣列中尋找此儲位的庫存記錄
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

    // 生成訂購歷史 HTML
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
    // 耗損分析按鈕事件
    const showConsumptionBtn = document.getElementById('showConsumptionAnalysisBtn');
    if (showConsumptionBtn) {
        showConsumptionBtn.addEventListener('click', showConsumptionAnalysis);
    }
    
    // 為消耗分析模態視窗添加關閉清理事件
    const consumptionDetailModal = document.getElementById('consumptionDetailModal');
    if (consumptionDetailModal) {
        consumptionDetailModal.addEventListener('hidden.bs.modal', function() {
            console.log('🧹 Consumption modal closed, cleaning up');
            setTimeout(cleanupModalBackdrops, 100);
        });
    }

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
        // 填充模態視窗中的零件資訊
        document.getElementById('weeklyOrderPartNumber').value = partNumber;
        document.getElementById('weeklyOrderPartName').value = partName;
        document.getElementById('weeklyOrderUnit').value = unit;
        document.getElementById('weeklyOrderPartType').value = partType; 
        document.getElementById('weeklyOrderPartDisplay').textContent = `${partNumber} (${partName})`;

        // 清除舊的錯誤訊息並重設表單
        document.getElementById('weeklyOrderError').style.display = 'none';
        document.getElementById('weeklyOrderForm').reset();

        // 重新設定零件資訊（reset() 會清除所有值，需重設）
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
                    warehouse_location_id: data.warehouse_location_id
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
