// 開始盤點
function startCount(countId) {
    document.getElementById('countActionTitle').textContent = '開始盤點';
    document.getElementById('countActionMessage').textContent = '確定要開始這個盤點作業嗎？狀態將變更為「盤點中」。';
    document.getElementById('actionCountId').value = countId;
    document.getElementById('verifierField').style.display = 'none';
    document.getElementById('adjustmentField').style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('countActionModal'));
    modal.show();
}

// 完成盤點
function completeCount(countId) {
    document.getElementById('countActionTitle').textContent = '完成盤點';
    document.getElementById('countActionMessage').textContent = '確定要完成這個盤點作業嗎？';
    document.getElementById('actionCountId').value = countId;
    document.getElementById('verifierField').style.display = 'block';
    document.getElementById('adjustmentField').style.display = 'block';
    
    const modal = new bootstrap.Modal(document.getElementById('countActionModal'));
    modal.show();
}

// 提交盤點操作
document.getElementById('submitCountAction').addEventListener('click', function() {
    const countId = document.getElementById('actionCountId').value;
    const title = document.getElementById('countActionTitle').textContent;
    
    if (title === '開始盤點') {
        // 調用開始盤點 API
        fetch(`/api/inventory/stock-counts/${countId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('盤點已開始！請前往盤點詳細頁面進行盤點作業。');
                location.reload();
            } else {
                alert('操作失敗：' + (data.error || '未知錯誤'));
            }
        })
        .catch(err => {
            alert('網路錯誤：' + err.message);
        });
    } else if (title === '完成盤點') {
        const verifiedBy = document.getElementById('verified_by').value;
        const applyAdjustments = document.getElementById('apply_adjustments').checked;
        
        if (!verifiedBy.trim()) {
            alert('請輸入驗證人員姓名');
            return;
        }
        
        // 調用完成盤點 API
        fetch(`/api/inventory/stock-counts/${countId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                verified_by: verifiedBy,
                apply_adjustments: applyAdjustments
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message || '盤點已完成！');
                location.reload();
            } else {
                alert('操作失敗：' + (data.error || '未知錯誤'));
            }
        })
        .catch(err => {
            alert('網路錯誤：' + err.message);
        });
    }
    
    bootstrap.Modal.getInstance(document.getElementById('countActionModal')).hide();
});

// 編輯盤點
function editCount(countId) {
    // 跳轉到編輯頁面
    window.location.href = `/inventory/stock-counts/${countId}/edit`;
}

// 刪除盤點
function deleteCount(countId, countNumber) {
    document.getElementById('delete_count_number').textContent = countNumber;
    document.getElementById('deleteCountForm').action = `/api/inventory/stock-counts/${countId}/delete`;
    
    const modal = new bootstrap.Modal(document.getElementById('deleteCountModal'));
    modal.show();
}

// 刪除表單提交
document.getElementById('deleteCountForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const form = this;
    const url = form.action;
    
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('盤點已刪除');
            location.reload();
        } else {
            alert('刪除失敗：' + (data.error || '未知錯誤'));
        }
    })
    .catch(err => {
        alert('網路錯誤：' + err.message);
    });
    
    bootstrap.Modal.getInstance(document.getElementById('deleteCountModal')).hide();
});
