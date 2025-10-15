// 快速入庫
function quickStockIn(partNumber, warehouseId) {
    document.getElementById('quickActionTitle').textContent = '快速入庫';
    document.getElementById('actionPartNumber').value = partNumber;
    document.getElementById('actionWarehouseId').value = warehouseId;
    document.getElementById('actionType').value = 'IN';
    document.getElementById('displayPartNumber').value = partNumber;
    document.getElementById('actionQuantity').value = '';
    document.getElementById('actionNotes').value = '';
    
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
    
    const modal = new bootstrap.Modal(document.getElementById('quickActionModal'));
    modal.show();
}

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
    
    const url = actionType === 'IN' ? '/api/inventory/stock-in' : '/api/inventory/stock-out';
    const transactionType = actionType === 'IN' ? 'IN_PURCHASE' : 'OUT_ISSUE';
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            part_number: partNumber,
            warehouse_id: parseInt(warehouseId),
            quantity: parseInt(quantity),
            transaction_type: transactionType,
            notes: notes
        })
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
    const partNumber = currentUrl.searchParams.get('part_number');
    const partName = currentUrl.searchParams.get('part_name');
    
    let exportUrl = '/api/inventory/stock/export?';
    const params = new URLSearchParams();
    
    if (warehouseId) params.append('warehouse_id', warehouseId);
    if (partNumber) params.append('part_number', partNumber);
    if (partName) params.append('part_name', partName);
    
    exportUrl += params.toString();
    
    // 開啟新視窗下載 CSV 檔案
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
