function editWarehouse(id, name, code, description) {
    const form = document.getElementById('editWarehouseForm');
    if (form && typeof EDIT_WAREHOUSE_URL_TPL !== 'undefined') {
        form.action = EDIT_WAREHOUSE_URL_TPL.replace('0', id);
        document.getElementById('edit_warehouse_code').value = code;
        document.getElementById('edit_warehouse_name').value = name;
        document.getElementById('edit_warehouse_description').value = description;
        new bootstrap.Modal(document.getElementById('editWarehouseModal')).show();
    }
}

function deleteWarehouse(id, name, code) {
    const form = document.getElementById('deleteWarehouseForm');
    if (form && typeof DELETE_WAREHOUSE_URL_TPL !== 'undefined') {
        form.action = DELETE_WAREHOUSE_URL_TPL.replace('0', id);
        document.getElementById('delete_wh_code').textContent = code;
        document.getElementById('delete_wh_name').textContent = name;
        new bootstrap.Modal(document.getElementById('deleteWarehouseModal')).show();
    }
}

function editLocation(id, locationCode, description) {
    const form = document.getElementById('editLocationForm');
    if (form && typeof EDIT_LOCATION_URL_TPL !== 'undefined') {
        form.action = EDIT_LOCATION_URL_TPL.replace('0', id);
        document.getElementById('edit_location_code').value = locationCode;
        document.getElementById('edit_location_description').value = description;
        new bootstrap.Modal(document.getElementById('editLocationModal')).show();
    }
}

function deleteLocation(id, warehouseName, locationCode) {
    const form = document.getElementById('deleteLocationForm');
    if (form && typeof DELETE_LOCATION_URL_TPL !== 'undefined') {
        form.action = DELETE_LOCATION_URL_TPL.replace('0', id);
        document.getElementById('delete_warehouse_name').textContent = warehouseName;
        document.getElementById('delete_location_code').textContent = locationCode;
        new bootstrap.Modal(document.getElementById('deleteLocationModal')).show();
    }
}
