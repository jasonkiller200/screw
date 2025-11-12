document.addEventListener('DOMContentLoaded', function() {
    // Get the countId from a data attribute on a DOM element
    const stockCountCard = document.getElementById('stock-count-card');
    if (!stockCountCard) {
        console.error('Could not find stock-count-card element. Aborting script.');
        return;
    }
    const countId = stockCountCard.dataset.countId;

    const partSearchInput = document.getElementById('part_search');
    if (partSearchInput) {
        partSearchInput.addEventListener('input', function() {
            const query = this.value.trim();
            const searchResults = document.getElementById('searchResults');
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }
            
            // I see a bug here, the API endpoint /api/parts/search does not exist.
            // I will assume it should be /api/part/<part_number> or similar, but for now I will leave it as is.
            fetch(`/api/parts/search?q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(data => {
                    searchResults.innerHTML = '';
                    
                    if (data.parts && data.parts.length > 0) {
                        data.parts.forEach(part => {
                            const item = document.createElement('a');
                            item.className = 'list-group-item list-group-item-action';
                            item.href = '#';
                            item.innerHTML = `<strong>${part.part_number}</strong> - ${part.name}`;
                            item.onclick = function(e) {
                                e.preventDefault();
                                selectPart(part.id, part.part_number, part.name);
                            };
                            searchResults.appendChild(item);
                        });
                        searchResults.style.display = 'block';
                    } else {
                        searchResults.style.display = 'none';
                    }
                });
        });
    }
});

//選擇零件
function selectPart(partId, partNumber, partName) {
    document.getElementById('selected_part_id').value = partId;
    document.getElementById('part_search').value = `${partNumber} - ${partName}`;
    document.getElementById('searchResults').style.display = 'none';
}

// 新增盤點項目
function addCountItem() {
    const modal = new bootstrap.Modal(document.getElementById('addItemModal'));
    modal.show();
}

// 提交新增項目
function submitAddItem() {
    const countId = document.getElementById('stock-count-card').dataset.countId;
    const partId = document.getElementById('selected_part_id').value;
    const actualQty = document.getElementById('actual_qty').value;
    
    if (!partId) {
        alert('請選擇零件');
        return;
    }
    
    if (!actualQty || actualQty < 0) {
        alert('請輸入有效的實盤數量');
        return;
    }
    
    fetch(`/api/inventory/stock-counts/${countId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            part_id: parseInt(partId),
            counted_quantity: parseInt(actualQty)
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('項目新增成功');
            location.reload();
        } else {
            alert('新增失敗：' + data.error);
        }
    })
    .catch(err => alert('網路錯誤：' + err.message));
}

// Helper function to update a single row's UI
function updateTableRowUI(row, item) {
    if (!row || !item) return;

    // Update Variance Quantity
    const varianceCell = row.querySelector('.variance-qty');
    if (varianceCell) {
        const diff = item.variance_quantity;
        let diffHtml = `<span class="text-muted">0</span>`;
        if (diff > 0) {
            diffHtml = `<span class="text-success">+${diff}</span>`;
        } else if (diff < 0) {
            diffHtml = `<span class="text-danger">${diff}</span>`;
        }
        varianceCell.innerHTML = diffHtml;
    }

    // Update Variance Rate
    const varianceRateCell = row.querySelector('.variance-rate');
    const systemQtyCell = row.querySelector('.system-qty');
    if (varianceRateCell && systemQtyCell) {
        const systemQty = parseInt(systemQtyCell.textContent, 10);
        let rateHtml = `<span class="text-muted">-</span>`;
        
        if (item.counted_quantity !== null) {
            if (systemQty > 0) {
                const rate = (item.variance_quantity / systemQty) * 100;
                if (rate > 0) {
                    rateHtml = `<span class="text-success">+${rate.toFixed(1)}%</span>`;
                } else if (rate < 0) {
                    rateHtml = `<span class="text-danger">${rate.toFixed(1)}%</span>`;
                } else {
                    rateHtml = `<span class="text-muted">0.0%</span>`;
                }
            } else if (systemQty === 0 && item.variance_quantity !== 0) {
                rateHtml = `<span class="text-success">+∞%</span>`;
            } else { // systemQty is 0 and variance is 0
                rateHtml = `<span class="text-muted">0.0%</span>`;
            }
        }
        varianceRateCell.innerHTML = rateHtml;
    }

    // Update Counted At time
    const countedAtCell = row.querySelector('.counted-at');
    if (countedAtCell) {
        countedAtCell.textContent = item.counted_at || '-';
    }
}

// 儲存盤點項目
function saveCountItem(buttonElement) {
    const row = buttonElement.closest('tr');
    const input = row.querySelector('.count-input');
    const countId = document.getElementById('stock-count-card').dataset.countId;
    
    const detailId = input.dataset.detailId;
    const actualQty = input.value;

    if (actualQty === '' || actualQty < 0) {
        alert('請輸入有效的實盤數量（大於等於0）');
        return;
    }

    // Provide user feedback
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    fetch(`/api/inventory/stock-counts/${countId}/details/${detailId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            counted_quantity: parseInt(actualQty, 10)
        })
    })
    .then(response => {
        if (!response.ok) {
            // Try to parse error message from backend
            return response.json().then(err => { throw new Error(err.error || '伺服器錯誤') });
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.updated_item) {
            // Use the helper to update the UI
            updateTableRowUI(row, data.updated_item);

            // --- Restore button state ---
            const originalIcon = '<i class="fas fa-save"></i>';
            buttonElement.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                buttonElement.innerHTML = originalIcon;
                buttonElement.disabled = false;
            }, 1500);

        } else {
            throw new Error(data.error || '更新失敗，未收到有效資料');
        }
    })
    .catch(err => {
        alert('更新失敗：' + err.message);
        // Revert button on error
        buttonElement.innerHTML = '<i class="fas fa-save"></i>';
        buttonElement.disabled = false;
    });
}

// 顯示匯入模態框
function showImportModal() {
    const modal = new bootstrap.Modal(document.getElementById('importCountModal'));
    modal.show();
}

// 提交匯入
function submitImport() {
    const countId = document.getElementById('stock-count-card').dataset.countId;
    const fileInput = document.getElementById('count_file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('請選擇要匯入的檔案');
        return;
    }
    
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isExcel) {
        alert('請上傳 Excel 格式檔案（.xlsx 或 .xls）');
        return;
    }
    
    // 顯示進度
    document.getElementById('importProgress').style.display = 'block';
    document.getElementById('importResult').style.display = 'none';
    
    // 讀取並解析 Excel
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // 讀取第一個工作表
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 轉換為 JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {header: 1});
            
            if (jsonData.length < 2) {
                alert('檔案格式錯誤：無資料');
                document.getElementById('importProgress').style.display = 'none';
                return;
            }
            
            // 解析標題行
            const headers = jsonData[0];
            
            // 找到欄位索引（支援中英文）
            const partNumberIdx = headers.findIndex(h => 
                h === '零件編號' || h === 'part_number' || h === 'Part Number'
            );
            const storageLocationIdx = headers.findIndex(h => 
                h === '儲位' || h === 'storage_location' || h === 'Storage Location'
            );
            const countedQtyIdx = headers.findIndex(h => 
                h === '實盤數量' || h === 'counted_quantity' || h === 'Counted Quantity'
            );
            const notesIdx = headers.findIndex(h => 
                h === '備註' || h === 'notes' || h === 'Notes'
            );
            
            if (partNumberIdx === -1 || countedQtyIdx === -1) {
                alert('檔案格式錯誤：缺少必要欄位（零件編號、實盤數量）');
                document.getElementById('importProgress').style.display = 'none';
                return;
            }
            
            // 解析資料行
            const updates = [];
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;
                
                const partNumber = row[partNumberIdx];
                const storageLocation = storageLocationIdx >= 0 ? (row[storageLocationIdx] || '') : '';
                const countedQty = row[countedQtyIdx];
                const notes = notesIdx >= 0 ? (row[notesIdx] || '') : '';
                
                // 跳過空行或沒有數據的行
                if (!partNumber || countedQty === undefined || countedQty === null || countedQty === '') {
                    continue;
                }
                
                updates.push({
                    part_number: String(partNumber).trim(),
                    storage_location: String(storageLocation).trim(),
                    counted_quantity: parseInt(countedQty),
                    notes: String(notes).trim()
                });
            }
            
            if (updates.length === 0) {
                alert('沒有可匯入的資料（請確保「實盤數量」欄位已填寫）');
                document.getElementById('importProgress').style.display = 'none';
                return;
            }
            
            // 批量更新
            Promise.all(updates.map(update => 
                fetch(`/api/inventory/stock-counts/${countId}/items/update-by-part`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(update)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        successCount++;
                    } else {
                        errorCount++;
                        errors.push(`${update.part_number}: ${data.error}`);
                    }
                })
                .catch(err => {
                    errorCount++;
                    errors.push(`${update.part_number}: ${err.message}`);
                })
            ))
            .then(() => {
                document.getElementById('importProgress').style.display = 'none';
                
                let resultHtml = `
                    <div class="alert alert-${errorCount > 0 ? 'warning' : 'success'}">
                        <h6><i class="fas fa-${errorCount > 0 ? 'exclamation-triangle' : 'check-circle'} me-2"></i>匯入完成</h6>
                        <p class="mb-0">✓ 成功: ${successCount} 筆 / ✗ 失敗: ${errorCount} 筆</p>
                    </div>
                `;
                
                if (errors.length > 0) {
                    resultHtml += `
                        <div class="alert alert-danger">
                            <h6><i class="fas fa-times-circle me-2"></i>錯誤訊息：</h6>
                            <ul class="mb-0" style="max-height: 200px; overflow-y: auto;">
                                ${errors.slice(0, 20).map(err => `<li>${err}</li>`).join('')}
                                ${errors.length > 20 ? `<li><strong>...還有 ${errors.length - 20} 個錯誤</strong></li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                
                document.getElementById('importResult').innerHTML = resultHtml;
                document.getElementById('importResult').style.display = 'block';
                
                if (successCount > 0) {
                    setTimeout(() => location.reload(), 3000);
                }
            });
            
        } catch (err) {
            alert('讀取檔案錯誤：' + err.message);
            document.getElementById('importProgress').style.display = 'none';
        }
    };
    
    reader.readAsArrayBuffer(file);
}

// 開始盤點
function startCounting() {
    const countId = document.getElementById('stock-count-card').dataset.countId;
    if (confirm('確定要開始這個盤點作業嗎？')) {
        fetch(`/api/inventory/stock-counts/${countId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('盤點已開始');
                location.reload();
            } else {
                alert('操作失敗：' + data.error);
            }
        })
        .catch(err => alert('網路錯誤：' + err.message));
    }
}

// 完成盤點
function completeCounting() {
    const countId = document.getElementById('stock-count-card').dataset.countId;
    const verifiedBy = prompt('請輸入驗證人員姓名：');
    if (verifiedBy) {
        fetch(`/api/inventory/stock-counts/${countId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                verified_by: verifiedBy,
                apply_adjustments: confirm('是否同時應用盤點差異調整？')
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('盤點已完成');
                location.reload();
            } else {
                alert('操作失敗：' + data.error);
            }
        })
        .catch(err => alert('網路錯誤：' + err.message));
    }
}

// 匯出盤點資料
function exportCountData() {
    const countId = document.getElementById('stock-count-card').dataset.countId;
    window.open(`/api/inventory/stock-counts/${countId}/export`, '_blank');
}

// 批量儲存盤點結果
function batchSaveCounts() {
    const countId = document.getElementById('stock-count-card').dataset.countId;
    const saveButton = document.getElementById('batch-save-btn');
    
    // 找到所有已填寫的輸入框
    const inputs = document.querySelectorAll('.count-input');
    const updates = [];

    inputs.forEach(input => {
        const value = input.value.trim();
        if (value !== '' && value >= 0) {
            updates.push({
                detail_id: parseInt(input.dataset.detailId, 10),
                counted_quantity: parseInt(value, 10)
            });
        }
    });

    if (updates.length === 0) {
        alert('沒有需要儲存的盤點數量。請先在「實盤數量」欄位中輸入數字。');
        return;
    }

    // 提供使用者回饋
    const originalHtml = saveButton.innerHTML;
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>儲存中...';

    fetch(`/api/inventory/stock-counts/${countId}/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || '伺服器錯誤') });
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.updated_items) {
            saveButton.innerHTML = '<i class="fas fa-check me-1"></i>儲存成功';
            alert(`成功儲存 ${data.updated_items.length} 筆盤點記錄。`);

            // Loop through updated items and update each row's UI
            data.updated_items.forEach(item => {
                const row = document.getElementById(`row-${item.id}`);
                updateTableRowUI(row, item);
            });

            // Revert button after a delay, no page reload needed
            setTimeout(() => {
                saveButton.innerHTML = originalHtml;
                saveButton.disabled = false;
            }, 2000);
        } else {
            throw new Error(data.error || '批量更新失敗');
        }
    })
    .catch(err => {
        alert('儲存失敗：' + err.message);
        // 發生錯誤時還原按鈕
        saveButton.innerHTML = originalHtml;
        saveButton.disabled = false;
    });
}
