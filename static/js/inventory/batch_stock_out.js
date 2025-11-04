document.addEventListener('DOMContentLoaded', function() {
    const warehouseSelect = document.getElementById('warehouse_id');
    const transactionTypeSelect = document.getElementById('transaction_type');
    const workOrderIdInput = document.getElementById('work_order_id');
    const itemListBody = document.getElementById('inventory-item-list');
    const itemSearchInput = document.getElementById('item-search');
    const selectAllCheckbox = document.getElementById('select-all');
    const submitButton = document.getElementById('submit-batch-stock-out');
    const itemCountSpan = document.getElementById('item-count');

    // Enable/disable Work Order ID based on transaction type
    transactionTypeSelect.addEventListener('change', function() {
        if (this.value === 'OUT_WORK_ORDER') {
            workOrderIdInput.disabled = false;
        } else {
            workOrderIdInput.disabled = true;
            workOrderIdInput.value = '';
        }
    });

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
                    <input type="number" class="form-control form-control-sm stock-out-quantity" min="0" max="${item.available_quantity}" disabled>
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

    // Handle submission
    submitButton.addEventListener('click', async function() {
        const warehouseId = warehouseSelect.value;
        const transactionType = transactionTypeSelect.value;
        const workOrderId = workOrderIdInput.value;
        const notes = document.getElementById('notes').value;

        if (!warehouseId || !transactionType) {
            alert('請選擇來源倉庫和出庫類型。');
            return;
        }

        const itemsToSubmit = [];
        const checkedRows = itemListBody.querySelectorAll('.item-checkbox:checked');

        let validationError = false;
        checkedRows.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const quantityInput = row.querySelector('.stock-out-quantity');
            const quantity = parseInt(quantityInput.value, 10);
            const available = parseInt(quantityInput.max, 10);

            if (isNaN(quantity) || quantity <= 0) {
                alert(`零件 ${row.cells[1].textContent} 的出庫數量必須是大於 0 的數字。`);
                validationError = true;
                return;
            }
            if (quantity > available) {
                alert(`零件 ${row.cells[1].textContent} 的出庫數量不能超過可用庫存。`);
                validationError = true;
                return;
            }

            itemsToSubmit.push({
                part_id: parseInt(row.dataset.partId, 10),
                warehouse_location_id: parseInt(row.dataset.locationId, 10),
                quantity: quantity
            });
        });

        if (validationError) return;

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
