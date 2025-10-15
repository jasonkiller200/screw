// 選擇功能
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const orderCheckboxes = document.querySelectorAll('.order-checkbox');
    
    orderCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

function selectAll() {
    const orderCheckboxes = document.querySelectorAll('.order-checkbox');
    orderCheckboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    document.getElementById('selectAllCheckbox').checked = true;
}

// 確認選中的訂單
function confirmSelected() {
    const selectedCheckboxes = document.querySelectorAll('.order-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('請至少選擇一筆訂單');
        return;
    }
    
    // 更新模態框內容
    document.getElementById('selectedCount').textContent = selectedCheckboxes.length;
    
    // 列出選中的訂單
    let ordersList = '<ul class="list-unstyled">';
    selectedCheckboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        const orderId = row.children[1].textContent;
        const partNumber = row.children[2].textContent;
        const quantity = row.children[5].textContent;
        ordersList += `<li><small>${orderId} - ${partNumber} (數量: ${quantity})</small></li>`;
    });
    ordersList += '</ul>';
    document.getElementById('selectedOrdersList').innerHTML = ordersList;
    
    // 顯示模態框
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

// 確認訂單按鈕事件
document.getElementById('confirmOrdersBtn').addEventListener('click', function() {
    const selectedCheckboxes = document.querySelectorAll('.order-checkbox:checked');
    const orderIds = Array.from(selectedCheckboxes).map(checkbox => parseInt(checkbox.value));
    
    // 發送確認請求
    fetch('/api/confirm_orders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            order_ids: orderIds
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('訂單確認成功！');
            // 重新載入頁面以更新狀態
            location.reload();
        } else {
            alert('訂單確認失敗：' + data.error);
        }
    })
    .catch(err => {
        alert('網路錯誤：' + err.message);
    });
    
    // 關閉模態框
    bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
});

// 監聽個別checkbox變化，更新全選狀態
document.querySelectorAll('.order-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const allCheckboxes = document.querySelectorAll('.order-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.order-checkbox:checked');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        
        if (checkedCheckboxes.length === allCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    });
});
