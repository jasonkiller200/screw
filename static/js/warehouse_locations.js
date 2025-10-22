document.addEventListener('DOMContentLoaded', function() {
    const body = document.body;
    const EDIT_WAREHOUSE_URL_TPL = body.dataset.editWarehouseUrlTpl;
    const DELETE_WAREHOUSE_URL_TPL = body.dataset.deleteWarehouseUrlTpl;
    const EDIT_LOCATION_URL_TPL = body.dataset.editLocationUrlTpl;
    const DELETE_LOCATION_URL_TPL = body.dataset.deleteLocationUrlTpl;

    // Debug: 檢查URL模板是否正確加載
    console.log('URL Templates loaded:', {
        EDIT_WAREHOUSE_URL_TPL,
        DELETE_WAREHOUSE_URL_TPL,
        EDIT_LOCATION_URL_TPL,
        DELETE_LOCATION_URL_TPL
    });

    window.editWarehouse = function(id, name, code, description) {
        console.log('editWarehouse called:', { id, name, code, description });
        const form = document.getElementById('editWarehouseForm');
        console.log('Form found:', form);
        console.log('URL template:', EDIT_WAREHOUSE_URL_TPL);
        
        if (form && EDIT_WAREHOUSE_URL_TPL) {
            form.action = EDIT_WAREHOUSE_URL_TPL.replace('0', id);
            console.log('Form action set to:', form.action);
            
            document.getElementById('edit_warehouse_code').value = code;
            document.getElementById('edit_warehouse_name').value = name;
            document.getElementById('edit_warehouse_description').value = description;
            
            const modal = new bootstrap.Modal(document.getElementById('editWarehouseModal'));
            modal.show();
            console.log('Modal should be shown');
        } else {
            console.error('Form or URL template not found:', { form: !!form, url: !!EDIT_WAREHOUSE_URL_TPL });
        }
    };

    window.deleteWarehouse = function(id, name, code) {
        const form = document.getElementById('deleteWarehouseForm');
        if (form && DELETE_WAREHOUSE_URL_TPL) {
            form.action = DELETE_WAREHOUSE_URL_TPL.replace('0', id);
            document.getElementById('delete_wh_code').textContent = code;
            document.getElementById('delete_wh_name').textContent = name;
            new bootstrap.Modal(document.getElementById('deleteWarehouseModal')).show();
        }
    };

    window.editLocation = function(id, locationCode, description) {
        console.log('editLocation called:', { id, locationCode, description });
        const form = document.getElementById('editLocationForm');
        console.log('Form found:', form);
        console.log('URL template:', EDIT_LOCATION_URL_TPL);
        
        if (form && EDIT_LOCATION_URL_TPL) {
            form.action = EDIT_LOCATION_URL_TPL.replace('0', id);
            console.log('Form action set to:', form.action);
            
            document.getElementById('edit_location_code').value = locationCode;
            document.getElementById('edit_location_description').value = description || '';
            
            const modal = new bootstrap.Modal(document.getElementById('editLocationModal'));
            modal.show();
            console.log('Modal should be shown');
        } else {
            console.error('Form or URL template not found:', { form: !!form, url: !!EDIT_LOCATION_URL_TPL });
        }
    };

    window.deleteLocation = function(id, warehouseName, locationCode) {
        const form = document.getElementById('deleteLocationForm');
        if (form && DELETE_LOCATION_URL_TPL) {
            form.action = DELETE_LOCATION_URL_TPL.replace('0', id);
            document.getElementById('delete_warehouse_name').textContent = warehouseName;
            document.getElementById('delete_location_code').textContent = locationCode;
            new bootstrap.Modal(document.getElementById('deleteLocationModal')).show();
        }
    };
});
