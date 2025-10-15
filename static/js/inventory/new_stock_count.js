// 設定今天為預設盤點日期
document.getElementById('count_date').value = new Date().toISOString().split('T')[0];

// 提交新盤點表單
document.getElementById('newCountForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    fetch('/api/inventory/stock-counts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert('盤點建立成功！');
            window.location.href = '/inventory/stock-counts/' + result.count_id;
        } else {
            alert('建立失敗：' + result.error);
        }
    })
    .catch(err => {
        alert('網路錯誤：' + err.message);
    });
});

// 匯入盤點資料
function importCountData() {
    const modal = new bootstrap.Modal(document.getElementById('importModal'));
    modal.show();
}

// 執行匯入
function executeImport() {
    const fileInput = document.getElementById('csvFile');
    const warehouseId = document.getElementById('importWarehouse').value;
    
    if (!fileInput.files[0]) {
        alert('請選擇 CSV 檔案');
        return;
    }
    
    if (!warehouseId) {
        alert('請選擇目標倉庫');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('warehouse_id', warehouseId);
    
    fetch('/api/inventory/import-count-data', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            alert(`匯入成功！共處理 ${result.processed_count} 筆資料`);
            bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
            if (result.count_id) {
                window.location.href = '/inventory/stock-counts/' + result.count_id;
            }
        } else {
            alert('匯入失敗：' + result.error);
        }
    })
    .catch(err => {
        alert('網路錯誤：' + err.message);
    });
}

// 下載範本
function downloadTemplate() {
    window.open('/api/inventory/count-template', '_blank');
}
