// static/js/inventory/stock_in.js

document.addEventListener('DOMContentLoaded', function() {
    const partNumberInput = document.getElementById('part_number');
    const form = document.querySelector('form');

    if (partNumberInput) {
        // 使用 debounce 防止在使用者快速輸入時頻繁觸發 API 請求
        const debouncedFetchPartInfo = AppUtils.debounce(fetchPartInfo, 300);
        partNumberInput.addEventListener('input', function() {
            debouncedFetchPartInfo(this.value.trim());
        });
    }

    if (form) {
        form.setAttribute('novalidate', true); // 防止瀏覽器預設驗證
        form.addEventListener('submit', handleFormSubmit);
    }
});


// 開啟零件選擇模態框
function openPartSelect() {
    const modal = new bootstrap.Modal(document.getElementById('partSelectModal'));
    modal.show();
}

// 選擇零件後的操作
function selectPart(partNumber, partName, unit, locations) {
    document.getElementById('part_number').value = partNumber;
    bootstrap.Modal.getInstance(document.getElementById('partSelectModal')).hide();
    
    // 顯示零件資訊
    displayPartInfo(partNumber, partName, unit, locations);
}

// 從後端獲取零件資訊
function fetchPartInfo(partNumber) {
    if (!partNumber) {
        clearPartInfo();
        return;
    }

    AppUtils.showLoading('#partInfoContent');
    
    AppUtils.makeRequest(`/api/part/${encodeURIComponent(partNumber)}`)
        .then(data => {
            if (data.part_info) {
                displayPartInfo(data.part_info.part_number, data.part_info.name, data.part_info.unit, data.part_info.locations);
            } else {
                clearPartInfo();
                AppUtils.showToast('找不到該零件', 'error');
            }
        })
        .catch(err => {
            clearPartInfo();
            AppUtils.showError('查詢零件資訊失敗', '#partInfoContent');
        });
}

// 在頁面上顯示零件資訊
function displayPartInfo(partNumber, partName, unit, locations) {
    const partInfoCard = document.getElementById('partInfoCard');
    const partInfoContent = document.getElementById('partInfoContent');
    const partNameDisplay = document.getElementById('partNameDisplay');
    const warehouseSelect = document.getElementById('warehouse_id');

    partNameDisplay.textContent = partName || '';
    partInfoCard.style.display = 'block';

    // 填充倉庫下拉選單
    warehouseSelect.innerHTML = '<option value="">選擇倉庫</option>';
    if (locations && locations.length > 0) {
        locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.warehouse_id;
            option.textContent = `${loc.warehouse_name} - ${loc.location_code}`;
            warehouseSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '無可用倉庫';
        option.disabled = true;
        warehouseSelect.appendChild(option);
    }

    // 顯示基本資訊並準備載入庫存
    partInfoContent.innerHTML = `
        <p><strong>編號：</strong>${partNumber}</p>
        <p><strong>名稱：</strong>${partName}</p>
        <p><strong>單位：</strong>${unit}</p>
        <div id="stockInfoContainer" class="mt-2"></div>
    `;
    
    AppUtils.showLoading('#stockInfoContainer');

    // 獲取並顯示庫存資訊
    AppUtils.makeRequest(`/api/inventory/stock/${encodeURIComponent(partNumber)}`)
        .then(data => {
            const stockContainer = document.getElementById('stockInfoContainer');
            if (stockContainer) {
                if (data.stock_info && data.stock_info.length > 0) {
                    let stockHtml = '<h6>現有庫存：</h6>';
                    data.stock_info.forEach(stock => {
                        stockHtml += `<small>${stock.warehouse_name}: ${stock.quantity_on_hand} ${unit}</small><br>`;
                    });
                    stockContainer.innerHTML = stockHtml;
                } else {
                    stockContainer.innerHTML = '<small class="text-muted">此零件無庫存記錄</small>';
                }
            }
        })
        .catch(err => {
            const stockContainer = document.getElementById('stockInfoContainer');
            if(stockContainer) {
                AppUtils.showError('載入庫存失敗', stockContainer);
            }
        });
}

// 清除零件資訊顯示
function clearPartInfo() {
    document.getElementById('partInfoCard').style.display = 'none';
    document.getElementById('partNameDisplay').textContent = '';
    document.getElementById('warehouse_id').innerHTML = '<option value="">選擇倉庫</option>';
    document.getElementById('partInfoContent').innerHTML = '';
}


// 過濾零件列表
function filterParts() {
    const filter = document.getElementById('partSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#partsTableBody .part-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}

// 處理表單提交
function handleFormSubmit(event) {
    event.preventDefault(); // 總是先阻止預設提交

    const form = event.target;
    const partNumber = document.getElementById('part_number').value.trim();
    const warehouseId = document.getElementById('warehouse_id').value;
    const quantity = document.getElementById('quantity').value;
    const transactionType = document.getElementById('transaction_type').value;

    let isValid = true;
    let errorMessage = '';

    if (!partNumber) {
        isValid = false;
        errorMessage = '請輸入或選擇一個零件編號';
    } else if (!warehouseId) {
        isValid = false;
        errorMessage = '請選擇目標倉庫';
    } else if (!quantity) {
        isValid = false;
        errorMessage = '請輸入入庫數量';
    } else if (parseInt(quantity) <= 0) {
        isValid = false;
        errorMessage = '數量必須大於 0';
    } else if (!transactionType) {
        isValid = false;
        errorMessage = '請選擇入庫類型';
    }

    if (isValid) {
        form.submit(); // 如果驗證通過，手動提交表單
    } else {
        AppUtils.showToast(errorMessage, 'error');
    }
}
