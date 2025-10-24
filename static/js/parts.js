function deletePart(partId, partNumber) {
    // 設定模態框內容
    document.getElementById('deletePartNumber').textContent = partNumber;
    document.getElementById('deleteForm').action = `/parts/${partId}/delete`;
    
    // 顯示模態框
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

function exportParts() {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search') || '';
    const sort_by = params.get('sort_by') || 'part_number';
    const sort_order = params.get('sort_order') || 'asc';

    const exportUrl = `/api/parts/export?search=${encodeURIComponent(search)}&sort_by=${sort_by}&sort_order=${sort_order}`;
    
    // Use window.open to download the file, which is better than changing location.href
    window.open(exportUrl, '_blank');
}