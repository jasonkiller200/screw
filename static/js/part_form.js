document.addEventListener('DOMContentLoaded', function() {
    const locationInputsContainer = document.getElementById('location-inputs');
    const addLocationBtn = document.getElementById('add-location-btn');
    
    let allWarehouses = []; // Store warehouse data globally in this scope
    let locationCounter = 0; // Unique counter for new locations

    // Function to generate the HTML for a single location input group (card)
    function renderLocationInputGroup(locData = {}, currentInventory = {}, isNew = true) {
        const idPrefix = isNew ? `new-${locationCounter++}` : `existing-${locData.id}`;
        
        // Default values for procurement parameters
        const defaultSafetyStock = 0;
        const defaultReorderPoint = 0;
        const defaultDesiredDays = 30;
        const defaultMoq = 1;

        // Use provided data or defaults
        const warehouseId = locData.warehouse_id || '';
        const warehouseName = locData.warehouse_name || '選擇倉庫';
        const locationCode = locData.location_code || '';
        const stockQuantity = currentInventory.quantity_on_hand || 0;
        const safetyStock = currentInventory.safety_stock || defaultSafetyStock;
        const reorderPoint = currentInventory.reorder_point || defaultReorderPoint;
        const desiredDays = currentInventory.desired_days_of_stock || defaultDesiredDays;
        const moq = currentInventory.moq || defaultMoq;

        const container = document.createElement('div');
        container.classList.add('card', 'mb-3', 'location-input-group');
        container.dataset.warehouseLocationId = locData.id || 'new'; // For identification if needed

        container.innerHTML = `
            <div class="card-body">
                <div class="row g-2">
                    <div class="col-md-4">
                        <label class="form-label visually-hidden">倉庫</label>
                        <select class="form-select location-warehouse-select" name="location_warehouse_id[]" ${isNew ? '' : 'disabled'}>
                            <option value="">選擇倉庫</option>
                            ${!isNew ? `<option value="${warehouseId}" selected>${warehouseName}</option>` : ''}
                        </select>
                        ${!isNew ? `<input type="hidden" name="location_warehouse_id[]" value="${warehouseId}">` : ''}
                    </div>
                    <div class="col-md-4">
                        <label class="form-label visually-hidden">位置代碼</label>
                        <input type="text" class="form-control location-code-input" name="location_code[]" value="${locationCode}" placeholder="位置代碼" ${isNew ? '' : 'disabled'}>
                        ${!isNew ? `<input type="hidden" name="location_code[]" value="${locationCode}">` : ''}
                    </div>
                    <div class="col-md-3">
                        <label class="form-label visually-hidden">庫存</label>
                        <span class="input-group-text text-muted small w-100">目前庫存: ${stockQuantity}</span>
                    </div>
                    <div class="col-md-1 d-flex align-items-end">
                        <button type="button" class="btn btn-outline-danger remove-location-btn w-100" data-stock-quantity="${stockQuantity}"><i class="fas fa-times"></i></button>
                    </div>
                </div>
                <hr class="my-2">
                <div class="row g-2">
                    <div class="col-md-3">
                        <label for="location_safety_stock_${idPrefix}" class="form-label small">安全庫存 <span class="text-danger">*</span></label>
                        <input type="number" class="form-control form-control-sm" id="location_safety_stock_${idPrefix}" name="location_safety_stock[]" value="${safetyStock}" min="0" required>
                    </div>
                    <div class="col-md-3">
                        <label for="location_reorder_point_${idPrefix}" class="form-label small">補貨點 <span class="text-danger">*</span></label>
                        <input type="number" class="form-control form-control-sm" id="location_reorder_point_${idPrefix}" name="location_reorder_point[]" value="${reorderPoint}" min="0" required>
                    </div>
                    <div class="col-md-3">
                        <label for="location_desired_days_of_stock_${idPrefix}" class="form-label small">預計存貨天數 <span class="text-danger">*</span></label>
                        <input type="number" class="form-control form-control-sm" id="location_desired_days_of_stock_${idPrefix}" name="location_desired_days_of_stock[]" value="${desiredDays}" min="0" required>
                    </div>
                    <div class="col-md-3">
                        <label for="location_moq_${idPrefix}" class="form-label small">最小訂購量 <span class="text-danger">*</span></label>
                        <input type="number" class="form-control form-control-sm" id="location_moq_${idPrefix}" name="location_moq[]" value="${moq}" min="1" required>
                    </div>
                </div>
            </div>
        `;
        
        // If it's a new group, populate its warehouse select with all options
        if (isNew) {
            const selectElement = container.querySelector('.location-warehouse-select');
            populateSelect(selectElement, allWarehouses);
        }

        return container;
    }

    // Function to populate a single select element with warehouse options
    function populateSelect(selectElement, warehouses) {
        // Clear existing options, except the first "選擇倉庫" or selected
        if (selectElement.options.length > 1 || (selectElement.options.length === 1 && selectElement.value !== "")) {
             // Only clear if not a new select element or if it has dynamically added options
            selectElement.innerHTML = '<option value="">選擇倉庫</option>';
        }

        warehouses.forEach(w => {
            const option = document.createElement('option');
            option.value = w.id;
            option.textContent = w.name;
            selectElement.appendChild(option);
        });

        // If the select had a pre-selected value (from server-side rendering for existing locations),
        // ensure it remains selected if it exists in the new list.
        const preSelectedValue = selectElement.dataset.preselected || '';
        if (preSelectedValue && selectElement.querySelector(`option[value="${preSelectedValue}"]`)) {
             selectElement.value = preSelectedValue;
        }
    }

    // Fetch warehouse data and populate all existing dropdowns
    fetch('/api/warehouses')
        .then(response => response.json())
        .then(warehouses => {
            allWarehouses = warehouses; // Store for later use
            
            // Populate all initially rendered select elements
            const existingSelects = document.querySelectorAll('.location-warehouse-select');
            existingSelects.forEach(select => {
                // If the select is not disabled (meaning it's for a new location), populate it
                if (!select.disabled) {
                    populateSelect(select, allWarehouses);
                }
            });

            if(addLocationBtn) {
                 addLocationBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Failed to fetch warehouses:', error);
            if(addLocationBtn) {
                addLocationBtn.textContent = '無法載入倉庫資料';
            }
        });

    // Event listener for "Add Location" button
    if (addLocationBtn) {
        addLocationBtn.disabled = true; // Disable button until warehouse data is loaded
        addLocationBtn.addEventListener('click', function() {
            if (allWarehouses.length === 0) {
                alert('倉庫資料仍在載入中或載入失敗，請稍候。');
                return;
            }
            locationInputsContainer.appendChild(renderLocationInputGroup()); // Call renderLocationInputGroup for new item
        });
    }

    // Event listener for removing location
    if (locationInputsContainer) {
        locationInputsContainer.addEventListener('click', function(event) {
            const removeBtn = event.target.closest('.remove-location-btn');
            if (removeBtn) {
                const stockQuantity = parseInt(removeBtn.dataset.stockQuantity || '0');
                
                if (stockQuantity > 0) {
                    alert(`無法移除此儲位：仍有 ${stockQuantity} 個零件庫存，請先清空庫存後再移除。`);
                    return; // 直接阻止刪除，不提供確認選項
                }
                removeBtn.closest('.location-input-group').remove();
            }
        });
    }
});
