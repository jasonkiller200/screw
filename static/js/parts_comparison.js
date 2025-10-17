/**
 * Parts Comparison Report JavaScript Module
 * 零件差異分析報告的所有 JavaScript 功能
 */

let currentData = null;

// 載入資料
function loadData() {
    document.getElementById('loadingDiv').style.display = 'block';
    document.getElementById('summaryDiv').style.display = 'none';
    document.getElementById('resultsDiv').style.display = 'none';
    document.getElementById('errorDiv').style.display = 'none';

    fetch('/reports/parts-comparison/data')
        .then(response => response.json())
        .then(data => {
            document.getElementById('loadingDiv').style.display = 'none';
            
            if (data.success) {
                currentData = data;
                displayData(data);
            } else {
                showError(data.error || '載入失敗');
            }
        })
        .catch(error => {
            document.getElementById('loadingDiv').style.display = 'none';
            showError('網路錯誤: ' + error.message);
        });
}

// 顯示錯誤訊息
function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorDiv').style.display = 'block';
}

// 顯示資料
function displayData(data) {
    // 顯示統計數據，使用動畫
    animateNumber('workOrderPartsCount', data.summary.work_order_parts_count);
    animateNumber('inventoryPartsCount', data.summary.inventory_parts_count);
    animateNumber('missingPartsCount', data.summary.missing_in_inventory_count);
    animateNumber('shortagePartsCount', data.summary.shortage_parts_count);
    
    document.getElementById('summaryDiv').style.display = 'block';

    // 填充表格
    fillMissingTable(data.missing_in_inventory);
    fillInventoryTable(data.inventory_with_demand);
    fillUnusedTable(data.unused_inventory);

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
        
        // 使用緩入緩出動畫
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);
        element.textContent = currentValue.toLocaleString();
        
        // 添加動畫類
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
// 缺少零件搜尋功能
// =============================================================================

let missingPartsData = [];
let filteredMissingData = [];

// 填充缺少零件表格
function fillMissingTable(data) {
    missingPartsData = data;
    filteredMissingData = [...data]; // 複製顯示數據
    
    renderMissingTable();
    updateMissingResultCount();
}

// 渲染缺少零件表格
function renderMissingTable() {
    const tbody = document.querySelector('#missingTable tbody');
    tbody.innerHTML = '';

    filteredMissingData.forEach((item, index) => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>
                <input type="checkbox" class="form-check-input missing-checkbox" 
                       data-part-number="${item.part_number}" 
                       data-description="${item.description || ''}"
                       onchange="updateAddButton()">
            </td>
            <td><strong>${item.part_number}</strong></td>
            <td>${item.description || ''}</td>
            <td class="text-end">${item.total_required.toLocaleString()}</td>
            <td class="text-end">${item.order_count}</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="addSinglePart('${item.part_number}', '${(item.description || '').replace(/'/g, '\\\'')}')" title="快速新增">
                    <i class="fas fa-plus"></i> 新增
                </button>
                <button class="btn btn-sm btn-info ms-1" onclick="showAddPartModal('${item.part_number}', '${(item.description || '').replace(/'/g, '\\\'')}')" title="詳細設定">
                    <i class="fas fa-cog"></i>
                </button>
            </td>
        `;
    });
}

// 更新缺少零件結果計數
function updateMissingResultCount() {
    const resultCount = document.getElementById('missingResultCount');
    resultCount.textContent = filteredMissingData.length;
}

// 搜尋缺少零件
function searchMissingParts() {
    const searchTerm = document.getElementById('missingSearchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredMissingData = [...missingPartsData];
    } else {
        filteredMissingData = missingPartsData.filter(item => {
            const partNumber = (item.part_number || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            return partNumber.includes(searchTerm) || description.includes(searchTerm);
        });
    }
    
    renderMissingTable();
    updateMissingResultCount();
    updateAddButton(); // 更新計數中的按鈕
}

// 清除缺少零件搜尋
function clearMissingSearch() {
    document.getElementById('missingSearchInput').value = '';
    searchMissingParts();
}

// =============================================================================
// 庫存不足零件搜尋功能
// =============================================================================

let shortagePartsData = [];
let filteredShortageData = [];

// 填充庫存表格
function fillInventoryTable(data) {
    const shortageData = data.filter(item => item.shortage > 0);
    const sufficientData = data.filter(item => item.stock_status === '充足');

    // 保存庫存不足數據
    shortagePartsData = shortageData;
    filteredShortageData = [...shortageData];
    
    // 渲染庫存不足表格
    renderShortageTable();

    // 庫存充足表格
    const sufficientBody = document.querySelector('#sufficientTable tbody');
    sufficientBody.innerHTML = '';

    sufficientData.forEach(item => {
        const surplus = item.available_stock - item.required_quantity;
        const row = sufficientBody.insertRow();
        row.innerHTML = `
            <td><strong>${item.part_number}</strong></td>
            <td>${item.name || ''}</td>
            <td>${item.unit || ''}</td>
            <td class="text-end">${item.required_quantity.toLocaleString()}</td>
            <td class="text-end">${item.total_stock.toLocaleString()}</td>
            <td class="text-end">${item.available_stock.toLocaleString()}</td>
            <td class="text-end text-success"><strong>${surplus.toLocaleString()}</strong></td>
            <td class="text-end">${item.order_count}</td>
        `;
    });
}

// 渲染庫存不足表格
function renderShortageTable() {
    const shortageBody = document.querySelector('#shortageTable tbody');
    shortageBody.innerHTML = '';

    filteredShortageData.forEach(item => {
        // 計算建議訂購量：缺貨量 + 安全庫存
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
            <td><strong>${item.part_number}</strong></td>
            <td>${item.name || ''}</td>
            <td>${item.unit || ''}</td>
            <td class="text-end">${item.required_quantity.toLocaleString()}</td>
            <td class="text-end">${item.total_stock.toLocaleString()}</td>
            <td class="text-end">${item.available_stock.toLocaleString()}</td>
            <td class="text-end text-danger"><strong>${item.shortage.toLocaleString()}</strong></td>
            <td class="text-end text-info"><strong>${suggestedOrder.toLocaleString()}</strong></td>
            <td class="text-end">${item.order_count}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="createSingleOrder('${item.part_number}')" title="單獨訂購">
                    <i class="fas fa-shopping-cart"></i> 訂購
                </button>
            </td>
        `;
    });
}

// 搜尋庫存不足零件
function searchShortageParts() {
    const searchTerm = document.getElementById('shortageSearchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredShortageData = [...shortagePartsData];
    } else {
        filteredShortageData = shortagePartsData.filter(item => {
            const partNumber = (item.part_number || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            return partNumber.includes(searchTerm) || name.includes(searchTerm);
        });
    }
    
    renderShortageTable();
    updateShortageButtons(); // 更新計數中的按鈕
}

// 清除庫存不足搜尋
function clearShortageSearch() {
    document.getElementById('shortageSearchInput').value = '';
    searchShortageParts();
}

// 更新按鈕狀態
function updateShortageButtons() {
    const checkboxes = document.querySelectorAll('.shortage-checkbox:checked');
    const weeklyOrderButton = document.getElementById('addToWeeklyOrderBtn');
    
    weeklyOrderButton.disabled = checkboxes.length === 0;
    weeklyOrderButton.innerHTML = checkboxes.length > 0 ? 
        `<i class="fas fa-calendar-plus"></i> 加入週報 (${checkboxes.length})` : 
        '<i class="fas fa-calendar-plus"></i> 加入週報';
}

// 全選/取消全選庫存不足零件
function toggleSelectAllShortage() {
    const selectAll = document.getElementById('selectAllShortage');
    const checkboxes = document.querySelectorAll('.shortage-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateShortageButtons();
}

// =============================================================================
// 週報訂單整合功能
// =============================================================================

// 建立單一零件訂購 - 跳轉週報訂單系統
function createSingleOrder(partNumber) {
    // 查找對應零件
    const partData = shortagePartsData.find(item => item.part_number === partNumber);
    
    if (!partData) {
        alert('找不到零件資料');
        return;
    }
    
    // 準備週報訂單資料
    const params = new URLSearchParams({
        part_number: partData.part_number,
        part_name: partData.name || '',
        quantity: partData.suggested_order || partData.shortage || 1,
        unit: partData.unit || '',
        priority: 'normal',
        source: 'shortage' // 標記來源為庫存不足報告
    });
    
    // 跳轉到週報訂單申請頁面
    window.location.href = `/weekly-orders/register?${params.toString()}`;
}

// 建立批量訂購 - 跳轉週報訂單系統
function createOrderFromShortage() {
    const checkboxes = document.querySelectorAll('.shortage-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('請選擇要訂購的零件');
        return;
    }

    if (checkboxes.length === 1) {
        // 單個零件直接跳轉
        const checkbox = checkboxes[0];
        const partNumber = checkbox.dataset.partNumber;
        createSingleOrder(partNumber);
    } else {
        // 多個零件詢問用戶是否要批量申請
        const partNames = Array.from(checkboxes).map(cb => cb.dataset.partName).join('\n- ');
        const confirmed = confirm(
            `已選擇 ${checkboxes.length} 個零件：\n\n- ${partNames}\n\n` +
            '週報訂單系統將為每個零件建立個別申請紀錄。\n是否繼續？'
        );
        
        if (confirmed) {
            // 批量週報訂單申請
            checkboxes.forEach((checkbox, index) => {
                const partData = shortagePartsData.find(item => item.part_number === checkbox.dataset.partNumber);
                if (partData) {
                    const params = new URLSearchParams({
                        part_number: partData.part_number,
                        part_name: partData.name || '',
                        quantity: partData.suggested_order || partData.shortage || 1,
                        unit: partData.unit || '',
                        priority: 'normal',
                        source: 'shortage'
                    });
                    
                    // 第一個在當前視窗開啟，其他在新視窗
                    if (index === 0) {
                        window.location.href = `/weekly-orders/register?${params.toString()}`;
                    } else {
                        window.open(`/weekly-orders/register?${params.toString()}`, '_blank');
                    }
                }
            });
        }
    }
}

// 將選中零件加入週報
function addToWeeklyOrder() {
    const selectedParts = [];
    const checkboxes = document.querySelectorAll('#shortageTable input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('請選擇要加入的零件');
        return;
    }
    
    checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const partNumber = row.cells[1].textContent.trim();
        const partName = row.cells[2].textContent.trim();
        const unit = row.cells[3].textContent.trim();
        const shortage = parseInt(checkbox.dataset.shortage) || 0;
        const suggestedOrder = parseInt(checkbox.dataset.suggestedOrder) || shortage;
        
        selectedParts.push({
            part_number: partNumber,
            part_name: partName,
            quantity: suggestedOrder,
            unit: unit,
            priority: 'normal',
            source: 'shortage'
        });
    });
    
    if (selectedParts.length === 1) {
        // 單一零件直接跳轉申請
        const part = selectedParts[0];
        const params = new URLSearchParams({
            part_number: part.part_number,
            part_name: part.part_name,
            quantity: part.quantity,
            unit: part.unit,
            priority: part.priority,
            source: part.source
        });
        
        window.location.href = `/weekly-orders/register?${params.toString()}`;
    } else {
        // 多個零件跳轉到批量申請頁面
        const itemsJson = JSON.stringify(selectedParts);
        const params = new URLSearchParams({
            items: itemsJson,
            source: 'shortage'
        });
        
        window.location.href = `/weekly-orders/batch-register?${params.toString()}`;
    }
}

// =============================================================================
// 缺少零件新增功能
// =============================================================================

// 更新新增按鈕
function updateAddButton() {
    const checkboxes = document.querySelectorAll('.missing-checkbox:checked');
    const addButton = document.getElementById('addSelectedPartsBtn');
    addButton.disabled = checkboxes.length === 0;
    addButton.innerHTML = checkboxes.length > 0 ? 
        `<i class="fas fa-plus"></i> 新增選中零件 (${checkboxes.length})` : '<i class="fas fa-plus"></i> 新增選中零件';
}

// 全選/取消全選
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllMissing');
    const checkboxes = document.querySelectorAll('.missing-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateAddButton();
}

// 新增單一零件
function addSinglePart(partNumber, description) {
    if (confirm(`確定要新增零件 "${partNumber}" 到零件倉庫？`)) {
        addPartsToInventory([{
            part_number: partNumber,
            description: description
        }]);
    }
}

// 新增選中零件
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

// 新增零件到庫存API呼叫
function addPartsToInventory(parts) {
    // 顯示載入狀態
    const addButton = document.getElementById('addSelectedPartsBtn');
    const originalText = addButton.innerHTML;
    addButton.disabled = true;
    addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';

    fetch('/reports/parts-comparison/add-parts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ parts: parts })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            let message = `成功新增 ${data.added_count} 個零件至零件庫！`;
            if (data.skipped_count > 0) {
                message += `\n跳過 ${data.skipped_count} 個已存在的零件。`;
            }
            if (data.errors && data.errors.length > 0) {
                message += `\n錯誤: ${data.errors.join(', ')}`;
            }
            alert(message);
            // 重新載入資料
            loadData();
        } else {
            alert('操作失敗: ' + data.error);
        }
    })
    .catch(error => {
        alert('網路錯誤: ' + error.message);
    })
    .finally(() => {
        // 恢復按鈕
        addButton.disabled = false;
        addButton.innerHTML = originalText;
    });
}

// 顯示詳細新增零件模態對話框
function showAddPartModal(partNumber, description) {
    document.getElementById('modalPartNumber').value = partNumber;
    document.getElementById('modalPartName').value = description || partNumber;
    document.getElementById('modalPartDescription').value = description || '';
    document.getElementById('modalPartUnit').value = '';
    document.getElementById('modalQuantityPerBox').value = 1;
    document.getElementById('modalSafetyStock').value = 0;
    document.getElementById('modalReorderPoint').value = 0;
    document.getElementById('modalStandardCost').value = 0;
    
    const modal = new bootstrap.Modal(document.getElementById('addPartModal'));
    modal.show();
}

// 使用詳細資訊新增零件
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
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('新增成功！');
            // 關閉模態對話框
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPartModal'));
            modal.hide();
            // 重新載入資料
            loadData();
        } else {
            alert('新增失敗: ' + data.error);
        }
    })
    .catch(error => {
        alert('網路錯誤: ' + error.message);
    });
}

// =============================================================================
// 未使用零件功能
// =============================================================================

let unusedPartsData = [];
let filteredUnusedData = [];
let unusedCurrentPage = 1;
let unusedPageSize = 25;

// 填充未使用零件表格
function fillUnusedTable(data) {
    unusedPartsData = data;
    filteredUnusedData = [...data]; // 複製顯示數據
    
    // 重置頁碼
    unusedCurrentPage = 1;
    
    // 渲染表格和分頁
    renderUnusedTable();
    updateUnusedPagination();
}

// 渲染未使用零件表格
function renderUnusedTable() {
    const tbody = document.querySelector('#unusedTable tbody');
    tbody.innerHTML = '';

    // 計算分頁範圍
    const startIndex = (unusedCurrentPage - 1) * unusedPageSize;
    const endIndex = startIndex + unusedPageSize;
    const pageData = filteredUnusedData.slice(startIndex, endIndex);

    // 渲染數據
    pageData.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${item.part_number}</strong></td>
            <td>${item.name || ''}</td>
            <td>${item.unit || ''}</td>
            <td class="text-end">${item.total_stock.toLocaleString()}</td>
            <td class="text-end">${item.available_stock.toLocaleString()}</td>
            <td><span class="badge bg-info">${item.action}</span></td>
        `;
    });

    // 更新結果資訊
    updateUnusedResultInfo();
}

// 更新未使用零件結果資訊
function updateUnusedResultInfo() {
    const resultInfo = document.getElementById('unusedResultInfo');
    const startIndex = (unusedCurrentPage - 1) * unusedPageSize + 1;
    const endIndex = Math.min(unusedCurrentPage * unusedPageSize, filteredUnusedData.length);
    
    if (filteredUnusedData.length === 0) {
        resultInfo.textContent = '0';
    } else {
        resultInfo.textContent = `${startIndex}-${endIndex} / ${filteredUnusedData.length}`;
    }
}

// 更新未使用零件分頁
function updateUnusedPagination() {
    const totalPages = Math.ceil(filteredUnusedData.length / unusedPageSize);
    const pagination = document.getElementById('unusedPagination');
    const currentPageSpan = document.getElementById('unusedCurrentPage');
    const totalPagesSpan = document.getElementById('unusedTotalPages');
    
    currentPageSpan.textContent = unusedCurrentPage;
    totalPagesSpan.textContent = totalPages;
    
    // 清除現有分頁
    pagination.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // 上一頁
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${unusedCurrentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `<button class="page-link" onclick="goToUnusedPage(${unusedCurrentPage - 1})" ${unusedCurrentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    pagination.appendChild(prevLi);
    
    // 計算要顯示的頁碼範圍
    let startPage = Math.max(1, unusedCurrentPage - 2);
    let endPage = Math.min(totalPages, unusedCurrentPage + 2);
    
    // 如果起始頁面大於1，顯示第一頁和省略號
    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        firstLi.innerHTML = `<button class="page-link" onclick="goToUnusedPage(1)">1</button>`;
        pagination.appendChild(firstLi);
        
        if (startPage > 2) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = '<span class="page-link">...</span>';
            pagination.appendChild(ellipsisLi);
        }
    }
    
    // 顯示頁碼
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === unusedCurrentPage ? 'active' : ''}`;
        li.innerHTML = `<button class="page-link" onclick="goToUnusedPage(${i})">${i}</button>`;
        pagination.appendChild(li);
    }
    
    // 如果結束頁面小於總頁數，顯示省略號和最後一頁
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = '<span class="page-link">...</span>';
            pagination.appendChild(ellipsisLi);
        }
        
        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        lastLi.innerHTML = `<button class="page-link" onclick="goToUnusedPage(${totalPages})">${totalPages}</button>`;
        pagination.appendChild(lastLi);
    }
    
    // 下一頁
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${unusedCurrentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `<button class="page-link" onclick="goToUnusedPage(${unusedCurrentPage + 1})" ${unusedCurrentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    pagination.appendChild(nextLi);
}

// 跳轉到指定頁面
function goToUnusedPage(page) {
    const totalPages = Math.ceil(filteredUnusedData.length / unusedPageSize);
    if (page < 1 || page > totalPages) return;
    
    unusedCurrentPage = page;
    renderUnusedTable();
    updateUnusedPagination();
}

// 搜尋未使用零件
function searchUnusedParts() {
    const searchTerm = document.getElementById('unusedSearchInput').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        filteredUnusedData = [...unusedPartsData];
    } else {
        filteredUnusedData = unusedPartsData.filter(item => {
            const partNumber = (item.part_number || '').toLowerCase();
            const name = (item.name || '').toLowerCase();
            return partNumber.includes(searchTerm) || name.includes(searchTerm);
        });
    }
    
    // 重置到第一頁
    unusedCurrentPage = 1;
    renderUnusedTable();
    updateUnusedPagination();
}

// 清除搜尋
function clearUnusedSearch() {
    document.getElementById('unusedSearchInput').value = '';
    searchUnusedParts();
}

// 改變每頁顯示數量
function changeUnusedPageSize() {
    unusedPageSize = parseInt(document.getElementById('unusedPageSize').value);
    unusedCurrentPage = 1; // 重置到第一頁
    renderUnusedTable();
    updateUnusedPagination();
}

// =============================================================================
// 工具函數
// =============================================================================

// 匯出Excel（模擬）
function exportToExcel() {
    if (!currentData) {
        alert('沒有資料可以匯出');
        return;
    }

    // 這裡可以實現真正的Excel匯出功能
    // 目前顯示示例訊息
    alert('Excel匯出功能開發中...\n\n' +
          '統計資料:\n' +
          `工單需求零件數: ${currentData.summary.work_order_parts_count}\n` +
          `零件庫零件數: ${currentData.summary.inventory_parts_count}\n` +
          `缺少零件: ${currentData.summary.missing_in_inventory_count}\n` +
          `缺貨零件: ${currentData.summary.shortage_parts_count}`);
}

// =============================================================================
// 初始化
// =============================================================================

document.addEventListener('DOMContentLoaded', function() {
    // 事件綁定
    document.getElementById('refreshBtn').addEventListener('click', loadData);
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    document.getElementById('addSelectedPartsBtn').addEventListener('click', addSelectedParts);
    document.getElementById('selectAllMissing').addEventListener('change', toggleSelectAll);
    document.getElementById('selectAllShortage').addEventListener('change', toggleSelectAllShortage);
    document.getElementById('addToWeeklyOrderBtn').addEventListener('click', addToWeeklyOrder);

    // 初始載入
    loadData();
});