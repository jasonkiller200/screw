let currentRegistrationId = null;

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
document.getElementById('selectAll').addEventListener('change', function() {
    const checkboxes = document.querySelectorAll('.registration-checkbox:not([style*="display: none"])');
    checkboxes.forEach(cb => cb.checked = this.checked);
});

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
                            <tr><td><strong>儲位：</strong></td><td>${data.location_code || '-'}</td></tr>
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
function submitReview(registrationId, action, notes) {
    fetch(`/weekly_orders/review/${registrationId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: action,
            notes: notes
        })
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
    document.getElementById('detailModalLabel').textContent = `零件詳情: ${partNumber}`;
    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div class="text-center py-3">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">載入中...</span>
            </div>
            <p class="mt-2">正在載入零件資訊...</p>
        </div>
    `;
    new bootstrap.Modal(document.getElementById('detailModal')).show();

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
                historyHtml = history.map(order => {
                    const date = new Date(order.order_date);
                    const formattedDate = date.getFullYear() + '-' +
                                          String(date.getMonth() + 1).padStart(2, '0') + '-' +
                                          String(date.getDate()).padStart(2, '0') + ' ' +
                                          String(date.getHours()).padStart(2, '0') + ':' +
                                          String(date.getMinutes()).padStart(2, '0');
                    return `
                        <tr>
                            <td>${formattedDate}</td>
                            <td>${order.quantity_ordered}</td>
                            <td>
                                <span class="badge bg-${order.status === 'confirmed' ? 'success' : 'warning'}">
                                    ${order.status === 'confirmed' ? '已確認' : '待處理'}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                historyHtml = '<tr><td colspan="3" class="text-center text-muted">暫無訂購記錄</td></tr>';
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
                                        <th>訂購日期</th>
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
