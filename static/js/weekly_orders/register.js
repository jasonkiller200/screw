function autoFillPartDetails(partNumber) {
    if (partNumber) {
        fetch(`/api/part/${partNumber}`)
            .then(response => response.json())
            .then(data => {
                if (data.part_info) {
                    document.getElementById('part_name').value = data.part_info.name || '';
                    document.getElementById('part_type').value = data.part_info.type || '';
                    document.getElementById('unit').value = data.part_info.unit || '';

                    // Fetch and populate warehouse locations for the part
                    fetch(`/api/part/${partNumber}/locations`)
                        .then(response => response.json())
                        .then(locationData => {
                            const locationSelect = document.getElementById('warehouse_location_id');
                            const locationStar = document.getElementById('location-required-star');
                            
                            locationSelect.innerHTML = ''; // Clear existing options
                            
                            if (locationData.locations && locationData.locations.length > 0) {
                                // Part has locations
                                locationSelect.disabled = false;
                                locationSelect.required = true;
                                locationStar.style.display = 'inline';
                                
                                locationSelect.add(new Option('請選擇儲位', ''));
                                locationData.locations.forEach(loc => {
                                    const option = new Option(`${loc.warehouse_name} - ${loc.location_code}`, loc.id);
                                    locationSelect.add(option);
                                });

                                // If only one location, auto-select it
                                if (locationData.locations.length === 1) {
                                    locationSelect.value = locationData.locations[0].id;
                                }
                                
                                // Handle pre-filled data
                                if (typeof prefill_data !== 'undefined' && prefill_data && prefill_data.warehouse_location_id) {
                                    locationSelect.value = prefill_data.warehouse_location_id;
                                }

                            } else {
                                // Part has no locations
                                locationSelect.disabled = true;
                                locationSelect.required = false;
                                locationStar.style.display = 'none';
                                
                                const option = new Option('無指定儲位', '');
                                locationSelect.add(option);
                                locationSelect.value = '';
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching part locations:', error);
                            const locationSelect = document.getElementById('warehouse_location_id');
                            locationSelect.innerHTML = '<option value="">無法載入儲位</option>';
                            locationSelect.disabled = true;
                        });
                } else {
                    // Clear fields if part not found
                    document.getElementById('part_name').value = '';
                    document.getElementById('part_type').value = '';
                    document.getElementById('unit').value = '';
                    const locationSelect = document.getElementById('warehouse_location_id');
                    locationSelect.innerHTML = '<option value="">請選擇儲位</option>';
                }
            })
            .catch(error => {
                console.error('Error fetching part details:', error);
                // Clear fields on error
                document.getElementById('part_name').value = '';
                document.getElementById('part_type').value = '';
                document.getElementById('unit').value = '';
                const locationSelect = document.getElementById('warehouse_location_id');
                locationSelect.innerHTML = '<option value="">請選擇儲位</option>';
            });
    } else {
        // Clear fields if part number is empty
        document.getElementById('part_name').value = '';
        document.getElementById('part_type').value = '';
        document.getElementById('unit').value = '';
        const locationSelect = document.getElementById('warehouse_location_id');
        locationSelect.innerHTML = '<option value="">請選擇儲位</option>';
    }
}

// 頁面載入時更新時間，並每分鐘更新一次
document.addEventListener('DOMContentLoaded', function() {
    updateTimeRemaining();
    setInterval(updateTimeRemaining, 60000); // 每分鐘更新
    
    // 設定預設需用日期為一週後
    const requiredDateInput = document.getElementById('required_date');
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    requiredDateInput.value = nextWeek.toISOString().split('T')[0];

    const partNumberInput = document.getElementById('part_number');
    partNumberInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            autoFillPartDetails(this.value.trim());
        }
    });
    // Also trigger on blur for mouse users or tab navigation
    partNumberInput.addEventListener('blur', function() {
        autoFillPartDetails(this.value.trim());
    });

    // If prefill_data exists and has a part_number, trigger auto-fill on load
    // Ensure prefill_data is defined and not null
    if (typeof prefill_data !== 'undefined' && prefill_data && prefill_data.part_number) {
        partNumberInput.value = prefill_data.part_number; // Set part number input value
        autoFillPartDetails(prefill_data.part_number);
    }
});

// 計算並顯示剩餘時間
function updateTimeRemaining() {
    const deadline = new Date('{{ current_cycle.deadline.isoformat() }}');
    const now = new Date();
    const diff = deadline - now;
    
    const timeRemainingEl = document.getElementById('timeRemaining');
    
    if (diff <= 0) {
        timeRemainingEl.innerHTML = '<span class="text-danger"><i class="fas fa-exclamation-triangle me-1"></i>申請已截止</span>';
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    timeRemainingEl.innerHTML = `
        <i class="fas fa-hourglass-half me-1"></i>
        剩餘時間：${days}天 ${hours}小時 ${minutes}分鐘
    `;
}