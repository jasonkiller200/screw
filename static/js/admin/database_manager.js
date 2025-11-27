/**
 * 資料庫管理系統 - 前端邏輯
 * 第三階段：編輯功能實作
 */

class DatabaseManager {
    constructor() {
        this.init();
        this.currentEditRow = null;
        this.originalData = {};
        this.unsavedChanges = false;
    }

    init() {
        this.initializeEventListeners();
        this.setupBeforeUnloadWarning();
        this.initializeTooltips();
    }

    /**
     * 初始化事件監聽器
     */
    initializeEventListeners() {
        // 編輯按鈕
        $(document).on('click', '.edit-btn', (e) => {
            this.enterEditMode(e.target.closest('tr'));
        });

        // 儲存按鈕
        $(document).on('click', '.save-btn', (e) => {
            this.saveRecord(e.target.closest('tr'));
        });

        // 取消按鈕
        $(document).on('click', '.cancel-btn', (e) => {
            this.cancelEdit(e.target.closest('tr'));
        });

        // 刪除按鈕
        $(document).on('click', '.delete-btn', (e) => {
            this.confirmDelete(e.target.closest('tr'));
        });

        // 批量選擇
        $(document).on('change', '.select-all', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        $(document).on('change', '.row-select', () => {
            this.updateBatchButtons();
        });

        // 批量操作按鈕
        $('#batch-edit-btn').on('click', () => {
            this.batchEdit();
        });

        $('#batch-delete-btn').on('click', () => {
            this.batchDelete();
        });

        // 輸入變更監聽
        $(document).on('input', '.editable-input', () => {
            this.markUnsavedChanges(true);
        });

        // 鍵盤快捷鍵
        $(document).on('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    /**
     * 進入編輯模式
     */
    enterEditMode(row) {
        if (this.currentEditRow && this.currentEditRow !== row) {
            this.cancelEdit(this.currentEditRow);
        }

        this.currentEditRow = row;
        const $row = $(row);
        
        // 備份原始資料
        this.backupRowData($row);
        
        // 轉換為編輯模式
        $row.find('td[data-field]').each((index, cell) => {
            this.convertToEditableCell($(cell));
        });

        // 更新按鈕狀態
        $row.find('.edit-btn').hide();
        $row.find('.save-btn, .cancel-btn').show();
        $row.addClass('editing-row');

        // 聚焦第一個可編輯欄位
        $row.find('.editable-input').first().focus();

        this.showNotification('編輯模式已啟用', 'info');
    }

    /**
     * 轉換儲存格為可編輯狀態
     */
    convertToEditableCell($cell) {
        const fieldName = $cell.data('field');
        const fieldType = $cell.data('type') || 'text';
        const currentValue = $cell.text().trim();
        const isProtected = $cell.hasClass('protected-field');

        if (isProtected) {
            $cell.html(`<span class="text-muted"><i class="fas fa-lock me-1"></i>受保護</span>`);
            return;
        }

        let inputHtml = '';
        
        switch (fieldType) {
            case 'boolean':
                const isTrue = ['true', '是', '1', 'True'].includes(currentValue);
                inputHtml = `
                    <select class="form-select form-select-sm editable-input" data-field="${fieldName}">
                        <option value="true" ${isTrue ? 'selected' : ''}>是</option>
                        <option value="false" ${!isTrue ? 'selected' : ''}>否</option>
                    </select>
                `;
                break;
            
            case 'number':
                inputHtml = `
                    <input type="number" 
                           class="form-control form-control-sm editable-input" 
                           data-field="${fieldName}"
                           value="${currentValue}"
                           step="any">
                `;
                break;
            
            case 'date':
            case 'datetime':
                const dateValue = this.formatDateForInput(currentValue);
                inputHtml = `
                    <input type="${fieldType === 'datetime' ? 'datetime-local' : 'date'}" 
                           class="form-control form-control-sm editable-input" 
                           data-field="${fieldName}"
                           value="${dateValue}">
                `;
                break;
            
            case 'text':
            default:
                if (currentValue.length > 50) {
                    inputHtml = `
                        <textarea class="form-control form-control-sm editable-input" 
                                  data-field="${fieldName}"
                                  rows="2">${currentValue}</textarea>
                    `;
                } else {
                    inputHtml = `
                        <input type="text" 
                               class="form-control form-control-sm editable-input" 
                               data-field="${fieldName}"
                               value="${currentValue}">
                    `;
                }
                break;
        }

        $cell.html(inputHtml);
    }

    /**
     * 儲存記錄
     */
    async saveRecord(row) {
        const $row = $(row);
        const recordId = $row.data('record-id');
        const tableName = $('#table-info').data('table-name');
        
        // 收集表單資料
        const formData = this.collectFormData($row);
        
        // 驗證資料
        const validation = this.validateData(formData, $row);
        if (!validation.isValid) {
            this.showNotification(validation.message, 'danger');
            return;
        }

        // 顯示載入狀態
        this.showSaveLoading($row, true);

        try {
            const response = await fetch(`/admin/update_record/${tableName}/${recordId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.exitEditMode($row, result.data);
                this.showNotification('資料已成功更新', 'success');
                this.markUnsavedChanges(false);
            } else {
                this.showNotification(`更新失敗: ${result.message}`, 'danger');
            }
        } catch (error) {
            console.error('保存錯誤:', error);
            this.showNotification('保存時發生錯誤', 'danger');
        } finally {
            this.showSaveLoading($row, false);
        }
    }

    /**
     * 取消編輯
     */
    cancelEdit(row) {
        const $row = $(row);
        
        if (this.unsavedChanges) {
            if (!confirm('您有未儲存的變更，確定要取消嗎？')) {
                return;
            }
        }

        this.restoreRowData($row);
        this.exitEditMode($row);
        this.markUnsavedChanges(false);
        this.showNotification('已取消編輯', 'info');
    }

    /**
     * 退出編輯模式
     */
    exitEditMode($row, newData = null) {
        if (newData) {
            // 更新顯示資料
            $row.find('td[data-field]').each((index, cell) => {
                const $cell = $(cell);
                const fieldName = $cell.data('field');
                if (newData[fieldName] !== undefined) {
                    $cell.text(this.formatDisplayValue(newData[fieldName], $cell.data('type')));
                }
            });
        }

        // 恢復按鈕狀態
        $row.find('.save-btn, .cancel-btn').hide();
        $row.find('.edit-btn').show();
        $row.removeClass('editing-row');
        
        this.currentEditRow = null;
    }

    /**
     * 確認刪除
     */
    confirmDelete(row) {
        const $row = $(row);
        const recordId = $row.data('record-id');
        const tableName = $('#table-info').data('table-name');
        
        // 建立確認對話框
        const modal = this.createDeleteConfirmModal($row);
        modal.modal('show');
        
        modal.find('.confirm-delete').off('click').on('click', async () => {
            modal.modal('hide');
            await this.deleteRecord(tableName, recordId, $row);
        });
    }

    /**
     * 刪除記錄
     */
    async deleteRecord(tableName, recordId, $row) {
        this.showDeleteLoading($row, true);

        try {
            const response = await fetch(`/admin/delete_record/${tableName}/${recordId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const result = await response.json();

            if (result.success) {
                $row.fadeOut(300, () => {
                    $row.remove();
                    this.updateRecordCount(-1);
                });
                this.showNotification('記錄已成功刪除', 'success');
            } else {
                this.showNotification(`刪除失敗: ${result.message}`, 'danger');
            }
        } catch (error) {
            console.error('刪除錯誤:', error);
            this.showNotification('刪除時發生錯誤', 'danger');
        } finally {
            this.showDeleteLoading($row, false);
        }
    }

    /**
     * 批量編輯
     */
    batchEdit() {
        const selectedRows = $('.row-select:checked').closest('tr');
        if (selectedRows.length === 0) {
            this.showNotification('請選擇要編輯的記錄', 'warning');
            return;
        }

        // 建立批量編輯模態框
        const modal = this.createBatchEditModal();
        modal.modal('show');
    }

    /**
     * 批量刪除
     */
    batchDelete() {
        const selectedRows = $('.row-select:checked').closest('tr');
        if (selectedRows.length === 0) {
            this.showNotification('請選擇要刪除的記錄', 'warning');
            return;
        }

        // 建立批量刪除確認對話框
        const modal = this.createBatchDeleteModal(selectedRows.length);
        modal.modal('show');
    }

    /**
     * 切換全選狀態
     */
    toggleSelectAll(isChecked) {
        $('.row-select').prop('checked', isChecked);
        this.updateBatchButtons();
        this.updateSelectedRowsVisual();
    }

    /**
     * 更新批量操作按鈕狀態
     */
    updateBatchButtons() {
        const selectedCount = $('.row-select:checked').length;
        const totalRows = $('.row-select').length;
        
        // 更新選擇計數
        $('#selected-count').text(selectedCount);
        
        // 顯示/隱藏批量操作區域
        $('.batch-actions').toggle(selectedCount > 0);
        
        // 更新全選按鈕狀態
        const $selectAll = $('.select-all');
        if (selectedCount === 0) {
            $selectAll.prop('indeterminate', false).prop('checked', false);
        } else if (selectedCount === totalRows) {
            $selectAll.prop('indeterminate', false).prop('checked', true);
        } else {
            $selectAll.prop('indeterminate', true).prop('checked', false);
        }
    }

    /**
     * 更新選中行的視覺效果
     */
    updateSelectedRowsVisual() {
        $('.row-select').each(function() {
            const $row = $(this).closest('tr');
            if ($(this).is(':checked')) {
                $row.addClass('selected-row');
            } else {
                $row.removeClass('selected-row');
            }
        });
    }

    /**
     * 收集表單資料
     */
    collectFormData($row) {
        const formData = {};
        
        $row.find('.editable-input').each((index, input) => {
            const $input = $(input);
            const fieldName = $input.data('field');
            let value = $input.val();
            
            // 類型轉換
            if ($input.attr('type') === 'number') {
                value = parseFloat(value) || 0;
            } else if ($input.is('select')) {
                value = value === 'true';
            }
            
            formData[fieldName] = value;
        });

        return formData;
    }

    /**
     * 資料驗證
     */
    validateData(formData, $row) {
        const errors = [];

        // 必填欄位檢查
        $row.find('.editable-input[required]').each((index, input) => {
            const $input = $(input);
            const fieldName = $input.data('field');
            const value = formData[fieldName];
            
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                errors.push(`${fieldName} 為必填欄位`);
            }
        });

        // 數字格式檢查
        Object.keys(formData).forEach(key => {
            const $input = $row.find(`[data-field="${key}"]`);
            if ($input.attr('type') === 'number') {
                const value = formData[key];
                if (isNaN(value)) {
                    errors.push(`${key} 必須是有效的數字`);
                }
            }
        });

        return {
            isValid: errors.length === 0,
            message: errors.join(', ')
        };
    }

    /**
     * 建立刪除確認模態框
     */
    createDeleteConfirmModal($row) {
        const recordInfo = this.getRecordDisplayInfo($row);
        
        return $(`
            <div class="modal fade" id="deleteConfirmModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>確認刪除
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-3">您確定要刪除這筆記錄嗎？</p>
                            <div class="alert alert-warning">
                                <strong>記錄資訊：</strong><br>
                                ${recordInfo}
                            </div>
                            <p class="text-danger mb-0">
                                <i class="fas fa-warning me-1"></i>
                                此操作無法復原！
                            </p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-danger confirm-delete">
                                <i class="fas fa-trash me-1"></i>確認刪除
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');
    }

    /**
     * 備份行資料
     */
    backupRowData($row) {
        const rowId = $row.data('record-id');
        this.originalData[rowId] = {};
        
        $row.find('td[data-field]').each((index, cell) => {
            const $cell = $(cell);
            const fieldName = $cell.data('field');
            this.originalData[rowId][fieldName] = $cell.text().trim();
        });
    }

    /**
     * 恢復行資料
     */
    restoreRowData($row) {
        const rowId = $row.data('record-id');
        const originalData = this.originalData[rowId];
        
        if (originalData) {
            $row.find('td[data-field]').each((index, cell) => {
                const $cell = $(cell);
                const fieldName = $cell.data('field');
                if (originalData[fieldName] !== undefined) {
                    $cell.text(originalData[fieldName]);
                }
            });
        }
    }

    /**
     * 處理鍵盤快捷鍵
     */
    handleKeyboardShortcuts(e) {
        // ESC 鍵取消編輯
        if (e.keyCode === 27 && this.currentEditRow) {
            this.cancelEdit(this.currentEditRow);
        }
        
        // Ctrl+S 儲存
        if (e.ctrlKey && e.keyCode === 83 && this.currentEditRow) {
            e.preventDefault();
            this.saveRecord(this.currentEditRow);
        }
        
        // Enter 鍵儲存（在編輯模式下）
        if (e.keyCode === 13 && this.currentEditRow && !e.shiftKey) {
            const $target = $(e.target);
            if (!$target.is('textarea')) {
                e.preventDefault();
                this.saveRecord(this.currentEditRow);
            }
        }
    }

    /**
     * 獲取記錄顯示資訊
     */
    getRecordDisplayInfo($row) {
        const displayFields = [];
        $row.find('td[data-field]').slice(0, 3).each((index, cell) => {
            const $cell = $(cell);
            const fieldName = $cell.data('field');
            const value = $cell.text().trim();
            if (value && value !== '-' && value !== 'NULL') {
                displayFields.push(`${fieldName}: ${value}`);
            }
        });
        return displayFields.join('<br>') || '記錄資訊';
    }

    /**
     * 顯示儲存載入狀態
     */
    showSaveLoading($row, isLoading) {
        const $saveBtn = $row.find('.save-btn');
        const $cancelBtn = $row.find('.cancel-btn');
        
        if (isLoading) {
            $saveBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
            $cancelBtn.prop('disabled', true);
        } else {
            $saveBtn.prop('disabled', false).html('<i class="fas fa-save"></i>');
            $cancelBtn.prop('disabled', false);
        }
    }

    /**
     * 顯示刪除載入狀態
     */
    showDeleteLoading($row, isLoading) {
        const $deleteBtn = $row.find('.delete-btn');
        
        if (isLoading) {
            $deleteBtn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i>');
        } else {
            $deleteBtn.prop('disabled', false).html('<i class="fas fa-trash"></i>');
        }
    }

    /**
     * 更新記錄數量
     */
    updateRecordCount(delta) {
        const $countElements = $('.count-badge, .total-records');
        $countElements.each((index, element) => {
            const $element = $(element);
            const currentCount = parseInt($element.text().replace(/,/g, '')) || 0;
            const newCount = Math.max(0, currentCount + delta);
            $element.text(newCount.toLocaleString());
        });
    }

    /**
     * 創建批量編輯模態框
     */
    createBatchEditModal() {
        const selectedRows = $('.row-select:checked').closest('tr');
        const tableName = $('#table-info').data('table-name');
        
        // 獲取可編輯的欄位
        const editableFields = [];
        if (selectedRows.length > 0) {
            selectedRows.first().find('td[data-field]:not(.protected-field)').each((index, cell) => {
                const $cell = $(cell);
                const fieldName = $cell.data('field');
                const fieldType = $cell.data('type') || 'text';
                editableFields.push({ name: fieldName, type: fieldType });
            });
        }
        
        let fieldsHtml = '';
        editableFields.forEach(field => {
            fieldsHtml += `
                <div class="mb-3">
                    <label class="form-label">
                        <input type="checkbox" class="form-check-input field-checkbox me-2" 
                               data-field="${field.name}">
                        ${field.name}
                    </label>
                    <input type="text" class="form-control batch-field-input" 
                           data-field="${field.name}" placeholder="新值">
                </div>
            `;
        });
        
        const modal = $(`
            <div class="modal fade" id="batchEditModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-edit me-2"></i>批量編輯
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body batch-edit-modal">
                            <p class="mb-3">已選擇 <strong>${selectedRows.length}</strong> 筆記錄進行批量編輯</p>
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-1"></i>
                                請選擇要更新的欄位並輸入新值
                            </div>
                            ${fieldsHtml}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-warning confirm-batch-edit">
                                <i class="fas fa-save me-1"></i>確認更新
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');
        
        // 綁定批量編輯確認事件
        modal.find('.confirm-batch-edit').on('click', async () => {
            const updateData = {};
            modal.find('.field-checkbox:checked').each((index, checkbox) => {
                const fieldName = $(checkbox).data('field');
                const value = modal.find(`[data-field="${fieldName}"].batch-field-input`).val();
                if (value.trim()) {
                    updateData[fieldName] = value.trim();
                }
            });
            
            if (Object.keys(updateData).length === 0) {
                this.showNotification('請選擇要更新的欄位並輸入值', 'warning');
                return;
            }
            
            const recordIds = [];
            selectedRows.each((index, row) => {
                recordIds.push($(row).data('record-id'));
            });
            
            try {
                const response = await fetch(`/admin/batch_update/${tableName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({
                        record_ids: recordIds,
                        update_data: updateData
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    modal.modal('hide');
                    this.showNotification(result.message, 'success');
                    // 刷新頁面以顯示更新
                    setTimeout(() => location.reload(), 1000);
                } else {
                    this.showNotification(result.message, 'danger');
                }
            } catch (error) {
                console.error('批量編輯錯誤:', error);
                this.showNotification('批量編輯時發生錯誤', 'danger');
            }
        });
        
        return modal;
    }

    /**
     * 創建批量刪除模態框
     */
    createBatchDeleteModal(count) {
        const selectedRows = $('.row-select:checked').closest('tr');
        const tableName = $('#table-info').data('table-name');
        
        const modal = $(`
            <div class="modal fade" id="batchDeleteModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header bg-danger text-white">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>批量刪除確認
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-3">您確定要刪除這 <strong>${count}</strong> 筆記錄嗎？</p>
                            <div class="alert alert-danger">
                                <strong>⚠️ 警告：</strong><br>
                                此操作將永久刪除選中的記錄，且無法復原！
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-danger confirm-batch-delete">
                                <i class="fas fa-trash me-1"></i>確認刪除
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).appendTo('body');
        
        // 綁定批量刪除確認事件
        modal.find('.confirm-batch-delete').on('click', async () => {
            const recordIds = [];
            selectedRows.each((index, row) => {
                recordIds.push($(row).data('record-id'));
            });
            
            try {
                const response = await fetch(`/admin/batch_delete/${tableName}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify({
                        record_ids: recordIds
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    modal.modal('hide');
                    selectedRows.fadeOut(300, () => {
                        selectedRows.remove();
                        this.updateRecordCount(-recordIds.length);
                    });
                    this.showNotification(result.message, 'success');
                    $('.row-select, .select-all').prop('checked', false);
                    $('.batch-actions').hide();
                } else {
                    this.showNotification(result.message, 'danger');
                }
            } catch (error) {
                console.error('批量刪除錯誤:', error);
                this.showNotification('批量刪除時發生錯誤', 'danger');
            }
        });
        
        return modal;
    }

    /**
     * 工具函數
     */
    getCSRFToken() {
        return $('meta[name=csrf-token]').attr('content') || '';
    }

    formatDateForInput(dateStr) {
        if (!dateStr || dateStr === '-') return '';
        try {
            const date = new Date(dateStr);
            return date.toISOString().slice(0, 16);
        } catch {
            return '';
        }
    }

    formatDisplayValue(value, type) {
        if (value === null || value === undefined) return '-';
        
        switch (type) {
            case 'boolean':
                return value ? '是' : '否';
            case 'date':
                return new Date(value).toLocaleDateString('zh-TW');
            case 'datetime':
                return new Date(value).toLocaleString('zh-TW');
            default:
                return value.toString();
        }
    }

    showNotification(message, type = 'info') {
        const alertClass = `alert-${type}`;
        const iconMap = {
            'success': 'check-circle',
            'danger': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        const notification = $(`
            <div class="alert ${alertClass} alert-dismissible fade show notification-toast" role="alert">
                <i class="fas fa-${iconMap[type]} me-2"></i>${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `);
        
        $('#notifications-container').append(notification);
        
        setTimeout(() => {
            notification.fadeOut();
        }, 5000);
    }

    markUnsavedChanges(hasChanges) {
        this.unsavedChanges = hasChanges;
        $('.unsaved-indicator').toggle(hasChanges);
    }

    setupBeforeUnloadWarning() {
        $(window).on('beforeunload', () => {
            if (this.unsavedChanges) {
                return '您有未儲存的變更，確定要離開嗎？';
            }
        });
    }

    initializeTooltips() {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }

    // 更多輔助方法...
}

// 初始化
$(document).ready(function() {
    // 確保 jQuery 已載入
    if (typeof $ === 'undefined') {
        console.error('jQuery 未載入，無法初始化資料庫管理器');
        return;
    }
    
    // 初始化資料庫管理器
    window.dbManager = new DatabaseManager();
    console.log('資料庫管理器已初始化');
});