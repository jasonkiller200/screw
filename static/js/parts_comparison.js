/**
 * Parts Comparison Report JavaScript Module
 * 零件差異分析報告的所有 JavaScript 功能
 */
console.log('[DEBUG] parts_comparison.js script loaded.');

let currentData = null;

// 載入資料
function loadData() {
    console.log('[DEBUG] loadData() function called.');
    document.getElementById('loadingDiv').style.display = 'block';
    document.getElementById('summaryDiv').style.display = 'none';
    document.getElementById('resultsDiv').style.display = 'none';
    document.getElementById('errorDiv').style.display = 'none';

    try {
        console.log('[DEBUG] Attempting to fetch data from /reports/parts-comparison/data');
        fetch('/reports/parts-comparison/data')
            .then(response => {
                console.log('[DEBUG] Fetch response received. Status:', response.status);
                if (!response.ok) {
                    console.error('[DEBUG] Fetch response was not OK. Status:', response.statusText);
                    // Try to get text for more detailed error, then fall back to statusText
                    response.text().then(text => {
                         showError(`伺服器錯誤: ${response.status} ${response.statusText}. 詳情: ${text}`);
                    }).catch(() => {
                         showError(`伺服器錯誤: ${response.status} ${response.statusText}.`);
                    });
                    return Promise.reject(new Error(`HTTP error! status: ${response.status}`));
                }
                return response.json();
            })
            .then(data => {
                console.log('[DEBUG] JSON data parsed:', data);
                document.getElementById('loadingDiv').style.display = 'none';
                
                if (data.success) {
                    console.log('[DEBUG] Data success. Calling displayData().');
                    currentData = data;
                    displayData(data);
                } else {
                    console.error('[DEBUG] API returned success:false. Error:', data.error);
                    showError(data.error || '載入失敗');
                }
            })
            .catch(error => {
                console.error('[DEBUG] Fetch promise chain caught an error:', error);
                document.getElementById('loadingDiv').style.display = 'none';
                // Avoid showing generic network error if a more specific one was already shown
                if (document.getElementById('errorDiv').style.display !== 'block') {
                    showError('網路或客戶端錯誤: ' + error.message);
                }
            });
    } catch (e) {
        console.error('[DEBUG] A synchronous error occurred while trying to fetch:', e);
        document.getElementById('loadingDiv').style.display = 'none';
        showError('客戶端腳本同步錯誤: ' + e.message);
    }
}

// 顯示錯誤訊息
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorDiv').style.display = 'block';
}

// 顯示資料
function displayData(data) {
    console.log('displayData called:', data);
    // 顯示統計數據，使用動畫
    animateNumber('workOrderPartsCount', data.summary.work_order_parts_count);
    animateNumber('inventoryPartsCount', data.summary.inventory_parts_count);
    animateNumber('missingPartsCount', data.summary.missing_in_inventory_count);
    animateNumber('shortagePartsCount', data.summary.shortage_parts_count);
    animateNumber('demandWithNoLocationCount', data.summary.demand_with_no_location_count);
    
    document.getElementById('summaryDiv').style.display = 'block';

    // 填充表格
    fillMissingTable(data.missing_in_inventory);
    fillInventoryTable(data.inventory_with_demand);
    fillNoLocationTable(data.demand_with_no_location);

    document.getElementById('resultsDiv').style.display = 'block';
}

// 數字動畫效果
function animateNumber(elementId, targetValue) {
    const element = document.getElementById(elementId);
    const startValue = 0;
    const duration = 1000; // 1秒
    const startTime = performance.now();
    
    function updateNumber(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);
        element.textContent = currentValue.toLocaleString();
        
        element.classList.add('counting');
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.classList.remove('counting');
        }
    }
    
    requestAnimationFrame(updateNumber);
}

// =============================================================================
// 缺少零件搜尋功能 (Tab 1)
// =============================================================================

let missingPartsData = [];
let filteredMissingData = [];

function fillMissingTable(data) {
    missingPartsData = data;
    filteredMissingData = [...data];
    renderMissingTable();
    updateMissingResultCount();
}

function renderMissingTable() {
    const tbody = document.querySelector('#missingTable tbody');
    tbody.innerHTML = '';
    filteredMissingData.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input missing-checkbox" 
                       data-part-number="${item.part_number}" 
                       data-description="${item.description || ''}" 
                       onchange="updateAddButton()">
            </td>
            <td><strong>${escapeHtml(item.part_number)}</strong></td>
            <td>${escapeHtml(item.description || '')}</td>
            <td class="text-end">${item.total_required.toLocaleString()}</td>
            <td>${(item.order_ids || []).join(', ')}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="addSinglePart('${escapeHtml(item.part_number)}', '${escapeHtml(item.description || '').replace(/'/g, "\\'")}')">
                    <i class="fas fa-plus"></i> 新增
                </button>
                <button class="btn btn-sm btn-info ms-1" onclick="showAddPartModal('${escapeHtml(item.part_number)}', '${escapeHtml(item.description || '').replace(/'/g, "\\'")}', '${escapeHtml(item.name || '').replace(/'/g, "\\'")}')">
                    <i class="fas fa-cog"></i>
                </button>
            </td>
        `;
    });
}

function updateMissingResultCount() {
    document.getElementById('missingResultCount').textContent = filteredMissingData.length;
}

function searchMissingParts() {
    const searchTerm = document.getElementById('missingSearchInput').value.toLowerCase().trim();
    filteredMissingData = searchTerm === '' ? [...missingPartsData] : missingPartsData.filter(item => 
        (item.part_number || '').toLowerCase().includes(searchTerm) || 
        (item.description || '').toLowerCase().includes(searchTerm)
    );
    renderMissingTable();
    updateMissingResultCount();
    updateAddButton();
}

function clearMissingSearch() {
    document.getElementById('missingSearchInput').value = '';
    searchMissingParts();
}

// =============================================================================
// 庫存不足/充足零件 (Tabs 2 & 3)
// =============================================================================

let shortagePartsData = [];
let filteredShortageData = [];

function fillInventoryTable(data) {
    const shortageData = data.filter(item => item.shortage > 0);
    const sufficientData = data.filter(item => item.stock_status === '充足');
    shortagePartsData = shortageData;
    filteredShortageData = [...shortageData];
    renderShortageTable();

    const sufficientBody = document.querySelector('#sufficientTable tbody');
    sufficientBody.innerHTML = '';
    sufficientData.forEach(item => {
        const surplus = item.available_quantity - item.required_quantity;
        const row = sufficientBody.insertRow();
        row.innerHTML = `
            <td><strong>${item.part_number}</strong></td>
            <td>${item.name || ''}</td>
            <td>${item.unit || ''}</td>
            <td class="text-end">${item.required_quantity.toLocaleString()}</td>
            <td class="text-end">${item.total_stock.toLocaleString()}</td>
            <td class="text-end">${item.available_quantity.toLocaleString()}</td>
            <td class="text-end text-success"><strong>${surplus.toLocaleString()}</strong></td>
            <td class="text-end">${(item.order_ids || []).join(', ')}</td>
        `;
    });
}

function renderShortageTable() {
    const shortageBody = document.querySelector('#shortageTable tbody');
    shortageBody.innerHTML = '';
    filteredShortageData.forEach(item => {
        const suggestedOrder = item.shortage + Math.max(10, Math.ceil(item.shortage * 0.2));
        const row = shortageBody.insertRow();
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input shortage-checkbox" 
                       data-part-number="${item.part_number}" 
                       data-part-name="${item.name || ''}" 
                       data-unit="${item.unit || ''}" 
                       data-shortage="${item.shortage}" 
                       data-suggested-order="${suggestedOrder}" 
                       onchange="updateShortageButtons()">
            </td>
            <td><strong>${escapeHtml(item.part_number)}</strong></td>
            <td>${escapeHtml(item.name || '')}</td>
            <td class="text-end">${item.required_quantity.toLocaleString()}</td>
            <td class="text-end">${item.total_stock.toLocaleString()}</td>
            <td class="text-danger text-end">${item.shortage.toLocaleString()}</td>
            <td>${escapeHtml(item.unit || '')}</td>
            <td>${(item.order_ids || []).join(', ')}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="createSingleOrder('${item.part_number}')" title="單獨訂購">
                    <i class="fas fa-shopping-cart"></i> 訂購
                </button>
            </td>
        `;
    });
}

function searchShortageParts() {
    const searchTerm = document.getElementById('shortageSearchInput').value.toLowerCase().trim();
    filteredShortageData = searchTerm === '' ? [...shortagePartsData] : shortagePartsData.filter(item => 
        (item.part_number || '').toLowerCase().includes(searchTerm) || 
        (item.name || '').toLowerCase().includes(searchTerm)
    );
    renderShortageTable();
    updateShortageButtons();
}

function clearShortageSearch() {
    document.getElementById('shortageSearchInput').value = '';
    searchShortageParts();
}

function updateShortageButtons() {
    const checkboxes = document.querySelectorAll('.shortage-checkbox:checked');
    const weeklyOrderButton = document.getElementById('addToWeeklyOrderBtn');
    weeklyOrderButton.disabled = checkboxes.length === 0;
    weeklyOrderButton.innerHTML = checkboxes.length > 0 ? 
        `<i class=\"fas fa-calendar-plus\"></i> 加入週報 (${checkboxes.length})` : 
        '<i class=\"fas fa-calendar-plus\"></i> 加入週報';
}

function toggleSelectAllShortage() {
    const selectAll = document.getElementById('selectAllShortage');
    const checkboxes = document.querySelectorAll('.shortage-checkbox');
    checkboxes.forEach(checkbox => { checkbox.checked = selectAll.checked; });
    updateShortageButtons();
}

// =============================================================================
// 工單需求但未設儲位 (New Tab 4)
// =============================================================================
function fillNoLocationTable(data) {
    const tbody = document.querySelector('#noLocationTable tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">所有具備工單需求的零件均已設定儲位。</td></tr>';
        return;
    }

    data.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${escapeHtml(item.part_number)}</strong></td>
            <td>${escapeHtml(item.name || '')}</td>
            <td class="text-end">${item.total_required.toLocaleString()}</td>
            <td>${(item.order_ids || []).join(', ')}</td>
            <td>
                <a href="/parts/${item.part_id}/edit" class="btn btn-sm btn-primary" target="_blank" title="編輯零件以新增儲位">
                    <i class="fas fa-edit"></i> 編輯
                </a>
            </td>
        `;
    });
}


// =============================================================================
// 週報訂單整合功能
// =============================================================================
function createSingleOrder(partNumber) {
    const partData = shortagePartsData.find(item => item.part_number === partNumber);
    if (!partData) {
        alert('找不到零件資料');
        return;
    }
    const params = new URLSearchParams({
        part_number: partData.part_number,
        part_name: partData.name || '',
        quantity: partData.suggested_order || partData.shortage || 1,
        unit: partData.unit || '',
        category: partData.category || '', // New: pass category
        warehouse_location_id: partData.warehouse_location_id || '', // New: pass warehouse_location_id
        priority: 'normal',
        source: 'shortage'
    });
    window.location.href = `/weekly-orders/register?${params.toString()}`;
}

function addToWeeklyOrder() {
    const selectedParts = [];
    const checkboxes = document.querySelectorAll('#shortageTable input[type="checkbox"]:checked');
    if (checkboxes.length === 0) {
        alert('請選擇要加入的零件');
        return;
    }
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const partData = shortagePartsData.find(item => item.part_number === checkbox.dataset.partNumber);
        if (partData) {
            selectedParts.push({
                part_number: partData.part_number,
                part_name: partData.name || '',
                quantity: parseInt(checkbox.dataset.suggestedOrder) || parseInt(checkbox.dataset.shortage) || 1,
                unit: partData.unit || '',
                category: partData.category || '', // New: pass category
                warehouse_location_id: partData.warehouse_location_id || '', // New: pass warehouse_location_id
                priority: 'normal',
                source: 'shortage'
            });
        }
    });
    
    if (selectedParts.length === 1) {
        const part = selectedParts[0];
        const params = new URLSearchParams({ ...part });
        window.location.href = `/weekly-orders/register?${params.toString()}`;
    } else {
        const itemsJson = JSON.stringify(selectedParts);
        const params = new URLSearchParams({ items: itemsJson, source: 'shortage' });
        window.location.href = `/weekly-orders/batch-register?${params.toString()}`;
    }
}

// =============================================================================
// 缺少零件新增功能
// =============================================================================
function updateAddButton() {
    const checkboxes = document.querySelectorAll('.missing-checkbox:checked');
    const addButton = document.getElementById('addSelectedPartsBtn');
    addButton.disabled = checkboxes.length === 0;
    addButton.innerHTML = checkboxes.length > 0 ? 
        `<i class=\"fas fa-plus\"></i> 新增選中零件 (${checkboxes.length})` : '<i class=\"fas fa-plus\"></i> 新增選中零件';
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllMissing');
    const checkboxes = document.querySelectorAll('.missing-checkbox');
    checkboxes.forEach(checkbox => { checkbox.checked = selectAll.checked; });
    updateAddButton();
}

function addSinglePart(partNumber, description) {
    if (confirm(`確定要新增零件 "${partNumber}" 到零件倉庫？`)) {
        addPartsToInventory([{ part_number: partNumber, description: description }]);
    }
}

function addSelectedParts() {
    const checkboxes = document.querySelectorAll('.missing-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('請選擇要處理的零件');
        return;
    }
    const parts = Array.from(checkboxes).map(checkbox => ({
        part_number: checkbox.dataset.partNumber, 
        description: checkbox.dataset.description 
    }));
    if (confirm(`確定要新增 ${parts.length} 個零件至零件庫？`)) {
        addPartsToInventory(parts);
    }
}

function addPartsToInventory(parts) {
    const addButton = document.getElementById('addSelectedPartsBtn');
    const originalText = addButton.innerHTML;
    addButton.disabled = true;
    addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';

    fetch('/reports/parts-comparison/add-parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: parts })
    })
    .then(response => response.json())
    .then(data => {
        let message = `成功新增 ${data.added_count} 個零件至零件庫！`;
        if (data.skipped_count > 0) message += `\n跳過 ${data.skipped_count} 個已存在的零件。`;
        if (data.errors && data.errors.length > 0) message += `\n錯誤: ${data.errors.join(', ')}`;
        alert(message);
        loadData();
    })
    .catch(error => alert('網路錯誤: ' + error.message))
    .finally(() => {
        addButton.disabled = false;
        addButton.innerHTML = originalText;
    });
}

function showAddPartModal(partNumber, description) {
    document.getElementById('modalPartNumber').value = partNumber;
    document.getElementById('modalPartName').value = description || partNumber;
    document.getElementById('modalPartDescription').value = description || '';
    document.getElementById('modalPartUnit').value = '個';
    document.getElementById('modalQuantityPerBox').value = 1;
    document.getElementById('modalSafetyStock').value = 0;
    document.getElementById('modalReorderPoint').value = 0;
    document.getElementById('modalStandardCost').value = 0;
    const modal = new bootstrap.Modal(document.getElementById('addPartModal'));
    modal.show();
}

function addPartWithDetails() {
    const formData = {
        part_number: document.getElementById('modalPartNumber').value,
        name: document.getElementById('modalPartName').value,
        description: document.getElementById('modalPartDescription').value,
        unit: document.getElementById('modalPartUnit').value,
        quantity_per_box: parseInt(document.getElementById('modalQuantityPerBox').value),
        safety_stock: parseInt(document.getElementById('modalSafetyStock').value),
        reorder_point: parseInt(document.getElementById('modalReorderPoint').value),
        standard_cost: parseFloat(document.getElementById('modalStandardCost').value)
    };
    if (!formData.name.trim()) {
        alert('請輸入零件資料');
        return;
    }
    fetch('/reports/parts-comparison/add-part-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('新增成功！');
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPartModal'));
            modal.hide();
            loadData();
        } else {
            alert('新增失敗: ' + data.error);
        }
    })
    .catch(error => alert('網路錯誤: ' + error.message));
}

// Helper function to HTML-escape strings
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =============================================================================
// 工具函數
// =============================================================================
function exportToExcel() {
    if (!currentData) {
        alert('沒有資料可以匯出');
        return;
    }

    const exportButton = document.getElementById('exportBtn');
    const originalButtonHtml = exportButton.innerHTML;
    exportButton.disabled = true;
    exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 匯出中...';

    fetch('/reports/parts-comparison/export')
        .then(response => {
            if (!response.ok) {
                throw new Error('匯出失敗: ' + response.statusText);
            }
            // Pass both response and blob to the next then()
            return Promise.all([response.blob(), Promise.resolve(response)]);
        })
        .then(([blob, response]) => { // Destructure to get both blob and response
            // Create a URL for the blob
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            // Use the filename from the Content-Disposition header if available, otherwise a default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = '零件差異分析報告.xlsx';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;"\\]+)?/);
                if (filenameMatch && filenameMatch[1]) {
                    filename = decodeURIComponent(filenameMatch[1]);
                }
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url); // Clean up the URL object
            alert('Excel 匯出成功！');
        })
        .catch(error => {
            console.error('匯出錯誤:', error);
            alert('Excel 匯出失敗: ' + error.message);
        })
        .finally(() => {
            exportButton.disabled = false;
            exportButton.innerHTML = originalButtonHtml;
        });
}

// =============================================================================
// 初始化
// =============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DEBUG] DOMContentLoaded event fired.');
    document.getElementById('refreshBtn').addEventListener('click', loadData);
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    document.getElementById('addSelectedPartsBtn').addEventListener('click', addSelectedParts);
    document.getElementById('selectAllMissing').addEventListener('change', toggleSelectAll);
    document.getElementById('selectAllShortage').addEventListener('change', toggleSelectAllShortage);
    document.getElementById('addToWeeklyOrderBtn').addEventListener('click', addToWeeklyOrder);
    loadData();
});
