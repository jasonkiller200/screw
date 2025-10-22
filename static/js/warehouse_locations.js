document.addEventListener('DOMContentLoaded', function() {
    const body = document.body;
    const EDIT_WAREHOUSE_URL_TPL = body.dataset.editWarehouseUrlTpl;
    const DELETE_WAREHOUSE_URL_TPL = body.dataset.deleteWarehouseUrlTpl;
    const EDIT_LOCATION_URL_TPL = body.dataset.editLocationUrlTpl;
    const DELETE_LOCATION_URL_TPL = body.dataset.deleteLocationUrlTpl;

    // 綁定倉庫編輯按鈕事件
    document.querySelectorAll('.edit-warehouse-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.dataset.warehouseId;
            const name = this.dataset.warehouseName;
            const code = this.dataset.warehouseCode;
            const description = this.dataset.warehouseDescription;
            editWarehouse(id, name, code, description);
        });
    });

    // 綁定倉庫刪除按鈕事件
    document.querySelectorAll('.delete-warehouse-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.dataset.warehouseId;
            const name = this.dataset.warehouseName;
            const code = this.dataset.warehouseCode;
            deleteWarehouse(id, name, code);
        });
    });

    // 綁定倉位編輯按鈕事件
    document.querySelectorAll('.edit-location-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.dataset.locationId;
            const locationCode = this.dataset.locationCode;
            const description = this.dataset.locationDescription;
            editLocation(id, locationCode, description);
        });
    });

    // 綁定倉位刪除按鈕事件
    document.querySelectorAll('.delete-location-btn').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.dataset.locationId;
            const warehouseName = this.dataset.warehouseName;
            const locationCode = this.dataset.locationCode;
            deleteLocation(id, warehouseName, locationCode);
        });
    });

    function editWarehouse(id, name, code, description) {
        const form = document.getElementById('editWarehouseForm');
        if (form && EDIT_WAREHOUSE_URL_TPL) {
            form.action = EDIT_WAREHOUSE_URL_TPL.replace('0', id);
            document.getElementById('edit_warehouse_code').value = code;
            document.getElementById('edit_warehouse_name').value = name;
            document.getElementById('edit_warehouse_description').value = description;
            const modal = new bootstrap.Modal(document.getElementById('editWarehouseModal'));
            modal.show();
        }
    }

    function deleteWarehouse(id, name, code) {
        const form = document.getElementById('deleteWarehouseForm');
        if (form && DELETE_WAREHOUSE_URL_TPL) {
            form.action = DELETE_WAREHOUSE_URL_TPL.replace('0', id);
            document.getElementById('delete_wh_code').textContent = code;
            document.getElementById('delete_wh_name').textContent = name;
            const modal = new bootstrap.Modal(document.getElementById('deleteWarehouseModal'));
            modal.show();
        }
    }

    function editLocation(id, locationCode, description) {
        const form = document.getElementById('editLocationForm');
        if (form && EDIT_LOCATION_URL_TPL) {
            form.action = EDIT_LOCATION_URL_TPL.replace('0', id);
            document.getElementById('edit_location_code').value = locationCode;
            document.getElementById('edit_location_description').value = description || '';
            const modal = new bootstrap.Modal(document.getElementById('editLocationModal'));
            modal.show();
        }
    }

    function deleteLocation(id, warehouseName, locationCode) {
        const form = document.getElementById('deleteLocationForm');
        if (form && DELETE_LOCATION_URL_TPL) {
            form.action = DELETE_LOCATION_URL_TPL.replace('0', id);
            document.getElementById('delete_warehouse_name').textContent = warehouseName;
            document.getElementById('delete_location_code').textContent = locationCode;
            const modal = new bootstrap.Modal(document.getElementById('deleteLocationModal'));
            modal.show();
        }
    }
});
