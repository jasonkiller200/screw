function deletePart(partId, partNumber) {
    // 設定模態框內容
    document.getElementById('deletePartNumber').textContent = partNumber;
    document.getElementById('deleteForm').action = `/parts/${partId}/delete`;
    
    // 顯示模態框
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}
