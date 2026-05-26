function autoFillPartDetails(partNumber) {
    if (partNumber) {
        fetch(`/api/part/${partNumber}`)
            .then(response => response.json())
            .then(data => {
                if (data.part_info) {
                    // 設定品名為只讀，依照零件原本設定
                    const partNameInput = document.getElementById('part_name');
                    partNameInput.value = data.part_info.name || '';
                    partNameInput.readOnly = true;
                    
                    document.getElementById('part_type').value = data.part_info.type || '';
                    
                    // 設定單位為只讀，依照零件原本設定
                    const unitInput = document.getElementById('unit');
                    unitInput.value = data.part_info.unit || '';
                    unitInput.readOnly = true;

                    // Fetch and populate warehouse locations for the part
                    fetch(`/api/part/${partNumber}/locations`)
                        .then(response => response.json())
                        .then(locationData => {
                            const locationSelect = document.getElementById('warehouse_location_id');
                            const locationStar = document.getElementById('location-required-star');
                            const purposeNotesInput = document.getElementById('purpose_notes');
                            const purposeNotesRequiredStar = document.getElementById('purpose-notes-required-star');
                            
                            locationSelect.innerHTML = ''; // Clear existing options
                            
                            if (locationData.locations && locationData.locations.length > 0) {
                                // Part has locations
                                locationSelect.disabled = false;
                                locationSelect.required = true;
                                locationStar.style.display = 'inline';
                                purposeNotesInput.required = false;
                                purposeNotesRequiredStar.style.display = 'none'; // Hide asterisk
                                
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
                                purposeNotesInput.required = true;
                                purposeNotesRequiredStar.style.display = 'inline'; // Show asterisk
                                
                                const option = new Option('無指定儲位', '');
                                locationSelect.add(option);
                                locationSelect.value = '';
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching part locations:', error);
                            const locationSelect = document.getElementById('warehouse_location_id');
                            const purposeNotesInput = document.getElementById('purpose_notes');
                            const purposeNotesRequiredStar = document.getElementById('purpose-notes-required-star');
                            locationSelect.innerHTML = '<option value="">無法載入儲位</option>';
                            locationSelect.disabled = true;
                            purposeNotesInput.required = false; // Reset if error
                            purposeNotesRequiredStar.style.display = 'none'; // Hide asterisk on error
                        });
                } else {
                    // Clear fields if part not found
                    const partNameInput = document.getElementById('part_name');
                    partNameInput.value = '';
                    partNameInput.readOnly = true;
                    partNameInput.placeholder = '請先輸入零件號碼';
                    
                    document.getElementById('part_type').value = '';
                    
                    // 重置單位欄位
                    const unitInput = document.getElementById('unit');
                    unitInput.value = '';
                    unitInput.readOnly = true;
                    unitInput.placeholder = '請先輸入零件號碼';
                    const locationSelect = document.getElementById('warehouse_location_id');
                    const purposeNotesInput = document.getElementById('purpose_notes');
                    const purposeNotesRequiredStar = document.getElementById('purpose-notes-required-star');
                    locationSelect.innerHTML = '<option value="">請選擇儲位</option>';
                    purposeNotesInput.required = false; // Reset if part not found
                    purposeNotesRequiredStar.style.display = 'none'; // Hide asterisk
                }
            })
            .catch(error => {
                console.error('Error fetching part details:', error);
                // Clear fields on error
                const partNameInput = document.getElementById('part_name');
                partNameInput.value = '';
                partNameInput.readOnly = true;
                partNameInput.placeholder = '請先輸入零件號碼';
                
                document.getElementById('part_type').value = '';
                
                // 重置單位欄位
                const unitInput = document.getElementById('unit');
                unitInput.value = '';
                unitInput.readOnly = true;
                unitInput.placeholder = '請先輸入零件號碼';
                const locationSelect = document.getElementById('warehouse_location_id');
                const purposeNotesInput = document.getElementById('purpose_notes');
                const purposeNotesRequiredStar = document.getElementById('purpose-notes-required-star');
                locationSelect.innerHTML = '<option value="">請選擇儲位</option>';
                purposeNotesInput.required = false; // Reset if error
                purposeNotesRequiredStar.style.display = 'none'; // Hide asterisk on error
            });
    } else {
        // Clear fields if part number is empty
        const partNameInput = document.getElementById('part_name');
        partNameInput.value = '';
        partNameInput.readOnly = true;
        partNameInput.placeholder = '請先輸入零件號碼';
        
        document.getElementById('part_type').value = '';
        
        // 重置單位欄位
        const unitInput = document.getElementById('unit');
        unitInput.value = '';
        unitInput.readOnly = true;
        unitInput.placeholder = '請先輸入零件號碼';
        const locationSelect = document.getElementById('warehouse_location_id');
        const purposeNotesInput = document.getElementById('purpose_notes');
        const purposeNotesRequiredStar = document.getElementById('purpose-notes-required-star');
        locationSelect.innerHTML = '<option value="">請選擇儲位</option>';
        purposeNotesInput.required = false; // Reset if part number is empty
        purposeNotesRequiredStar.style.display = 'none'; // Hide asterisk
    }
}

function searchParts(query) {
    if (query.length < 1) {
        document.getElementById('part-suggestions').innerHTML = '';
        return;
    }
    fetch(`/api/parts/autocomplete?q=${query}`)
        .then(response => response.json())
        .then(data => {
            const suggestions = document.getElementById('part-suggestions');
            suggestions.innerHTML = '';
            if (data.length > 0) {
                const list = document.createElement('ul');
                list.className = 'list-group';
                data.forEach(part => {
                    const item = document.createElement('li');
                    item.className = 'list-group-item list-group-item-action';
                    item.textContent = `${part.part_number} - ${part.name}`;
                    item.addEventListener('click', () => {
                        document.getElementById('part_number').value = part.part_number;
                        document.getElementById('part_name').value = part.name;
                        suggestions.innerHTML = '';
                        autoFillPartDetails(part.part_number);
                    });
                    list.appendChild(item);
                });
                suggestions.appendChild(list);
            }
        });
}

function showRegisterPartConsumptionDetails() {
    const partNumber = (document.getElementById('part_number')?.value || '').trim();
    const locationValue = document.getElementById('warehouse_location_id')?.value;
    const warehouseLocationId = locationValue ? parseInt(locationValue, 10) : null;

    if (!partNumber) {
        return;
    }

    if (window.PartDetailModal) {
        window.PartDetailModal.openConsumptionAnalysisDirect(partNumber, warehouseLocationId);
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
    partNumberInput.addEventListener('keyup', function(event) {
        searchParts(this.value.trim());
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

// ============================================================================
// 防重複訂購檢查：表單提交前攔截
// ============================================================================
(function() {
    const form = document.querySelector('form[action*="register_order"]');
    if (!form) return;

    let pendingCheckConfirmed = false;

    form.addEventListener('submit', function(e) {
        if (pendingCheckConfirmed) {
            pendingCheckConfirmed = false;
            return;
        }

        const partNumber = (document.getElementById('part_number')?.value || '').trim();
        const locationId = document.getElementById('warehouse_location_id')?.value || null;

        if (!partNumber) return; // let normal validation handle it

        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const origHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 檢查中...';
        }

        fetch('/api/weekly-orders/check-pending-inbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                part_number: partNumber,
                warehouse_location_id: locationId || null,
                only_pending_inbound: true,
                require_location: true
            })
        })
        .then(r => r.json())
        .then(data => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origHtml;
            }

            if (data.has_pending) {
                let msg = `⚠️ 此零件已有 ${data.items.length} 筆待處理項目：\n\n`;
                data.items.forEach(item => {
                    msg += `• [${item.status_text}] ${item.quantity} 個`;
                    if (item.type === 'pending_inbound') {
                        msg += ` (剩餘 ${item.remaining})`;
                    }
                    msg += ` - ${item.applicant_name}\n`;
                    msg += `  儲位: ${item.location_display || '未指定'}\n`;
                });
                msg += '\n確定要繼續提交嗎？';

                if (confirm(msg)) {
                    pendingCheckConfirmed = true;
                    form.submit();
                }
            } else {
                pendingCheckConfirmed = true;
                form.submit();
            }
        })
        .catch(err => {
            console.warn('檢查待入庫失敗，直接提交:', err);
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origHtml;
            }
            pendingCheckConfirmed = true;
            form.submit();
        });
    });
})();