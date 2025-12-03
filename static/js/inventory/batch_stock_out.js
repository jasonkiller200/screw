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

    // --- Template Management Functions ---
    const templateSelect = document.getElementById('template-select');
    const loadTemplateBtn = document.getElementById('load-template');
    const previewTemplateBtn = document.getElementById('preview-template');
    const editTemplateBtn = document.getElementById('edit-template');
    const deleteTemplateBtn = document.getElementById('delete-template');
    const newTemplateNameInput = document.getElementById('new-template-name');
    const saveAsTemplateBtn = document.getElementById('save-as-template');
    const templatePreviewList = document.getElementById('template-preview-list');
    const cancelEditBtn = document.getElementById('cancel-edit-template'); // Assume this button exists in HTML

    let isEditMode = false;
    let editingTemplateId = null;

    function enterEditMode(templateId, templateName) {
        isEditMode = true;
        editingTemplateId = templateId;
        
        newTemplateNameInput.value = templateName;
        saveAsTemplateBtn.innerHTML = '<i class="fas fa-sync-alt me-2"></i>更新模板';
        
        // Dynamically create and show cancel button if it doesn't exist
        if (!document.getElementById('cancel-edit-template')) {
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.id = 'cancel-edit-template';
            cancelButton.className = 'btn btn-secondary ms-2';
            cancelButton.innerHTML = '<i class="fas fa-times me-2"></i>取消編輯';
            cancelButton.addEventListener('click', exitEditMode);
            saveAsTemplateBtn.parentNode.insertBefore(cancelButton, saveAsTemplateBtn.nextSibling);
        }

        templateSelect.disabled = true;
        loadTemplateBtn.disabled = true;
        previewTemplateBtn.disabled = true;
        editTemplateBtn.disabled = true;
        deleteTemplateBtn.disabled = true;
        
        updateSaveTemplateButton();
    }

    function exitEditMode() {
        isEditMode = false;
        editingTemplateId = null;

        newTemplateNameInput.value = '';
        saveAsTemplateBtn.innerHTML = '<i class="fas fa-save me-2"></i>儲存當前清單為模板';

        // Remove the dynamically created cancel button
        const cancelButton = document.getElementById('cancel-edit-template');
        if (cancelButton) {
            cancelButton.remove();
        }

        templateSelect.disabled = false;
        
        updateTemplateButtons();
        updateSaveTemplateButton();
    }

    // Load templates when warehouse changes
    function loadTemplatesForWarehouse(warehouseId) {
        exitEditMode(); // Exit edit mode when warehouse changes
        if (!warehouseId) {
            templateSelect.innerHTML = '<option value="">請先選擇倉庫...</option>';
            disableTemplateButtons();
            return;
        }

        templateSelect.innerHTML = '<option value="">載入中...</option>';
        
        fetch(`/api/templates/stock-out?warehouse_id=${warehouseId}`)
            .then(response => response.json())
            .then(data => {
                templateSelect.innerHTML = '<option value="">請選擇模板...</option>';
                
                if (data.success && data.templates.length > 0) {
                    data.templates.forEach(template => {
                        const option = document.createElement('option');
                        option.value = template.id;
                        option.textContent = `${template.name} (${template.items_count} 個品項)`;
                        templateSelect.appendChild(option);
                    });
                } else {
                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = '無可用模板';
                    templateSelect.appendChild(option);
                }
                updateTemplateButtons(); // Update buttons after loading
            })
            .catch(error => {
                console.error('Error loading templates:', error);
                templateSelect.innerHTML = '<option value="">載入失敗</option>';
            });
    }

    // Enable/disable template buttons based on selection
    function updateTemplateButtons() {
        const hasSelection = templateSelect.value !== '';
        loadTemplateBtn.disabled = !hasSelection;
        previewTemplateBtn.disabled = !hasSelection;
        editTemplateBtn.disabled = !hasSelection;
        deleteTemplateBtn.disabled = !hasSelection;
    }

    function disableTemplateButtons() {
        loadTemplateBtn.disabled = true;
        previewTemplateBtn.disabled = true;
        editTemplateBtn.disabled = true;
        deleteTemplateBtn.disabled = true;
    }

    // Update save template button based on manual selections
    function updateSaveTemplateButton() {
        const checkedRows = itemListBody.querySelectorAll('.item-checkbox:checked');
        const hasManualSelections = checkedRows.length > 0;
        const hasTemplateName = newTemplateNameInput.value.trim() !== '';
        const hasWarehouse = warehouseSelect.value !== '';
        
        saveAsTemplateBtn.disabled = !(hasManualSelections && hasTemplateName && hasWarehouse);
    }

    // Event listeners for template management
    templateSelect.addEventListener('change', updateTemplateButtons);
    
    newTemplateNameInput.addEventListener('input', updateSaveTemplateButton);

    // Edit Template
    editTemplateBtn.addEventListener('click', async function() {
        const templateId = templateSelect.value;
        if (!templateId) return;

        try {
            const response = await fetch(`/api/templates/stock-out/${templateId}`);
            const data = await response.json();
            
            if (data.success && data.template) {
                // Enter edit mode
                enterEditMode(templateId, data.template.name);
                // Load items into manual selection list
                loadTemplateIntoManualSelection(data.template.items);
                // Switch to manual tab for editing
                document.getElementById('manual-tab').click();
            } else {
                alert('載入模板編輯失敗: ' + (data.error || '未知錯誤'));
            }
        } catch (error) {
            console.error('Error loading template for editing:', error);
            alert('載入模板進行編輯時發生錯誤');
        }
    });

    // Cancel Edit
    if(cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            exitEditMode();
        });
    }

    // Preview template
    previewTemplateBtn.addEventListener('click', async function() {
        const templateId = templateSelect.value;
        if (!templateId) return;

        try {
            const response = await fetch(`/api/templates/stock-out/${templateId}`);
            const data = await response.json();
            
            if (data.success) {
                renderTemplatePreview(data.template.items);
            } else {
                alert('載入模板預覽失敗: ' + data.error);
            }
        } catch (error) {
            console.error('Error previewing template:', error);
            alert('載入模板預覽時發生錯誤');
        }
    });

    // Load template into manual selection
    loadTemplateBtn.addEventListener('click', async function() {
        const templateId = templateSelect.value;
        if (!templateId) return;

        try {
            const response = await fetch(`/api/templates/stock-out/${templateId}`);
            const data = await response.json();
            
            if (data.success) {
                loadTemplateIntoManualSelection(data.template.items);
                // Switch to manual tab
                document.getElementById('manual-tab').click();
            } else {
                alert('載入模板失敗: ' + data.error);
            }
        } catch (error) {
            console.error('Error loading template:', error);
            alert('載入模板時發生錯誤');
        }
    });

    // Save or Update template
    saveAsTemplateBtn.addEventListener('click', async function() {
        const templateName = newTemplateNameInput.value.trim();
        const warehouseId = warehouseSelect.value;
        
        if (!templateName) {
            alert('請輸入模板名稱');
            return;
        }
        if (!isEditMode && !warehouseId) {
            alert('請選擇倉庫');
            return;
        }

        const checkedRows = itemListBody.querySelectorAll('.item-checkbox:checked');
        const templateItems = [];
        let hasInvalidQuantity = false;
        
        checkedRows.forEach(checkbox => {
            const row = checkbox.closest('tr');
            const quantityInput = row.querySelector('.stock-out-quantity');
            const quantity = parseInt(quantityInput.value, 10);
            
            if (isNaN(quantity) || quantity <= 0) {
                // Instead of alerting, mark as invalid and highlight the field
                quantityInput.classList.add('is-invalid');
                hasInvalidQuantity = true;
            } else {
                 quantityInput.classList.remove('is-invalid');
            }
            
            templateItems.push({
                part_id: parseInt(row.dataset.partId, 10),
                warehouse_location_id: parseInt(row.dataset.locationId, 10),
                default_quantity: quantity
            });
        });

        if (hasInvalidQuantity) {
            alert('部分品項數量無效(必須大於0)，請檢查標紅的欄位。');
            return;
        }

        if (templateItems.length === 0) {
            alert('請至少選擇一個品項加入模板');
            return;
        }

        const payload = {
            name: templateName,
            items: templateItems
        };
        // For new templates, we need the warehouse_id
        if (!isEditMode) {
            payload.warehouse_id = parseInt(warehouseId, 10);
        }

        const url = isEditMode 
            ? `/api/templates/stock-out/${editingTemplateId}` 
            : '/api/templates/stock-out';
        
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            this.disabled = true;
            this.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> ${isEditMode ? '更新中' : '儲存中'}...`;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            
            if (result.success) {
                alert(`模板${isEditMode ? '更新' : '儲存'}成功！`);
                exitEditMode();
                loadTemplatesForWarehouse(warehouseId); // Refresh template list
            } else {
                alert(`模板${isEditMode ? '更新' : '儲存'}失敗: ${result.message}`);
            }
        } catch (error) {
            console.error(`Error ${isEditMode ? 'updating' : 'saving'} template:`, error);
            alert(`模板${isEditMode ? '更新' : '儲存'}時發生錯誤`);
        } finally {
            this.disabled = false;
            // The text is reset in exitEditMode()
        }
    });

    // Delete template
    deleteTemplateBtn.addEventListener('click', async function() {
        const templateId = templateSelect.value;
        if (!templateId) return;

        const templateName = templateSelect.options[templateSelect.selectedIndex].text;
        if (!confirm(`確定要刪除模板「${templateName}」嗎？`)) {
            return;
        }

        try {
            const response = await fetch(`/api/templates/stock-out/${templateId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.success) {
                alert('模板刪除成功！');
                loadTemplatesForWarehouse(warehouseSelect.value); // Refresh template list
                templatePreviewList.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">請選擇模板以預覽內容</td></tr>';
            } else {
                alert('刪除模板失敗: ' + result.message);
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('刪除模板時發生錯誤');
        }
    });

    // Helper functions
    function renderTemplatePreview(items) {
        templatePreviewList.innerHTML = '';
        
        if (items.length === 0) {
            templatePreviewList.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">此模板無項目</td></tr>';
            return;
        }

        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.part_number}</td>
                <td>${item.part_name}</td>
                <td>${item.location_code || '未指定'}</td>
                <td class="current-stock" data-part-id="${item.part_id}" data-location-id="${item.warehouse_location_id}">載入中...</td>
                <td>${item.default_quantity}</td>
            `;
            templatePreviewList.appendChild(row);
            
            // Load current stock for this item
            loadCurrentStockForPreview(item.part_id, item.warehouse_location_id);
        });
    }

    async function loadCurrentStockForPreview(partId, locationId) {
        try {
            const warehouseId = warehouseSelect.value;
            if (!warehouseId) return; // Do not fetch if no warehouse is selected

            const response = await fetch(`/api/inventory/warehouse/${warehouseId}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const inventoryData = await response.json();
            
            const item = inventoryData.find(inv => 
                inv.part_id === partId && inv.location_id === locationId
            );
            
            const stockCell = document.querySelector(`.current-stock[data-part-id="${partId}"][data-location-id="${locationId}"]`);
            if (stockCell) {
                stockCell.textContent = item ? item.available_quantity : '0';
                if (item) {
                     // Add a visual indicator if the stock is low or out
                    const requiredQty = parseInt(stockCell.closest('tr').cells[3].textContent, 10);
                    if (item.available_quantity < requiredQty) {
                        stockCell.classList.add('text-danger', 'fw-bold');
                        stockCell.title = `庫存不足 (需求: ${requiredQty}, 現有: ${item.available_quantity})`;
                    } else if (item.available_quantity === 0) {
                        stockCell.classList.add('text-muted');
                        stockCell.title = '無庫存';
                    }
                }
            }
        } catch (error) {
            console.error('Error loading current stock:', error);
            const stockCell = document.querySelector(`.current-stock[data-part-id="${partId}"][data-location-id="${locationId}"]`);
            if (stockCell) {
                stockCell.textContent = '錯誤';
                stockCell.classList.add('text-danger');
            }
        }
    }

    function loadTemplateIntoManualSelection(items) {
        // Clear current selections
        const checkboxes = itemListBody.querySelectorAll('.item-checkbox');
        checkboxes.forEach(cb => cb.checked = false);

        items.forEach(templateItem => {
            // Find the corresponding row in manual selection
            const targetRow = Array.from(itemListBody.querySelectorAll('tr')).find(row => {
                return row.dataset.partId == templateItem.part_id && 
                       row.dataset.locationId == templateItem.warehouse_location_id;
            });

            if (targetRow) {
                const checkbox = targetRow.querySelector('.item-checkbox');
                const quantityInput = targetRow.querySelector('.stock-out-quantity');
                
                if (checkbox && quantityInput) {
                    checkbox.checked = true;
                    quantityInput.value = templateItem.default_quantity;
                }
            }
        });

        updateItemCount();
    }

    // Update warehouse change handler to also load templates
    const originalWarehouseChangeHandler = warehouseSelect.onchange;
    warehouseSelect.addEventListener('change', function() {
        loadTemplatesForWarehouse(this.value);
        templatePreviewList.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">請選擇模板以預覽內容</td></tr>';
        updateSaveTemplateButton();
    });

    // Update manual selection change handler to update save button
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('item-checkbox') || e.target.classList.contains('stock-out-quantity')) {
            updateSaveTemplateButton();
        }
    });

    // Global function for removing items from preview (referenced in HTML)
    window.removeFromPreview = function(button) {
        button.closest('tr').remove();
    };

    // Add missing updateItemCount function
    function updateItemCount() {
        const checkedRows = itemListBody.querySelectorAll('.item-checkbox:checked');
        itemCountSpan.textContent = `${checkedRows.length} 個品項`;
    }

    // Initialize template buttons as disabled
    disableTemplateButtons();

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
                alert('批量出庫成功！頁面將會刷新以更新庫存資訊。');
                // Reload the page to reflect changes everywhere
                location.reload();
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
