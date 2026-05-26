let idleInventoryData = null;
let filteredIdleInventoryItems = [];
let currentSort = {
    key: 'idle_days',
    direction: 'desc',
};

document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const searchInput = document.getElementById('searchInput');
    const bucketFilter = document.getElementById('bucketFilter');
    const warehouseFilter = document.getElementById('warehouseFilter');
    const sortableHeaders = document.querySelectorAll('[data-sort-key]');

    refreshBtn?.addEventListener('click', loadIdleInventoryReport);
    exportBtn?.addEventListener('click', () => {
        window.location.href = '/reports/idle-inventory/export';
    });
    searchInput?.addEventListener('input', applyFilters);
    bucketFilter?.addEventListener('change', applyFilters);
    warehouseFilter?.addEventListener('change', applyFilters);
    sortableHeaders.forEach((header) => {
        header.addEventListener('click', () => handleSort(header.dataset.sortKey));
    });

    updateSortIndicators();

    loadIdleInventoryReport();
});

function loadIdleInventoryReport() {
    document.getElementById('loadingDiv').style.display = 'block';
    document.getElementById('errorDiv').style.display = 'none';
    document.getElementById('summaryDiv').style.display = 'none';
    document.getElementById('resultsDiv').style.display = 'none';

    fetch('/reports/idle-inventory/data')
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            document.getElementById('loadingDiv').style.display = 'none';
            if (!data.success) {
                showError(data.error || '載入失敗');
                return;
            }

            idleInventoryData = data;
            populateSummary(data.summary);
            populateWarehouseFilter(data.filters?.warehouses || []);
            applyFilters();

            document.getElementById('summaryDiv').style.display = 'block';
            document.getElementById('resultsDiv').style.display = 'block';
        })
        .catch((error) => {
            document.getElementById('loadingDiv').style.display = 'none';
            showError(`載入閒置庫存報表失敗: ${error.message}`);
        });
}

function populateSummary(summary) {
    document.getElementById('totalLocationsCount').textContent = formatNumber(summary.total_locations || 0);
    document.getElementById('totalPartNumbersCount').textContent = formatNumber(summary.total_part_numbers || 0);
    document.getElementById('totalQuantityCount').textContent = formatNumber(summary.total_quantity || 0);
    document.getElementById('idleOver30Count').textContent = formatNumber(summary.idle_over_30_count || 0);
    document.getElementById('idleOver90Count').textContent = formatNumber(summary.idle_over_90_count || 0);
    document.getElementById('idleOver180Count').textContent = formatNumber(summary.idle_over_180_count || 0);
    document.getElementById('noConsumptionHistoryCount').textContent = formatNumber(summary.no_consumption_history_count || 0);
}

function populateWarehouseFilter(warehouses) {
    const warehouseFilter = document.getElementById('warehouseFilter');
    const currentValue = warehouseFilter.value;
    warehouseFilter.innerHTML = '<option value="all">全部倉庫</option>';

    warehouses.forEach((warehouse) => {
        const option = document.createElement('option');
        option.value = String(warehouse.id);
        option.textContent = `${warehouse.name} (${warehouse.code})`;
        warehouseFilter.appendChild(option);
    });

    warehouseFilter.value = Array.from(warehouseFilter.options).some((option) => option.value === currentValue)
        ? currentValue
        : 'all';
}

function applyFilters() {
    if (!idleInventoryData) {
        return;
    }

    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const bucket = document.getElementById('bucketFilter').value;
    const warehouseId = document.getElementById('warehouseFilter').value;

    filteredIdleInventoryItems = idleInventoryData.items.filter((item) => {
        const matchBucket = bucket === 'all' || item.idle_bucket === bucket;
        const matchWarehouse = warehouseId === 'all' || String(item.warehouse_id) === warehouseId;
        const searchText = [
            item.part_number,
            item.part_name,
            item.part_type,
            item.warehouse_name,
            item.warehouse_code,
            item.location_code,
        ].join(' ').toLowerCase();
        const matchSearch = searchTerm === '' || searchText.includes(searchTerm);
        return matchBucket && matchWarehouse && matchSearch;
    });

    filteredIdleInventoryItems = sortItems(filteredIdleInventoryItems, currentSort);

    renderTable(filteredIdleInventoryItems);
    document.getElementById('resultCount').textContent = formatNumber(filteredIdleInventoryItems.length);
}

function handleSort(sortKey) {
    if (!sortKey) {
        return;
    }

    if (currentSort.key === sortKey) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort = {
            key: sortKey,
            direction: getDefaultSortDirection(sortKey),
        };
    }

    updateSortIndicators();
    applyFilters();
}

function getDefaultSortDirection(sortKey) {
    if (['quantity_on_hand', 'available_quantity', 'reserved_quantity', 'idle_days', 'last_consumption_date'].includes(sortKey)) {
        return 'desc';
    }

    return 'asc';
}

function sortItems(items, sortConfig) {
    const bucketOrder = {
        no_consumption_history: 4,
        obsolete: 3,
        stagnant: 2,
        aging: 1,
        normal: 0,
    };

    return [...items].sort((left, right) => {
        const leftValue = getSortValue(left, sortConfig.key, bucketOrder);
        const rightValue = getSortValue(right, sortConfig.key, bucketOrder);

        let comparison = 0;

        if (leftValue === rightValue) {
            comparison = String(left.part_number || '').localeCompare(String(right.part_number || ''), 'zh-Hant', { numeric: true, sensitivity: 'base' });
        } else if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            comparison = leftValue - rightValue;
        } else {
            comparison = String(leftValue).localeCompare(String(rightValue), 'zh-Hant', { numeric: true, sensitivity: 'base' });
        }

        return sortConfig.direction === 'asc' ? comparison : comparison * -1;
    });
}

function getSortValue(item, sortKey, bucketOrder) {
    if (sortKey === 'idle_bucket') {
        return bucketOrder[item.idle_bucket] ?? -1;
    }

    if (sortKey === 'last_consumption_date') {
        return item.last_consumption_date ? new Date(item.last_consumption_date).getTime() : -1;
    }

    if (['quantity_on_hand', 'available_quantity', 'reserved_quantity', 'idle_days'].includes(sortKey)) {
        return Number(item[sortKey] || 0);
    }

    return item[sortKey] || '';
}

function updateSortIndicators() {
    document.querySelectorAll('[data-sort-key]').forEach((header) => {
        const indicator = header.querySelector('.sort-indicator');
        const isActive = header.dataset.sortKey === currentSort.key;

        header.classList.toggle('active', isActive);
        header.setAttribute('aria-sort', isActive ? (currentSort.direction === 'asc' ? 'ascending' : 'descending') : 'none');

        if (indicator) {
            indicator.textContent = isActive ? (currentSort.direction === 'asc' ? '▲' : '▼') : '↕';
        }
    });
}

function renderTable(items) {
    const tbody = document.getElementById('idleInventoryTableBody');

    if (!items.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center text-muted py-4">目前沒有符合條件的閒置庫存資料</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map((item) => {
        const idleDisplay = formatIdleDisplay(item);
        const locationId = Number.isFinite(Number(item.warehouse_location_id)) ? Number(item.warehouse_location_id) : 'null';
        return `
            <tr>
                <td>
                    <button
                        type="button"
                        class="btn btn-link btn-sm p-0 fw-bold text-decoration-none align-baseline"
                        onclick="openConsumptionAnalysisDirect('${escapeJs(item.part_number)}', ${locationId})"
                        title="點擊查看零件詳情"
                    >${escapeHtml(item.part_number)}</button>
                </td>
                <td>${escapeHtml(item.part_name || '')}</td>
                <td>${escapeHtml(item.part_type || '')}</td>
                <td>${escapeHtml(item.warehouse_name)} <span class="text-muted">(${escapeHtml(item.warehouse_code)})</span></td>
                <td>${escapeHtml(item.location_code)}</td>
                <td class="text-end">${formatNumber(item.quantity_on_hand)}</td>
                <td class="text-end">${formatNumber(item.available_quantity)}</td>
                <td class="text-end">${formatNumber(item.reserved_quantity)}</td>
                <td>${idleDisplay.lastConsumptionLabel}</td>
                <td class="text-center">${idleDisplay.idleDaysLabel}</td>
                <td class="text-center"><span class="badge ${idleDisplay.badgeClass}">${idleDisplay.bucketLabel}</span></td>
            </tr>
        `;
    }).join('');
}

function formatIdleDisplay(item) {
    if (!item.last_consumption_date) {
        return {
            lastConsumptionLabel: '上線後未領料',
            idleDaysLabel: '上線後未領料',
            bucketLabel: '上線後未領料',
            badgeClass: 'bg-secondary',
        };
    }

    if (item.idle_bucket === 'obsolete') {
        return {
            lastConsumptionLabel: formatDate(item.last_consumption_date),
            idleDaysLabel: `${item.idle_days} 天`,
            bucketLabel: '180+ 天',
            badgeClass: 'bg-danger',
        };
    }

    if (item.idle_bucket === 'stagnant') {
        return {
            lastConsumptionLabel: formatDate(item.last_consumption_date),
            idleDaysLabel: `${item.idle_days} 天`,
            bucketLabel: '90-179 天',
            badgeClass: 'bg-warning text-dark',
        };
    }

    if (item.idle_bucket === 'aging') {
        return {
            lastConsumptionLabel: formatDate(item.last_consumption_date),
            idleDaysLabel: `${item.idle_days} 天`,
            bucketLabel: '30-89 天',
            badgeClass: 'bg-info text-dark',
        };
    }

    return {
        lastConsumptionLabel: formatDate(item.last_consumption_date),
        idleDaysLabel: `${item.idle_days} 天`,
        bucketLabel: '30 天內',
        badgeClass: 'bg-success',
    };
}

function showError(message) {
    document.getElementById('errorMessage').textContent = message;
    document.getElementById('errorDiv').style.display = 'block';
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString('zh-TW');
}

function formatDate(value) {
    return new Date(value).toLocaleDateString('zh-TW');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJs(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
}