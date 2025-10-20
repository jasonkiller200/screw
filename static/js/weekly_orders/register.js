// 計算並顯示剩餘時間
function updateTimeRemaining() {
    const deadline = new Date('{{ current_cycle.deadline.isoformat() }}');
    const now = new Date();
    const diff = deadline - now;
    
    const timeRemainingEl = document.getElementById('timeRemaining');
    
    if (diff <= 0) {
        timeRemainingEl.innerHTML = '<span class="text-danger"><i class="fas fa-exclamation-triangle me-1"></i>申請已截止</span>';
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    timeRemainingEl.innerHTML = `
        <i class="fas fa-hourglass-half me-1"></i>
        剩餘時間：${days}天 ${hours}小時 ${minutes}分鐘
    `;
}

// 頁面載入時更新時間，並每分鐘更新一次
document.addEventListener('DOMContentLoaded', function() {
    updateTimeRemaining();
    setInterval(updateTimeRemaining, 60000); // 每分鐘更新
    
    // 設定預設需用日期為一週後
    const requiredDateInput = document.getElementById('required_date');
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    requiredDateInput.value = nextWeek.toISOString().split('T')[0];

    // 自動帶入品名、種類和單位
    const partNumberInput = document.getElementById('part_number');
    partNumberInput.addEventListener('blur', function() {
        const partNumber = this.value.trim();
        if (partNumber) {
            fetch(`/api/part/${partNumber}`)
                .then(response => response.json())
                .then(data => {
                    if (data.part_info) {
                        document.getElementById('part_name').value = data.part_info.name || '';
                        
                        const categorySelect = document.getElementById('category');
                        const category = data.part_info.type || '';
                        // Check if the category option already exists
                        let optionExists = false;
                        for (let i = 0; i < categorySelect.options.length; i++) {
                            if (categorySelect.options[i].value === category) {
                                optionExists = true;
                                break;
                            }
                        }
                        // If not, add it
                        if (!optionExists && category) {
                            const newOption = new Option(category, category, true, true);
                            categorySelect.add(newOption);
                        }
                        categorySelect.value = category;

                        document.getElementById('unit').value = data.part_info.unit || '';
                    }
                })
                .catch(error => console.error('Error fetching part details:', error));
        }
    });
});
