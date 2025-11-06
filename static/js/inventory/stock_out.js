let currentPartNumber = '';
let currentStock = {};

// 開啟零件選擇模態框
function openPartSelect() {
    const modal = new bootstrap.Modal(document.getElementById('partSelectModal'));
    modal.show();
}

// 選擇零件
function selectPart(partNumber, partName, unit, locations) {
    document.getElementById('part_number').value = partNumber;
    bootstrap.Modal.getInstance(document.getElementById('partSelectModal')).hide();
    
    currentPartNumber = partNumber;
    updateStockInfo(partName, unit, locations); // Pass partName, unit, locations
}

// 更新庫存資訊
function updateStockInfo(partName = '', unit = '', locations = []) {
    const partNumberInput = document.getElementById('part_number');
    const partNumber = partNumberInput.value.trim();
    const partNameDisplay = document.getElementById('partNameDisplay');
    const locationSelect = document.getElementById('warehouse_location_id'); // Corrected ID
    const stockInfoCard = document.getElementById('stockInfoCard');
    const stockInfoContent = document.getElementById('stockInfoContent');
    const availableStockSpan = document.getElementById('availableStock');

    // Update part name display next to input
    partNameDisplay.textContent = partName || '';

    // Populate location dropdown
    locationSelect.innerHTML = '<option value="">選擇儲位</option>'; // Clear existing options
    if (locations && locations.length > 0) {
        locations.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id; // Use the unique location ID
            option.textContent = `${loc.warehouse_name} - ${loc.location_code}`;
            locationSelect.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '無可用儲位';
        option.disabled = true;
        locationSelect.appendChild(option);
    }

    if (!partNumber) {
        stockInfoCard.style.display = 'none';
        availableStockSpan.textContent = '請先選擇零件和倉庫';
        return;
    }
    
    // Load stock info (existing logic)
    fetch(`/api/inventory/stock/${encodeURIComponent(partNumber)}`)
        .then(response => response.json())
        .then(data => {
            if (data.stock_info && data.part_info) {
                currentStock = {};
                let stockHtml = `
                    <p><strong>零件：</strong>${data.part_info.name}</p>
                    <p><strong>單位：</strong>${data.part_info.unit}</p>
                    <h6>各倉庫庫存：</h6>
                `;
                
                if (Array.isArray(data.stock_info)) {
                    data.stock_info.forEach(stock => {
                        currentStock[stock.warehouse_id] = stock;
                        const status = stock.available_quantity <= 0 ? 'text-danger' : 
                                      stock.available_quantity <= stock.reorder_point ? 'text-warning' : 'text-success';
                        stockHtml += `
                            <div class="d-flex justify-content-between">
                                <small>${stock.warehouse_name}:</small>
                                <small class="${status}"><strong>${stock.available_quantity}</strong></small>
                            </div>
                        `;
                    });
                } else {
                    currentStock[data.stock_info.warehouse_id] = data.stock_info;
                    const status = data.stock_info.available_quantity <= 0 ? 'text-danger' : 
                                  data.stock_info.available_quantity <= data.stock_info.reorder_point ? 'text-warning' : 'text-success';
                    stockHtml += `
                        <div class="d-flex justify-content-between">
                            <small>${data.stock_info.warehouse_name}:</small>
                            <small class="${status}"><strong>${data.stock_info.available_quantity}</strong></small>
                        </div>
                    `;
                }
                
                stockInfoContent.innerHTML = stockHtml;
                stockInfoCard.style.display = 'block';
                
                // Update available stock display
                updateAvailableStock();
            } else {
                stockInfoCard.style.display = 'none';
                availableStockSpan.innerHTML = '<span class="text-danger">零件不存在</span>';
            }
        })
        .catch(err => {
            console.log('載入庫存資訊失敗:', err);
            stockInfoCard.style.display = 'none';
            availableStockSpan.innerHTML = '<span class="text-danger">載入失敗</span>';
        });
}

// 更新可用庫存顯示
function updateAvailableStock() {
    const locationId = document.getElementById('warehouse_location_id').value;
    
    if (locationId && currentStock[locationId]) {
        const available = currentStock[locationId].available_quantity;
        const unit = currentStock[locationId].part_name || '';
        const className = available <= 0 ? 'text-danger' : available <= 10 ? 'text-warning' : 'text-success';
        document.getElementById('availableStock').innerHTML = `<span class="${className}"><strong>${available}</strong></span>`;
    } else {
        document.getElementById('availableStock').textContent = '請先選擇零件和儲位';
    }
}

// 過濾零件列表
function filterParts() {
    const filter = document.getElementById('partSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('.part-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(filter) ? '' : 'none';
    });
}

// 監聽零件編號和倉庫變化
document.getElementById('part_number').addEventListener('blur', function() {
    const partNumber = this.value.trim();
    if (partNumber) {
        fetch(`/api/part/${encodeURIComponent(partNumber)}`)
            .then(response => response.json())
            .then(data => {
                if (data.part_info) {
                    updateStockInfo(data.part_info.name, data.part_info.unit, data.part_info.locations);
                } else {
                    // Clear all related fields if part not found
                    document.getElementById('stockInfoCard').style.display = 'none';
                    document.getElementById('partNameDisplay').textContent = '';
                    document.getElementById('warehouse_location_id').innerHTML = '<option value="">選擇儲位</option>';
                    document.getElementById('availableStock').textContent = '請先選擇零件和儲位';
                }
            })
            .catch(err => {
                console.error('Error fetching part info:', err);
                document.getElementById('stockInfoCard').style.display = 'none';
                document.getElementById('partNameDisplay').textContent = '';
                document.getElementById('warehouse_location_id').innerHTML = '<option value="">選擇儲位</option>';
                document.getElementById('availableStock').textContent = '請先選擇零件和儲位';
            });
    } else {
        // Clear all related fields if part number input is empty
        document.getElementById('stockInfoCard').style.display = 'none';
        document.getElementById('partNameDisplay').textContent = '';
        document.getElementById('warehouse_location_id').innerHTML = '<option value="">選擇儲位</option>';
        document.getElementById('availableStock').textContent = '請先選擇零件和儲位';
    }
});
document.getElementById('warehouse_location_id').addEventListener('change', updateAvailableStock);

// 數量輸入驗證
document.getElementById('quantity').addEventListener('input', function() {
    const quantity = parseInt(this.value) || 0;
    const locationId = document.getElementById('warehouse_location_id').value;
    
    if (locationId && currentStock[locationId]) {
        const available = currentStock[locationId].available_quantity;
        
        if (quantity > available) {
            this.setCustomValidity(`數量不能超過可用庫存 ${available}`);
            this.classList.add('is-invalid');
        } else {
            this.setCustomValidity('');
            this.classList.remove('is-invalid');
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // Function to check and toggle the work order section visibility
    function toggleWorkOrderSection() {
        const transactionType = document.getElementById('transaction_type').value;
        const workOrderSection = document.getElementById('workOrderSection');
        if (transactionType === 'OUT_WORK_ORDER') {
            workOrderSection.style.display = 'block';
        } else {
            workOrderSection.style.display = 'none';
        }
    }

    // Add event listener for transaction type change
    document.getElementById('transaction_type').addEventListener('change', toggleWorkOrderSection);

    // Initial check on page load
    toggleWorkOrderSection();
});

// 表單驗證
document.querySelector('form').addEventListener('submit', function(e) {
    const partNumber = document.getElementById('part_number').value.trim();
    const locationId = document.getElementById('warehouse_location_id').value;
    const quantity = parseInt(document.getElementById('quantity').value) || 0;
    const transactionType = document.getElementById('transaction_type').value;
    
    if (!partNumber || !locationId || !quantity || !transactionType) {
        e.preventDefault();
        alert('請填寫所有必填欄位 (零件, 儲位, 數量, 類型)');
        return false;
    }
    
    // 工單領用的特殊驗證
    if (transactionType === 'OUT_WORK_ORDER') {
        const workOrderId = document.getElementById('work_order_id').value;
        if (!workOrderId) {
            e.preventDefault();
            alert('工單領用必須選擇工單編號');
            return false;
        }
    }
    
    if (quantity <= 0) {
        e.preventDefault();
        alert('數量必須大於0');
        return false;
    }
    
    // 檢查庫存
    if (currentStock[locationId]) {
        const available = currentStock[locationId].available_quantity;
        if (quantity > available) {
            e.preventDefault();
            alert(`庫存不足！可用數量：${available}`);
            return false;
        }
    }
});