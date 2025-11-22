document.addEventListener('DOMContentLoaded', function () {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.inbound-checkbox');
    const batchInboundBtn = document.getElementById('batchInboundBtn');

    // Logic for select all checkbox
    if(selectAll) {
        selectAll.addEventListener('change', function () {
            checkboxes.forEach(cb => {
                cb.checked = selectAll.checked;
            });
        });
    }

    // Logic for batch inbound button
    if(batchInboundBtn) {
        batchInboundBtn.addEventListener('click', function () {
            const selectedRows = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.closest('tr'));

            if (selectedRows.length === 0) {
                alert('請至少選擇一個要入庫的項目。');
                return;
            }

            openBatchInboundModal(selectedRows);
        });
    }
});

/**
 * Opens the single item inbound modal.
 */
function openInboundModal(itemId, requestedQuantity, partNumber) {
    document.getElementById('modalItemId').value = itemId;
    document.getElementById('modalPartNumber').textContent = partNumber;
    document.getElementById('modalRequestedQuantity').textContent = requestedQuantity;
    document.getElementById('inboundQuantity').value = requestedQuantity;
    document.getElementById('inboundQuantity').max = requestedQuantity;
    document.getElementById('inboundNotes').value = '';

    const inboundModal = new bootstrap.Modal(document.getElementById('inboundModal'));
    inboundModal.show();
}

/**
 * Confirms the single item inbound action and calls the backend API.
 */
function confirmInbound() {
    const itemId = document.getElementById('modalItemId').value;
    const quantity = document.getElementById('inboundQuantity').value;
    const notes = document.getElementById('inboundNotes').value;

    if (!quantity || parseInt(quantity) <= 0) {
        alert('請輸入有效的入庫數量。');
        return;
    }

    const postData = {
        registration_id: parseInt(itemId),
        quantity: parseInt(quantity),
        notes: notes
    };

    fetch('/api/weekly_orders/inbound_item', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert(data.message || '入庫成功！');
            location.reload(); 
        } else {
            alert('入庫失敗: ' + (data.error || '未知錯誤'));
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('執行入庫時發生網路或伺服器錯誤。');
    });
}

/**
 * Opens the batch inbound modal and populates it with selected items.
 * @param {Array<Element>} selectedRows - The selected table row elements.
 */
function openBatchInboundModal(selectedRows) {
    const tableBody = document.getElementById('batchInboundTableBody');
    tableBody.innerHTML = ''; // Clear previous content

    selectedRows.forEach(row => {
        const itemId = row.dataset.itemId;
        const partNumber = row.cells[2].textContent.trim();
        const partName = row.cells[3].textContent.trim();
        const remainingQuantity = parseInt(row.cells[6].textContent.trim()); // 剩餘數量在第6欄（索引6）

        const newRow = `
            <tr data-item-id="${itemId}">
                <td>${partNumber}</td>
                <td>${partName}</td>
                <td class="text-end">${remainingQuantity}</td>
                <td>
                    <input type="number" class="form-control form-control-sm batch-inbound-qty" value="${remainingQuantity}" min="0" max="${remainingQuantity}">
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', newRow);
    });

    const batchModal = new bootstrap.Modal(document.getElementById('batchInboundModal'));
    batchModal.show();
}

/**
 * Confirms the batch inbound action and calls the backend API.
 */
function confirmBatchInbound() {
    const rows = document.querySelectorAll('#batchInboundTableBody tr');
    const itemsToInbound = [];

    rows.forEach(row => {
        const quantityInput = row.querySelector('.batch-inbound-qty');
        const quantity = parseInt(quantityInput.value);

        if (quantity > 0) {
            itemsToInbound.push({
                registration_id: parseInt(row.dataset.itemId),
                quantity: quantity
            });
        }
    });

    if (itemsToInbound.length === 0) {
        alert('沒有要入庫的項目。請至少為一個項目輸入大於 0 的數量。');
        return;
    }

    fetch('/api/weekly_orders/batch_inbound', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: itemsToInbound }),
    })
    .then(response => response.json())
    .then(data => {
        let alertMessage = data.message;
        if (data.error_count > 0 && data.errors) {
            const errorDetails = data.errors.map(e => `  - ${e.item}: ${e.error}`).join('\n');
            alertMessage += `\n\n詳細錯誤:\n${errorDetails}`;
        }
        alert(alertMessage);

        if (data.success || data.success_count > 0) {
            location.reload();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('執行批量入庫時發生網路或伺服器錯誤。');
    });
}
