// 開啟零件選擇模態框
function openPartSelect() {
    const modal = new bootstrap.Modal(document.getElementById('partSelectModal'));
    modal.show();
}

// 選擇零件
function selectPart(partNumber, partName, unit, locations) {
    document.getElementById('part_number').value = partNumber;
    bootstrap.Modal.getInstance(document.getElementById('partSelectModal')).hide();
    
    // 顯示零件資訊
    showPartInfo(partNumber, partName, unit, locations);
}

// 顯示零件資訊
function showPartInfo(partNumber, partName, unit, locations) {
    const partInfoCard = document.getElementById('partInfoCard');
    const partInfoContent = document.getElementById('partInfoContent');
    const partNameDisplay = document.getElementById('partNameDisplay');
    const warehouseSelect = document.getElementById('warehouse_id');

    // Update part name display next to input
    partNameDisplay.textContent = partName || '';

    // Populate warehouse dropdown
    warehouseSelect.innerHTML = '<option value="">選擇倉庫</option>'; // Clear existing options
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

    partInfoContent.innerHTML = `
        <p><strong>編號：</strong>${partNumber}</p>
        <p><strong>名稱：</strong>${partName}</p>
        <p><strong>單位：</strong>${unit}</p>
        <div class="text-muted">
            <small>正在載入庫存資訊...</small>
        </div>
    `;
    
    partInfoCard.style.display = 'block';
    
    // Load stock info (existing logic)
    fetch(`/api/inventory/stock/${encodeURIComponent(partNumber)}`)
        .then(response => response.json())
        .then(data => {
            if (data.stock_info) {
                let stockHtml = '<div class="mt-2"><h6>現有庫存：</h6>';
                if (Array.isArray(data.stock_info)) {
                    data.stock_info.forEach(stock => {
                        stockHtml += `<small>${stock.warehouse_name}: ${stock.quantity_on_hand} ${unit}</small><br>`;
                    });
                } else {
                    stockHtml += `<small>${data.stock_info.warehouse_name}: ${data.stock_info.quantity_on_hand} ${unit}</small>`;
                }
                stockHtml += '</div>';
                
                partInfoContent.innerHTML = `
                    <p><strong>編號：</strong>${partNumber}</p>
                    <p><strong>名稱：</strong>${partName}</p>
                    <p><strong>單位：</strong>${unit}</p>
                    ${stockHtml}
                `;
            }
        })
        .catch(err => {
            console.log('載入庫存資訊失敗:', err);
        });
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

// 監聽零件編號輸入
document.getElementById('part_number').addEventListener('blur', function() {
    const partNumber = this.value.trim();
    if (partNumber) {
        // 驗證零件是否存在
        fetch(`/api/part/${encodeURIComponent(partNumber)}`)
            .then(response => response.json())
            .then(data => {
                if (data.part_info) {
                    showPartInfo(data.part_info.part_number, data.part_info.name, data.part_info.unit, data.part_info.locations);
                } else {
                    document.getElementById('partInfoCard').style.display = 'none';
                    document.getElementById('partNameDisplay').textContent = ''; // Clear part name
                    document.getElementById('warehouse_id').innerHTML = '<option value="">選擇倉庫</option>'; // Clear warehouse dropdown
                }
            })
            .catch(err => {
                document.getElementById('partInfoCard').style.display = 'none';
                document.getElementById('partNameDisplay').textContent = ''; // Clear part name
                document.getElementById('warehouse_id').innerHTML = '<option value="">選擇倉庫</option>'; // Clear warehouse dropdown
            });
    } else {
        document.getElementById('partInfoCard').style.display = 'none';
        document.getElementById('partNameDisplay').textContent = ''; // Clear part name
        document.getElementById('warehouse_id').innerHTML = '<option value="">選擇倉庫</option>'; // Clear warehouse dropdown
    }
});

// 表單驗證
document.querySelector('form').addEventListener('submit', function(e) {
    const partNumber = document.getElementById('part_number').value.trim();
    const warehouseId = document.getElementById('warehouse_id').value;
    const quantity = document.getElementById('quantity').value;
    const transactionType = document.getElementById('transaction_type').value;
    
    if (!partNumber || !warehouseId || !quantity || !transactionType) {
        e.preventDefault();
        alert('請填寫所有必填欄位');
        return false;
    }
    
    if (parseInt(quantity) <= 0) {
        e.preventDefault();
        alert('數量必須大於0');
        return false;
    }
});