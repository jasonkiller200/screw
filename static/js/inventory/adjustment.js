document.addEventListener('DOMContentLoaded', function() {
    const partSearchInput = document.getElementById('part-search');
    const partSearchResults = document.getElementById('part-search-results');
    const adjustmentForm = document.getElementById('adjustment-form');
    const locationSelect = document.getElementById('location-select');
    const currentQuantityInput = document.getElementById('current-quantity');
    const newQuantityInput = document.getElementById('new-quantity');
    const quantityDiffInput = document.getElementById('quantity-diff');
    const submitButton = document.getElementById('submit-adjustment');

    let debounceTimer;
    let partLocationsData = []; // To store inventory data for the selected part

    // 1. Part Search
    partSearchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = partSearchInput.value.trim();
            if (query.length < 2) {
                partSearchResults.style.display = 'none';
                return;
            }
            searchParts(query);
        }, 300);
    });

    // 2. Location selection change
    locationSelect.addEventListener('change', () => {
        const selectedLocationId = parseInt(locationSelect.value, 10);
        const locationData = partLocationsData.find(loc => loc.warehouse_location_id === selectedLocationId);
        
        if (locationData) {
            currentQuantityInput.value = locationData.quantity_on_hand;
        } else {
            currentQuantityInput.value = '0';
        }
        updateQuantityDiff();
    });

    // 3. New quantity input change
    newQuantityInput.addEventListener('input', updateQuantityDiff);

    // 4. Submit adjustment
    submitButton.addEventListener('click', submitAdjustment);

    function searchParts(query) {
        fetch(`/api/parts/search?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                partSearchResults.innerHTML = '';
                if (data.parts && data.parts.length > 0) {
                    data.parts.forEach(part => {
                        const item = document.createElement('a');
                        item.href = '#';
                        item.className = 'list-group-item list-group-item-action';
                        item.innerHTML = `<strong>${part.part_number}</strong> - ${part.name}`;
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            selectPart(part);
                        });
                        partSearchResults.appendChild(item);
                    });
                    partSearchResults.style.display = 'block';
                } else {
                    partSearchResults.style.display = 'none';
                }
            })
            .catch(error => console.error('Error searching parts:', error));
    }

    function selectPart(part) {
        partSearchInput.value = `${part.part_number} - ${part.name}`;
        partSearchResults.style.display = 'none';

        document.getElementById('selected-part-id').value = part.id;
        document.getElementById('selected-part-name').textContent = part.name;
        document.getElementById('selected-part-number').textContent = part.part_number;

        fetchLocationsAndStock(part);
    }

    function fetchLocationsAndStock(part) {
        if (!part || !part.part_number) {
            console.error("Invalid part object passed to fetchLocationsAndStock");
            return;
        }

        // 先獲取庫存資訊
        fetch(`/api/part/${part.part_number}`)
            .then(response => response.json())
            .then(data => {
                partLocationsData = data.inventories || [];
                
                // 如果有庫存記錄，使用庫存資訊
                if (partLocationsData.length > 0) {
                    locationSelect.innerHTML = '<option value="">-- 請選擇儲位 --</option>';
                    partLocationsData.forEach(inv => {
                        const option = document.createElement('option');
                        option.value = inv.warehouse_location_id;
                        option.textContent = `${inv.warehouse_name} - ${inv.location_code}`;
                        locationSelect.appendChild(option);
                    });
                    
                    // 如果只有一個儲位，自動選擇並觸發變更事件
                    if (partLocationsData.length === 1) {
                        locationSelect.value = partLocationsData[0].warehouse_location_id;
                        locationSelect.dispatchEvent(new Event('change'));
                    }
                    
                    adjustmentForm.style.display = 'block';
                } else {
                    // 如果沒有庫存記錄，獲取零件的所有儲位
                    fetchPartLocations(part.part_number);
                }
                // Reset quantities
                currentQuantityInput.value = '';
                newQuantityInput.value = '';
                quantityDiffInput.value = '';
            })
            .catch(error => {
                console.error('Error fetching stock:', error);
                // 如果獲取庫存失敗，嘗試獲取儲位
                fetchPartLocations(part.part_number);
            });
    }

    function fetchPartLocations(partNumber) {
        // 獲取零件的所有儲位（用於沒有庫存記錄的情況）
        fetch(`/api/part/${partNumber}/locations`)
            .then(response => response.json())
            .then(data => {
                if (data.locations && data.locations.length > 0) {
                    locationSelect.innerHTML = '<option value="">-- 請選擇儲位 --</option>';
                    // 將儲位資訊轉換為與庫存資料相同的格式
                    partLocationsData = data.locations.map(loc => ({
                        warehouse_location_id: loc.id,
                        warehouse_name: loc.warehouse_name,
                        location_code: loc.location_code,
                        quantity_on_hand: 0
                    }));
                    
                    partLocationsData.forEach(loc => {
                        const option = document.createElement('option');
                        option.value = loc.warehouse_location_id;
                        option.textContent = `${loc.warehouse_name} - ${loc.location_code}`;
                        locationSelect.appendChild(option);
                    });
                    
                    // 如果只有一個儲位，自動選擇並觸發變更事件
                    if (partLocationsData.length === 1) {
                        locationSelect.value = partLocationsData[0].warehouse_location_id;
                        locationSelect.dispatchEvent(new Event('change'));
                    }
                    
                    // 顯示提示訊息
                    adjustmentForm.style.display = 'block';
                    const existingAlert = adjustmentForm.querySelector('.alert-info');
                    if (!existingAlert) {
                        const alertDiv = document.createElement('div');
                        alertDiv.className = 'alert alert-info alert-dismissible fade show mt-3';
                        alertDiv.innerHTML = `
                            <i class="fas fa-info-circle me-2"></i>
                            此零件目前無庫存記錄，您可以輸入盤點後的實際數量來建立初始庫存。
                            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                        `;
                        adjustmentForm.insertBefore(alertDiv, adjustmentForm.firstChild);
                    }
                } else {
                    alert('此零件尚未指定儲位，請先在零件管理中設定儲位。');
                    adjustmentForm.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Error fetching part locations:', error);
                alert('獲取儲位資訊失敗。');
                adjustmentForm.style.display = 'none';
            });
    }
    
    function updateQuantityDiff() {
        const currentQty = parseInt(currentQuantityInput.value, 10) || 0;
        const newQty = parseInt(newQuantityInput.value, 10);

        if (!isNaN(newQty)) {
            const diff = newQty - currentQty;
            quantityDiffInput.value = diff > 0 ? `+${diff}` : diff;
        } else {
            quantityDiffInput.value = '';
        }
    }

    function submitAdjustment() {
        const partId = document.getElementById('selected-part-id').value;
        const locationId = locationSelect.value;
        const newQuantity = newQuantityInput.value;
        const notes = document.getElementById('adjustment-notes').value;

        if (!partId || !locationId) {
            alert('請先選擇一個零件和儲位。');
            return;
        }

        if (newQuantity === '' || newQuantity < 0) {
            alert('請輸入一個有效的新數量 (大於等於0)。');
            return;
        }

        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';

        fetch('/api/inventory/adjust-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                part_id: parseInt(partId, 10),
                location_id: parseInt(locationId, 10),
                new_quantity: parseInt(newQuantity, 10),
                notes: notes
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message || '庫存調整成功！');
                // Reset form for next adjustment
                partSearchInput.value = '';
                adjustmentForm.style.display = 'none';
            } else {
                throw new Error(data.error || '未知錯誤');
            }
        })
        .catch(error => {
            alert(`調整失敗：${error.message}`);
        })
        .finally(() => {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-check me-1"></i>確認調整';
        });
    }
});
