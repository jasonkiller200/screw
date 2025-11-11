document.addEventListener('DOMContentLoaded', function() {
    const warehouseSelect = document.getElementById('warehouse_id');
    const transactionTypeSelect = document.getElementById('transaction_type');
    const workOrderIdInput = document.getElementById('work_order_id');
    const workOrderIdFeedback = document.getElementById('work-order-id-feedback');
    const itemListBody = document.getElementById('inventory-item-list');
    const itemSearchInput = document.getElementById('item-search');
    const selectAllCheckbox = document.getElementById('select-all');
    const submitButton = document.getElementById('submit-batch-stock-out');
    const itemCountSpan = document.getElementById('item-count');

    // Function to validate work order ID
    function validateWorkOrderId() {
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

    // Enable/disable Work Order ID based on transaction type and apply validation
    transactionTypeSelect.addEventListener('change', function() {
        if (this.value === 'OUT_WORK_ORDER') {
            workOrderIdInput.disabled = false;
            workOrderIdInput.value = '20000'; // Set default value
        } else {
            workOrderIdInput.disabled = true;
            workOrderIdInput.value = '';
        }
        validateWorkOrderId(); // Re-validate on type change
    });

    // Validate on work order ID input
    workOrderIdInput.addEventListener('input', validateWorkOrderId);

    // Initialize work order input and validation based on default selection
    if (transactionTypeSelect.value === 'OUT_WORK_ORDER') {
        workOrderIdInput.disabled = false;
        // workOrderIdInput.value is already '20000' from HTML
    } else {
        workOrderIdInput.disabled = true;
    }
    validateWorkOrderId(); // Initial validation on load

    // Fetch inventory when a warehouse is selected
    warehouseSelect.addEventListener('change', function() {
        const warehouseId = this.value;
        if (warehouseId) {
            loadInventoryForWarehouse(warehouseId);
            itemSearchInput.disabled = false;
            submitButton.disabled = false;
        } else {
            itemListBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><i class="fas fa-info-circle me-2"></i>請先選擇一個倉庫來載入庫存品項。</td></tr>';
            itemSearchInput.disabled = true;
            submitButton.disabled = true;
            itemCountSpan.textContent = '0 個品項';
        }
    });

    // Function to load inventory
    async function loadInventoryForWarehouse(warehouseId) {
        // TODO: We need an API endpoint to fetch inventory by warehouse
        // For now, let's assume we have a placeholder function
        
        // Show loading state
        itemListBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Loading...</span></div> 載入庫存中...</td></tr>';

        // This is a placeholder. We will need to create this API endpoint.
        // Let's assume the endpoint is `/api/inventory/warehouse/<warehouse_id>`
        try {
            // const response = await fetch(`/api/inventory/warehouse/${warehouseId}`);
            // if (!response.ok) {
            //     throw new Error('Network response was not ok');
            // }
            // const inventoryItems = await response.json();

            const response = await fetch(`/api/inventory/warehouse/${warehouseId}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const inventoryItems = await response.json();

            renderInventoryList(inventoryItems);

        } catch (error) {
            console.error('Error fetching inventory:', error);
            itemListBody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5"><i class="fas fa-times-circle me-2"></i>無法載入庫存資料，請稍後再試。</td></tr>';
        }
    }

    // Function to render the list
    function renderInventoryList(items) {
        itemListBody.innerHTML = '';
        if (items.length === 0) {
            itemListBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5"><i class="fas fa-box-open me-2"></i>此倉庫無庫存品項。</td></tr>';
            itemCountSpan.textContent = '0 個品項';
            return;
        }

        items.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.partId = item.part_id;
            row.dataset.locationId = item.location_id; // Corrected key

            row.innerHTML = `
                <td><input class="form-check-input item-checkbox" type="checkbox"></td>
                <td>${item.part_number}</td>
                <td>${item.part_name}</td>
                <td>${item.location_code}</td>
                <td>${item.available_quantity}</td>
                <td>
                    <input type="number" class="form-control form-control-sm stock-out-quantity" min="0" step="1" max="${item.available_quantity}" disabled>
                </td>
            `;
            itemListBody.appendChild(row);
        });
        itemCountSpan.textContent = `${items.length} 個品項`;
    }

    // Enable quantity input when checkbox is checked
    itemListBody.addEventListener('change', function(e) {
        if (e.target.classList.contains('item-checkbox')) {
            const quantityInput = e.target.closest('tr').querySelector('.stock-out-quantity');
            quantityInput.disabled = !e.target.checked;
            if (!e.target.checked) {
                quantityInput.value = '';
            }
        }
    });

    // Select/Deselect all
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = itemListBody.querySelectorAll('.item-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
            const quantityInput = checkbox.closest('tr').querySelector('.stock-out-quantity');
            quantityInput.disabled = !this.checked;
            if (!this.checked) {
                quantityInput.value = '';
            }
        });
    });

    // Filter items
    itemSearchInput.addEventListener('keyup', function() {
        const filter = this.value.toUpperCase();
        const rows = itemListBody.querySelectorAll('tr');
        rows.forEach(row => {
            const partNumber = row.cells[1].textContent.toUpperCase();
            const partName = row.cells[2].textContent.toUpperCase();
            if (partNumber.includes(filter) || partName.includes(filter)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });

    // --- Barcode Scan Tab Logic ---
    const barcodeInput = document.getElementById('barcode-input');
    const barcodeScanFeedbackDiv = document.getElementById('barcode-scan-feedback');
    const scannedItemsToSubmitBody = document.getElementById('scanned-items-to-submit');

    let scannedItemsMap = new Map(); // Map to store items added via barcode tab: key = part_id-location_id, value = {part_id, part_number, part_name, location_id, location_code, quantity, available_quantity, all_locations}

    // Function to display feedback messages
    function showBarcodeFeedback(message, type = 'info') {
        barcodeScanFeedbackDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        barcodeScanFeedbackDiv.style.display = 'block';
    }

    function clearBarcodeFeedback() {
        barcodeScanFeedbackDiv.innerHTML = '';
        barcodeScanFeedbackDiv.style.display = 'none';
    }

    // Handle barcode input
    barcodeInput.addEventListener('keypress', async function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission
            const barcode = this.value.trim();
            const warehouseId = warehouseSelect.value;

            if (!warehouseId) {
                showBarcodeFeedback('請先選擇來源倉庫。', 'warning');
                return;
            }
            if (!barcode) {
                showBarcodeFeedback('請掃描條碼。', 'warning');
                return;
            }

            showBarcodeFeedback('掃描中...', 'info');
            barcodeInput.disabled = true;

            try {
                const response = await fetch(`/api/inventory/part-by-barcode?barcode=${encodeURIComponent(barcode)}&warehouse_id=${warehouseId}`);
                const result = await response.json();

                if (response.ok) {
                    if (result.locations.length === 0) {
                        showBarcodeFeedback('此倉庫無此零件的可用儲位。', 'warning');
                    } else {
                        // Determine the initial location to use
                        let selectedLocation = result.locations[0];
                        // If part is already in map, try to find its existing location
                        const existingItemKey = `${result.part_id}-${selectedLocation.location_id}`;
                        if (scannedItemsMap.has(existingItemKey)) {
                            // If already scanned, increment quantity
                            let existingItem = scannedItemsMap.get(existingItemKey);
                            if (existingItem.quantity < existingItem.available_quantity) {
                                existingItem.quantity++;
                                scannedItemsMap.set(existingItemKey, existingItem);
                                showBarcodeFeedback(`零件 ${result.part_number} 數量已增加。`, 'success');
                            } else {
                                showBarcodeFeedback(`零件 ${result.part_number} 已達可用庫存上限。`, 'warning');
                            }
                        } else {
                            // Add new item to map
                            const itemToAdd = {
                                part_id: result.part_id,
                                part_number: result.part_number,
                                part_name: result.part_name,
                                location_id: result.locations.length === 1 ? selectedLocation.location_id : null, // Set to null if multiple locations
                                location_code: result.locations.length === 1 ? selectedLocation.location_code : '請選擇', // Set to '請選擇' if multiple locations
                                quantity: null, // Default to null for empty input
                                available_quantity: selectedLocation.available_quantity,
                                all_locations: result.locations // Store all locations for dropdown
                            };
                            scannedItemsMap.set(`${result.part_id}-${itemToAdd.location_id}`, itemToAdd);
                            showBarcodeFeedback(`零件 ${result.part_number} 已加入清單。`, 'success');
                        }
                        renderScannedItemsToSubmit();
                    }
                } else {
                    showBarcodeFeedback(result.error || '找不到零件或發生錯誤。', 'danger');
                }
            } catch (error) {
                console.error('Barcode scan error:', error);
                showBarcodeFeedback('網路錯誤或伺服器無回應。', 'danger');
            }
            finally {
                barcodeInput.value = '';
                barcodeInput.disabled = false;
                barcodeInput.focus();
            }
        }
    });

    function renderScannedItemsToSubmit() {
        scannedItemsToSubmitBody.innerHTML = '';
        if (scannedItemsMap.size === 0) {
            scannedItemsToSubmitBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">尚無掃描品項</td></tr>';
            return;
        }

        scannedItemsMap.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.itemKey = `${item.part_id}-${item.location_id}`;
            const displayedAvailableQuantity = item.location_id === null ? 0 : item.available_quantity;
            const quantityInputMax = item.location_id === null ? 0 : item.available_quantity;

            row.innerHTML = `
                <td>${item.part_number}</td>
                <td>${item.part_name}</td>
                <td>
                    ${item.all_locations.length > 1 ? 
                        `<select class="form-select form-select-sm scanned-location-select" data-part-id="${item.part_id}" data-original-key="${item.part_id}-${item.location_id}">
                            <option value="" ${item.location_id === null ? 'selected' : ''}>請選擇</option>
                            ${item.all_locations.map(loc => 
                                `<option value="${loc.location_id}" 
                                        data-available-quantity="${loc.available_quantity}"
                                        ${loc.location_id === item.location_id ? 'selected' : ''}>
                                    ${loc.location_code}
                                </option>`
                            ).join('')}
                        </select>`
                        : item.location_code
                    }
                </td>
                <td class="text-end available-quantity-display">${displayedAvailableQuantity}</td>
                <td>
                    <input type="number" class="form-control form-control-sm scanned-stock-out-quantity" 
                           value="${item.quantity === null ? '' : item.quantity}" 
                           min="1" 
                           max="${quantityInputMax}" 
                           data-item-key="${row.dataset.itemKey}">
                </td>
                <td>
                    <button type="button" class="btn btn-danger btn-sm remove-scanned-item" data-item-key="${row.dataset.itemKey}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            scannedItemsToSubmitBody.appendChild(row);
        });

        // Add event listeners for dynamic elements
        scannedItemsToSubmitBody.querySelectorAll('.remove-scanned-item').forEach(button => {
            button.addEventListener('click', function() {
                const itemKeyToRemove = this.dataset.itemKey;
                scannedItemsMap.delete(itemKeyToRemove);
                renderScannedItemsToSubmit();
            });
        });

        scannedItemsToSubmitBody.querySelectorAll('.scanned-stock-out-quantity').forEach(input => {
            input.addEventListener('change', function() {
                const itemKey = this.dataset.itemKey;
                const item = scannedItemsMap.get(itemKey);
                const newQuantity = parseInt(this.value, 10);
                if (!isNaN(newQuantity) && newQuantity > 0 && newQuantity <= item.available_quantity) {
                    item.quantity = newQuantity;
                    scannedItemsMap.set(itemKey, item);
                } else {
                    this.value = item.quantity; // Revert to old value if invalid
                    alert(`出庫數量必須大於 0 且不能超過可用庫存 (${item.available_quantity})。`);
                }
            });
        });

        scannedItemsToSubmitBody.querySelectorAll('.scanned-location-select').forEach(select => {
            select.addEventListener('change', function() {
                const oldItemKey = this.dataset.originalKey; // Use original key to find item in map
                const oldItem = scannedItemsMap.get(oldItemKey);
                const newLocationId = this.value === "" ? null : parseInt(this.value, 10);
                const newLocationCode = this.value === "" ? '請選擇' : this.options[this.selectedIndex].textContent.split(' ')[0];
                const newAvailableQuantity = this.value === "" ? 0 : parseInt(this.options[this.selectedIndex].dataset.availableQuantity, 10);

                // If '請選擇' is selected, prevent further action and alert
                if (newLocationId === null) {
                    alert('請選擇一個有效的儲位。');
                    // Do not update map yet, keep old itemKey
                    return;
                }

                // Check if the new part-location combination already exists
                const newItemKey = `${oldItem.part_id}-${newLocationId}`;
                if (scannedItemsMap.has(newItemKey) && newItemKey !== oldItemKey) {
                    alert('此零件與新儲位組合已存在於清單中，請勿重複選擇。');
                    this.value = oldItem.location_id; // Revert selection
                    return;
                }

                // Update the item in the map
                scannedItemsMap.delete(oldItemKey); // Remove old entry
                oldItem.location_id = newLocationId;
                oldItem.location_code = newLocationCode;
                oldItem.available_quantity = newAvailableQuantity;
                oldItem.quantity = Math.min(oldItem.quantity, newAvailableQuantity); // Adjust quantity if it exceeds new available
                scannedItemsMap.set(newItemKey, oldItem); // Add new entry
                
                renderScannedItemsToSubmit(); // Re-render to update row key and quantity input max
            });
        });
    }

    // --- Update Submit Button Logic ---
    submitButton.addEventListener('click', async function() {
        // Perform work order ID validation before proceeding
        if (!validateWorkOrderId()) {
            alert('請修正工單編號。');
            return;
        }

        const warehouseId = warehouseSelect.value;
        const transactionType = transactionTypeSelect.value;
        const workOrderId = workOrderIdInput.value;
        const notes = document.getElementById('notes').value;

        if (!warehouseId || !transactionType) {
            alert('請選擇來源倉庫和出庫類型。');
            return;
        }

        const itemsToSubmit = [];

        // Collect items from manual selection tab
        const checkedRows = itemListBody.querySelectorAll('.item-checkbox:checked');
        let manualValidationError = false;
        checkedRows.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const quantityInput = row.querySelector('.stock-out-quantity');
            const quantity = parseInt(quantityInput.value, 10);
            const available = parseInt(quantityInput.max, 10);

            if (isNaN(quantity) || quantity <= 0) {
                alert(`零件 ${row.cells[1].textContent} 的出庫數量必須是大於 0 的數字。`);
                manualValidationError = true;
                return;
            }
            if (quantity > available) {
                alert(`零件 ${row.cells[1].textContent} 的出庫數量不能超過可用庫存。`);
                manualValidationError = true;
                return;
            }

            itemsToSubmit.push({
                part_id: parseInt(row.dataset.partId, 10),
                warehouse_location_id: parseInt(row.dataset.locationId, 10),
                quantity: quantity
            });
        });

        if (manualValidationError) return;

        // Collect items from barcode scan tab
        let barcodeValidationError = false;
        scannedItemsMap.forEach(item => {
            // Validate location selection for multi-location items
            if (item.all_locations.length > 1 && (item.location_id === null || item.location_id === '')) {
                alert(`掃描零件 ${item.part_number} 尚未選擇儲位。`);
                barcodeValidationError = true;
                return;
            }

            if (isNaN(item.quantity) || item.quantity <= 0) {
                alert(`掃描零件 ${item.part_number} 的出庫數量必須是大於 0 的數字。`);
                barcodeValidationError = true;
                return;
            }
            if (item.quantity > item.available_quantity) {
                alert(`掃描零件 ${item.part_number} 的出庫數量 (${item.quantity}) 不能超過可用庫存 (${item.available_quantity})。`);
                barcodeValidationError = true;
                return;
            }
            itemsToSubmit.push({
                part_id: item.part_id,
                warehouse_location_id: item.location_id,
                quantity: item.quantity
            });
        });

        if (barcodeValidationError) return;

        if (itemsToSubmit.length === 0) {
            alert('請至少選擇一個要出庫的品項。');
            return;
        }

        const payload = {
            transaction_type: transactionType,
            notes: notes,
            items: itemsToSubmit
        };

        if (transactionType === 'OUT_WORK_ORDER' && workOrderId) {
            payload.work_order_id = workOrderId;
        }

        // Disable button to prevent double-submission
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';

        try {
            const response = await fetch('/api/inventory/batch-stock-out', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                alert('批量出庫成功！');
                // Reload inventory for the warehouse to show updated stock
                loadInventoryForWarehouse(warehouseId);
                scannedItemsMap.clear(); // Clear scanned items after successful submission
                renderScannedItemsToSubmit(); // Re-render scanned items list
            } else {
                alert(`出庫失敗: ${result.error || '未知錯誤'}`);
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('提交時發生網路錯誤。');
        } finally {
            // Re-enable button
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-check me-2"></i>確認批量出庫';
        }
    });
});
