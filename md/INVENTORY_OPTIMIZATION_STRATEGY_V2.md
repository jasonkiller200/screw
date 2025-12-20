# 智慧採購優化策略建議報告 (V2)

## 1. 總結 (Executive Summary)

**背景：**
經過討論，確認系統目前無法獲取精確的「單位成本」與「訂購成本」，這使得傳統的 EOQ (經濟訂購批量) 模型無法直接應用。

**核心問題：**
現有的採購建議模型僅基於「前置時間消耗」進行補貨，可能導致採購頻率不合理，且未考慮供應商的最小訂購量 (MOQ)，缺乏彈性與實用性。

**核心建議：**
採納使用者中心的 **「預計存貨天數 (Desired Days of Stock, DDS)」** 模型。此策略將採購決策的核心從「成本最小化」轉向「**庫存水平管理**」，讓使用者可以直接定義期望的庫存持有天數，由系統自動計算補貨量，以達到該目標。

**預期效益：**
- **直觀易用：** 使用者無需理解複雜的成本概念，只需設定期望的庫存天數即可。
- **高度靈活：** 可為不同重要性的零件設定不同的庫存策略（例如，關鍵零件保持60天庫存，非關鍵零件保持20天）。
- **採購頻率合理化：** 透過設定合理的存貨天數，自然地將採購整合成更規律的批次。
- **滿足供應商要求：** 系統會自動將計算出的採購量與 MOQ 比較，確保建議的可行性。
- **數據驅動：** 整個流程基於歷史消耗數據和使用者策略，科學且可靠。

---

## 2. 新策略詳解：基於「預計存貨天數」的模型

此模型的核心是讓使用者為每個零件設定一個期望的庫存水平，這個水平由「天數」來定義。系統的任務是在需要補貨時，計算出能將庫存恢復到這個期望水平所需的數量。

### 2.1 關鍵參數

- **預計存貨天數 (Desired Days of Stock, DDS) (使用者設定):**
  - 使用者為每個零件定義的策略參數。例如，設定為 30 天，意味著「我希望在每次補貨後，現有庫存足夠支撐未來 30 天的平均消耗」。
  - 這是新策略的核心輸入。

- **最小訂購量 (MOQ) (使用者設定):**
  - 供應商要求的單次最小採購數量。

- **平均日消耗量 (系統計算):**
  - 系統已有的 `get_consumption_analysis()` 方法可以提供此數據。

- **當前可用庫存 (系統數據):**
  - `available_quantity`。

- **安全庫存 (系統/使用者設定):**
  - `safety_stock`，作為應對需求波動的額外緩衝。

### 2.2 核心計算邏輯

**步驟 1: 計算目標最大庫存水平 (Target Stock Level, M)**
這個水平是我們期望在補貨後達到的理想庫存量。
```
M = (平均日消耗量 * 預計存貨天數 DDS) + 安全庫存
```

**步驟 2: 計算建議訂購量 (Suggested Quantity, Q)**
這是填補「目標水平」與「當前庫存」之間差距所需的數量。
```
Q = M - 當前可用庫存
```

**步驟 3: 結合 MOQ 得出最終建議**
如果計算出的 `Q` 小於供應商的 `MOQ`，我們需要調整為 `MOQ` 以滿足供應商要求。
```python
triggered_quantity = 0
if Q > 0:
    if Q < MOQ:
        triggered_quantity = MOQ  # 訂購量最少要滿足 MOQ
    else:
        triggered_quantity = Q
```

---

## 3. 實施計劃 (Phased Approach)

### **階段一：數據庫與前端擴展**

1.  **修改 `Part` 模型 (`models/part.py`):**
    在 `Part` class 中新增以下欄位：
    ```python
    desired_days_of_stock = db.Column(db.Integer, default=30, nullable=False, comment='預計存貨天數 (DDS)')
    moq = db.Column(db.Integer, default=1, nullable=False, comment='最小訂購量 (MOQ)')
    ```

2.  **數據庫遷移：**
    - 運行 `flask db revision --autogenerate -m "add_dds_and_moq_to_part"` 產生遷移腳本。
    - 檢查遷移腳本，為現有數據提供合理的默認值。
    - 運行 `flask db upgrade` 將變更應用到數據庫。

3.  **修改零件管理前端 (`templates/part_form.html`):**
    - 在「新增/編輯零件」表單中，加入 **「預計存貨天數」** 和 **「最小訂購量 (MOQ)」** 的數字輸入框。
    - **提示文字：**
        - **預計存貨天數：** "建議值 30-60 天。此數值將決定補貨後庫存的目標水平。"
        - **最小訂購量：** "供應商要求的單次最少採購量。"

4.  **修改後端 `PartService`：**
    - 更新 `services/part_service.py` 中的 `create_part_from_form` 和 `update_part_from_form` 方法，使其能夠接收並保存 `desired_days_of_stock` 和 `moq`。

### **階段二：後端核心算法重構**

1.  **重構 `get_order_suggestion()` (`models/inventory.py`):**
    完全重寫此方法，採用新的計算邏輯。

    **最終版算法偽代碼：**
    ```python
    def get_order_suggestion(self):
        # 1. 獲取參數
        part = self.part
        if not part:
            return {'suggested_quantity': 0, 'reason': '零件關聯不存在'}

        desired_days = part.desired_days_of_stock
        moq = part.moq

        # 2. 獲取消耗分析
        analysis = self.get_consumption_analysis()
        avg_daily_consumption = analysis.get('avg_daily_consumption', 0)

        # 如果沒有消耗，則無需訂購
        if avg_daily_consumption <= 0:
            return {
                'suggested_quantity': 0,
                'reason': '無消耗記錄',
                'target_stock_level': self.safety_stock,
                'current_available_stock': self.available_quantity,
            }

        # 3. 計算目標最大庫存水平 (M)
        target_stock_level = (avg_daily_consumption * desired_days) + self.safety_stock

        # 4. 計算建議訂購量 (Q)
        suggested_quantity = target_stock_level - self.available_quantity
        
        triggered_quantity = 0
        if suggested_quantity > 0:
            if suggested_quantity < moq:
                triggered_quantity = moq
            else:
                triggered_quantity = suggested_quantity
        
        # 5. 返回豐富的建議資訊
        return {
            'suggested_quantity': int(round(triggered_quantity)),
            'calculation_logic': 'Desired Days of Stock',
            'target_stock_level': int(round(target_stock_level)),
            'current_available_stock': self.available_quantity,
            'desired_days_of_stock': desired_days,
            'moq': int(moq)
        }
    ```

### **階段三：前端介面優化**

1.  **更新 `part_lookup.html` 的詳情模態視窗：**
    - 在 `consumption_utils.js` 的 `renderLocationDetailCard` 中，修改「採購建議」卡片的顯示內容。
    - 目標是讓使用者清楚地看到建議量是如何得出的。

    **建議顯示內容：**
    - **建議訂購量: X**
    - 觸發條件: (當前庫存 `B` 低於目標 `M`)
    - **計算詳情:**
        - 目標庫存水平: `M` (可支撐 `DDS` 天)
        - 當前可用庫存: `B`
        - 供應商 MOQ: `Z`
        - *如果 `M-B < Z`，可以特別提示「因應MOQ，建議量已調整」。*

---

## 4. 結論

從現有的反應式模型，升級為由使用者定義 **「預計存貨天數」** 的策略，是一個兼具實用性、靈活性與用戶友好性的最佳方案。它不僅解決了成本數據缺失的現狀，更賦予了使用者根據實際業務需求調整庫存策略的能力。

建議立即啟動此優化專案，從**階段一（數據庫與前端擴展）**開始著手實施。
