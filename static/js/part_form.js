document.addEventListener('DOMContentLoaded', function() {
    const locationInputsContainer = document.getElementById('location-inputs');
    const addLocationBtn = document.getElementById('add-location-btn');
    
    let allWarehouses = []; // Store warehouse data globally in this scope

    // Function to populate a single select element with warehouse options
    function populateSelect(selectElement, warehouses) {
        const currentValue = selectElement.value;

        // Add options from the fetched list that don't already exist in the dropdown
        warehouses.forEach(w => {
            if (!selectElement.querySelector(`option[value="${w.id}"]`)) {
                const option = document.createElement('option');
                option.value = w.id;
                option.textContent = w.name;
                selectElement.appendChild(option);
            }
        });

        // Ensure the original value remains selected
        selectElement.value = currentValue;
    }

    // Fetch warehouse data and populate all existing dropdowns
    fetch('/api/warehouses')
        .then(response => response.json())
        .then(warehouses => {
            allWarehouses = warehouses; // Store for later use
            
            // Populate all initially rendered select elements
            const existingSelects = document.querySelectorAll('.location-warehouse-select');
            existingSelects.forEach(select => populateSelect(select, allWarehouses));

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

    function updateRemoveButtons() {
        if (!locationInputsContainer) return;
        const removeButtons = locationInputsContainer.querySelectorAll('.remove-location-btn');
        if (removeButtons.length <= 1) {
            removeButtons.forEach(button => button.style.display = 'none');
        } else {
            removeButtons.forEach(button => button.style.display = 'inline-flex');
        }
    }

    function createLocationInputGroup() {
        const newLocationInputGroup = document.createElement('div');
        newLocationInputGroup.classList.add('input-group', 'mb-2', 'location-input-group');
        
        const select = document.createElement('select');
        select.className = 'form-select location-warehouse-select';
        select.name = 'location_warehouse_id[]';
        select.required = true;
        // Use a temporary empty select, it will be populated by the main logic
        select.innerHTML = '<option value="">選擇倉庫</option>';
        populateSelect(select, allWarehouses); // Populate with the loaded warehouses
        
        newLocationInputGroup.appendChild(select);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control location-code-input';
        input.name = 'location_code[]';
        input.placeholder = '位置代碼';
        input.required = true;
        newLocationInputGroup.appendChild(input);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline-danger remove-location-btn';
        button.innerHTML = '<i class="fas fa-times"></i>';
        newLocationInputGroup.appendChild(button);

        return newLocationInputGroup;
    }

    if (addLocationBtn) {
        addLocationBtn.disabled = true; // Disable button until warehouse data is loaded
        addLocationBtn.addEventListener('click', function() {
            if (allWarehouses.length === 0) {
                alert('倉庫資料仍在載入中或載入失敗，請稍候。');
                return;
            }
            locationInputsContainer.appendChild(createLocationInputGroup());
            updateRemoveButtons();
        });
    }

    if (locationInputsContainer) {
        locationInputsContainer.addEventListener('click', function(event) {
            const removeBtn = event.target.closest('.remove-location-btn');
            if (removeBtn) {
                if (locationInputsContainer.querySelectorAll('.location-input-group').length > 1) {
                    removeBtn.closest('.location-input-group').remove();
                    updateRemoveButtons();
                }
            }
        });
    }

    updateRemoveButtons(); // Initial call
});
