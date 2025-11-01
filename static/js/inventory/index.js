// 快速入庫
function quickStockIn(partNumber, warehouseId) {
    document.getElementById('quickActionTitle').textContent = '快速入庫';
    document.getElementById('actionPartNumber').value = partNumber;
    document.getElementById('actionWarehouseId').value = warehouseId;
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
function quickStockOut(partNumber, warehouseId) {
    document.getElementById('quickActionTitle').textContent = '快速出庫';
    document.getElementById('actionPartNumber').value = partNumber;
    document.getElementById('actionWarehouseId').value = warehouseId;
    document.getElementById('actionType').value = 'OUT';
    document.getElementById('displayPartNumber').value = partNumber;
    document.getElementById('actionQuantity').value = '';
    document.getElementById('actionNotes').value = '';

    // Show/Hide relevant sections
    document.getElementById('transactionTypeInGroup').style.display = 'none';
    document.getElementById('transactionTypeOutGroup').style.display = 'block';
    
    // Trigger change event to show/hide work order field based on default selection
    const transactionTypeOut = document.getElementById('actionTransactionTypeOut');
    if (transactionTypeOut.value === 'OUT_WORK_ORDER') {
        document.getElementById('workOrderGroup').style.display = 'block';
    } else {
        document.getElementById('workOrderGroup').style.display = 'none';
    }

    const modal = new bootstrap.Modal(document.getElementById('quickActionModal'));
    modal.show();
}

// Listen for changes on the stock-out transaction type dropdown
document.getElementById('actionTransactionTypeOut').addEventListener('change', function() {
    const workOrderGroup = document.getElementById('workOrderGroup');
    if (this.value === 'OUT_WORK_ORDER') {
        workOrderGroup.style.display = 'block';
    } else {
        workOrderGroup.style.display = 'none';
    }
});

// 提交快速操作
document.getElementById('submitQuickAction').addEventListener('click', function() {
    const partNumber = document.getElementById('actionPartNumber').value;
    const warehouseId = document.getElementById('actionWarehouseId').value;
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
            warehouse_id: parseInt(warehouseId),
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
        payload = {
            part_number: partNumber,
            warehouse_id: parseInt(warehouseId),
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

document.addEventListener('DOMContentLoaded', () => {
    const saveButtons = document.querySelectorAll('.save-stock-levels-btn');

    saveButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const row = event.currentTarget.closest('.inventory-row');
            const partId = row.dataset.partId;
            
            const safetyStockInput = row.querySelector('.safety-stock-input');
            const reorderPointInput = row.querySelector('.reorder-point-input');

            const safetyStock = safetyStockInput.value;
            const reorderPoint = reorderPointInput.value;

            if (!partId || safetyStock === '' || reorderPoint === '') {
                alert('無法獲取零件ID或庫存值');
                return;
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
                    warehouse_id: row.dataset.warehouseId, // Add warehouse_id
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
                    // Visual feedback for success
                    row.style.transition = 'background-color 0.5s ease';
                    row.style.backgroundColor = '#d4edda'; // Light green
                    setTimeout(() => {
                        row.style.backgroundColor = ''; // Reset background
                    }, 2000);
                } else {
                    throw new Error(data.error || '更新失敗');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`更新失敗: ${error.message}`);
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
