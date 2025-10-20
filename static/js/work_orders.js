// 工單需求匯入功能
document.getElementById('startImportBtn').addEventListener('click', function() {
    const form = document.getElementById('importForm');
    const fileInput = document.getElementById('excelFile');
    const confirmCheck = document.getElementById('confirmImport');
    const progressDiv = document.getElementById('importProgress');
    const resultDiv = document.getElementById('importResult');
    const startBtn = this;
    
    // 驗證表單
    if (!fileInput.files.length) {
        alert('請選擇要匯入的 Excel 檔案');
        return;
    }
    
    if (!confirmCheck.checked) {
        alert('請確認您已了解匯入操作的影響');
        return;
    }
    
    // 顯示進度，隱藏按鈕
    progressDiv.style.display = 'block';
    resultDiv.style.display = 'none';
    startBtn.disabled = true;
    document.querySelector('[data-bs-dismiss="modal"]').disabled = true;
    
    // 創建 FormData 並提交
    const formData = new FormData(form);
    
    fetch(form.action, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        progressDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        
        if (data.success) {
            let filterInfo = '';
            if (data.filtered_count && data.filtered_count > 0) {
                filterInfo = `<li>🚫 篩選排除: <strong>${data.filtered_count}</strong> 筆 (包含'圖'的項目)</li>`;
            }
            
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h6><i class="fas fa-check-circle me-2"></i>匯入完成！</h6>
                    <ul class="mb-0">
                        <li>✓ 新增記錄: <strong>${data.imported_count}</strong> 筆</li>
                        <li>⟲ 更新記錄: <strong>${data.updated_count}</strong> 筆</li>
                        <li>✗ 錯誤記錄: <strong>${data.error_count}</strong> 筆</li>
                        ${filterInfo}
                        <li>📊 總計處理: <strong>${data.total_processed}</strong> 筆</li>
                    </ul>
                    <div class="mt-2">
                        <button class="btn btn-primary btn-sm" onclick="location.reload()">
                            <i class="fas fa-refresh me-1"></i>重新載入頁面
                        </button>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h6><i class="fas fa-exclamation-triangle me-2"></i>匯入失敗</h6>
                    <p class="mb-0">${data.error || '未知錯誤'}</p>
                </div>
            `;
        }
    })
    .catch(error => {
        progressDiv.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-triangle me-2"></i>匯入失敗</h6>
                <p class="mb-0">網路錯誤或伺服器異常，請稍後重試</p>
            </div>
        `;
        console.error('匯入錯誤:', error);
    })
    .finally(() => {
        startBtn.disabled = false;
        document.querySelector('[data-bs-dismiss="modal"]').disabled = false;
    });
});

// 重置模態框狀態
document.getElementById('importModal').addEventListener('hidden.bs.modal', function() {
    document.getElementById('importForm').reset();
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importResult').style.display = 'none';
    document.getElementById('startImportBtn').disabled = false;
    document.querySelector('[data-bs-dismiss="modal"]').disabled = false;
});
