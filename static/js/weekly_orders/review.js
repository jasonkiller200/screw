let currentRegistrationId = null;
let currentRegistrationData = null;

// 篩選功能
document.querySelectorAll('input[name="statusFilter"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const status = this.value;
        const rows = document.querySelectorAll('.registration-row');
        
        rows.forEach(row => {
            if (status === 'all' || row.dataset.status === status) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
});

// 全選功能
const selectAllCheckbox = document.getElementById('selectAll');
if (selectAllCheckbox) { // 僅在元素存在時添加監聽器
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.registration-checkbox:not([style*="display: none"])');
        checkboxes.forEach(cb => cb.checked = this.checked);
    });
}

// 查看詳細資訊
function viewDetails(registrationId) {
    fetch(`/weekly_orders/registration/${registrationId}`)
        .then(response => response.json())
        .then(data => {
            const content = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>基本資訊</h6>
                        <table class="table table-sm">
                            <tr><td><strong>品號：</strong></td><td>${data.part_number}</td></tr>
                            <tr><td><strong>品名：</strong></td><td>${data.part_name}</td></tr>
                            <tr><td><strong>儲位：</strong></td><td>${data.location_display || '無指定儲位'}</td></tr>
                            <tr><td><strong>種類：</strong></td><td>${data.category || '-'}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>數量與時間</h6>
                        <table class="table table-sm">
                            <tr><td><strong>數量：</strong></td><td>${data.quantity} ${data.unit}</td></tr>
                            <tr><td><strong>需用日期：</strong></td><td>${data.required_date || '-'}</td></tr>
                            <tr><td><strong>申請時間：</strong></td><td>${new Date(data.created_at).toLocaleString('zh-TW')}</td></tr>
                            <tr><td><strong>用途備註：</strong></td><td>${data.purpose_notes || '-'}</td></tr>
                        </table>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>申請人資訊</h6>
                        <table class="table table-sm">
                            <tr><td><strong>申請人：</strong></td><td>${data.applicant_name}</td></tr>
                            <tr><td><strong>申請單位：</strong></td><td>${data.department || '-'}</td></tr>
                        </table>
                    </div>
                </div>
                ${data.review_notes ? `
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>審查備註</h6>
                        <div class="alert alert-info">${data.review_notes}</div>
                    </div>
                </div>
                ` : ''}
            `;
            
            document.getElementById('detailContent').innerHTML = content;
            new bootstrap.Modal(document.getElementById('detailModal')).show();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('載入詳細資訊失敗');
        });
}

// 審查申請
function reviewRegistration(registrationId, action) {
    if (action === 'rejected') {
        currentRegistrationId = registrationId;
        new bootstrap.Modal(document.getElementById('rejectModal')).show();
        return;
    }
    
    // 直接通過
    submitReview(registrationId, action, '');
}

// 確認拒絕
function confirmReject() {
    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) {
        alert('請填寫拒絕原因');
        return;
    }
    
    submitReview(currentRegistrationId, 'rejected', reason);
    bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
}

// 提交審查結果
function submitReview(registrationId, action, notes, modifiedQuantity = null) {
    const requestData = {
        action: action,
        notes: notes
    };
    
    if (modifiedQuantity !== null) {
        requestData.modified_quantity = modifiedQuantity;
    }
    
    fetch(`/weekly_orders/review/${registrationId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload(); // 重新載入頁面以顯示更新結果
        } else {
            alert('審查失敗：' + (data.message || '未知錯誤'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('審查失敗，請稍後再試');
    });
}

// 批量通過
function batchApprove() {
    const checkedBoxes = document.querySelectorAll('.registration-checkbox:checked');
    if (checkedBoxes.length === 0) {
        alert('請選擇要通過的申請項目');
        return;
    }
    
    if (!confirm(`確定要通過選中的 ${checkedBoxes.length} 個申請項目嗎？`)) {
        return;
    }
    
    const registrationIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    fetch('/weekly_orders/batch_review', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            registration_ids: registrationIds,
            action: 'approved'
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            location.reload();
        } else {
            alert('批量審查失敗：' + (data.message || '未知錯誤'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('批量審查失敗，請稍後再試');
    });
}

// 顯示零件詳情
function showPartDetails(partNumber) {
    console.log('showPartDetails called with:', partNumber);
    if (!partNumber) {
        console.log('No part number provided');
        return;
    }
    
    const modalLabel = document.getElementById('detailModalLabel');
    const detailContent = document.getElementById('detailContent');
    const modalElement = document.getElementById('detailModal');
    
    console.log('Modal elements found:', {
        modalLabel: !!modalLabel,
        detailContent: !!detailContent,
        modalElement: !!modalElement
    });
    
    if (!modalLabel || !detailContent || !modalElement) {
        console.error('Modal elements not found');
        alert('模態視窗元素未找到，請確認頁面載入完整');
        return;
    }
    
    modalLabel.textContent = `零件詳情: ${partNumber}`;
    detailContent.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">載入中...</span>
            </div>
            <p class="mt-2">正在載入零件資訊...</p>
        </div>
    `;
    
    // 使用更相容的方式顯示模態視窗
    let modal;
    try {
        console.log('Bootstrap availability:', {
            bootstrap: typeof bootstrap,
            windowBootstrap: typeof window.bootstrap,
            bootstrapModal: typeof bootstrap !== 'undefined' ? typeof bootstrap.Modal : 'undefined'
        });
        
        // 嘗試使用 Bootstrap 5 的方式
        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            console.log('Using bootstrap.Modal');
            modal = new bootstrap.Modal(modalElement);
        } else if (typeof window.bootstrap !== 'undefined' && window.bootstrap.Modal) {
            console.log('Using window.bootstrap.Modal');
            modal = new window.bootstrap.Modal(modalElement);
        } else {
            console.log('Bootstrap Modal not found, trying jQuery fallback');
            // 回退到 jQuery 方式（如果可用）
            if (typeof $ !== 'undefined') {
                console.log('Using jQuery modal');
                $(modalElement).modal('show');
                modal = { show: function() {} }; // 假模態物件
            } else {
                console.error('Bootstrap Modal not available and no jQuery fallback');
                alert('無法顯示詳細資訊視窗，請檢查頁面載入是否完整');
                return;
            }
        }
        
        if (modal && typeof modal.show === 'function') {
            console.log('Showing modal');
            modal.show();
        } else {
            console.error('Modal object does not have show method');
        }
        
    } catch (error) {
        console.error('Error showing modal:', error);
        alert('無法顯示詳細資訊視窗: ' + error.message);
        return;
    }

    fetch(`/api/part/${encodeURIComponent(partNumber)}?include_locations=true`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                detailContent.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
                return;
            }

            const part = data.part_info;
            const history = data.order_history || [];
            const inventories = data.inventories || [];

            let historyHtml = '';
            if (history.length > 0) {
                const statusMap = {
                    'registered': { text: '已登記', class: 'secondary' },
                    'approved': { text: '已核准', class: 'primary' },
                    'partially_received': { text: '部分到貨', class: 'info' },
                    'completed': { text: '已完成', class: 'success' },
                    'rejected': { text: '已拒絕', class: 'danger' }
                };

                historyHtml = history.map(reg => {
                    const date = new Date(reg.created_at);
                    const formattedDate = date.getFullYear() + '-' +
                                          String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                          String(date.getDate()).padStart(2, '0');
                    
                    const statusInfo = statusMap[reg.status] || { text: reg.status, class: 'light' };

                    return `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${reg.applicant_name || 'N/A'}</td>
                            <td>${reg.location_display || '無指定'}</td>
                            <td>${reg.quantity}</td>
                            <td>
                                <span class="badge bg-${statusInfo.class}">
                                    ${statusInfo.text}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                historyHtml = '<tr><td colspan="4" class="text-center text-muted">暫無申請記錄</td></tr>';
            }

            let inventoryHtml = '';
            const all_locations = part?.locations || [];

            if (all_locations.length > 0) {
                inventoryHtml = all_locations.map(loc => {
                    // 從 inventories 陣列中尋找此位置的庫存記錄
                    const inv = inventories.find(i => i.warehouse_id === loc.warehouse_id);

                    const quantity_on_hand = inv ? inv.quantity_on_hand : 0;
                    const reserved_quantity = inv ? inv.reserved_quantity : 0;
                    const available_quantity = inv ? inv.available_quantity : 0;

                    return `
                        <tr>
                            <td>${loc.warehouse_name} (${loc.warehouse_code})</td>
                            <td>${loc.location_code}</td>
                            <td>${quantity_on_hand}</td>
                            <td>${reserved_quantity}</td>
                            <td><strong>${available_quantity}</strong></td>
                        </tr>
                    `;
                }).join('');
            } else {
                inventoryHtml = '<tr><td colspan="5" class="text-center text-muted">此零件未設定儲位</td></tr>';
            }

            detailContent.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>基本資訊</h6>
                        <table class="table table-sm">
                            <tr><td><strong>零件編號：</strong></td><td>${part?.part_number || 'N/A'}</td></tr>
                            <tr><td><strong>名稱：</strong></td><td>${part?.name || 'N/A'}</td></tr>
                            <tr><td><strong>描述：</strong></td><td>${part?.description || '無'}</td></tr>
                            <tr><td><strong>單位：</strong></td><td>${part?.unit || 'N/A'}</td></tr>
                            <tr><td><strong>每盒數量：</strong></td><td>${part?.quantity_per_box || 'N/A'}</td></tr>
                            <tr><td><strong>採購前置期：</strong></td><td>${part?.lead_time || 'N/A'} 天</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>各倉庫庫存</h6>
                        <div class="table-responsive">
                            <table class="table table-sm table-striped">
                                <thead>
                                    <tr>
                                        <th>倉庫</th>
                                        <th>倉位</th>
                                        <th>在庫數量</th>
                                        <th>預留數量</th>
                                        <th>可用數量</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${inventoryHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="row mt-3">
                    <div class="col-12">
                        <h6>訂購歷史</h6>
                        <div class="order-history" style="max-height: 200px; overflow-y: auto;">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>申請日期</th>
                                        <th>申請人</th>
                                        <th>儲位</th>
                                        <th>數量</th>
                                        <th>狀態</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${historyHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        })
        .catch(error => {
            console.error('Error fetching part details:', error);
            detailContent.innerHTML = `<div class="alert alert-danger">載入零件詳情失敗：${error.message}</div>`;
        });
}

// 修改數量
function modifyQuantity(registrationId) {
    currentRegistrationId = registrationId;
    
    // 獲取當前項目詳細信息
    fetch(`/weekly_orders/registration/${registrationId}`)
        .then(response => response.json())
        .then(data => {
            currentRegistrationData = data;
            
            // 填充模態框
            document.getElementById('modifyItemInfo').value = `${data.part_number} - ${data.part_name}`;
            document.getElementById('originalQuantity').value = `${data.quantity} ${data.unit}`;
            document.getElementById('modifiedQuantity').value = data.quantity;
            document.getElementById('modifyReason').value = '';
            
            // 顯示模態框
            new bootstrap.Modal(document.getElementById('modifyModal')).show();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('載取項目信息失敗');
        });
}

// 確認修改數量
function confirmModify() {
    const modifiedQuantity = parseInt(document.getElementById('modifiedQuantity').value);
    const modifyReason = document.getElementById('modifyReason').value.trim();
    
    if (!modifiedQuantity || modifiedQuantity <= 0) {
        alert('請輸入有效的數量');
        return;
    }
    
    if (!modifyReason) {
        alert('請填寫修改說明');
        document.getElementById('modifyReason').focus();
        return;
    }
    
    if (modifiedQuantity === currentRegistrationData.quantity) {
        alert('修改後的數量與原數量相同，將直接核准');
        submitReview(currentRegistrationId, 'approved', modifyReason);
    } else {
        submitReview(currentRegistrationId, 'approved', modifyReason, modifiedQuantity);
    }
    
    // 隱藏模態框
    bootstrap.Modal.getInstance(document.getElementById('modifyModal')).hide();
}
