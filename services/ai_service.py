"""
AI 查詢服務
提供與 Ollama 模型整合的查詢功能
"""

import ollama
import httpx
import json
import re
import sqlite3
from typing import Dict, List, Any, Optional
from datetime import datetime
import os
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation
from models.inventory import CurrentInventory, InventoryTransaction
from models.work_order import WorkOrderDemand
from models.order import Order
from extensions import db

class AIService:
    def __init__(self):
        self.model_name = "qwen3.5:9b"  # 預設模型，可以配置
        self.db_path = "instance/hardware.db"  # 正確的資料庫路徑
        self.conversation_history = {}  # 存儲對話歷史，按會話ID分組
        self.ollama_host = 'http://192.168.6.137:11434'
        self.ollama_client = ollama.Client(host=self.ollama_host)  # 用於 list models 等非 chat 操作

    def _chat(self, messages: List[Dict[str, str]]) -> str:
        """透過 REST API 呼叫 Ollama chat，強制關閉思考模式"""
        response = httpx.post(
            f'{self.ollama_host}/api/chat',
            json={
                'model': self.model_name,
                'messages': messages,
                'think': False,
                'stream': False,
            },
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()
        return self._clean_response(data['message']['content'])

    def _clean_response(self, text: str) -> str:
        """清理 LLM 回應，移除思考標籤等"""
        # 移除 <think>...</think> 區塊（qwen3 思考模式）
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
        return text.strip()
        
    def _get_schema_info(self) -> str:
        """獲取資料庫結構資訊（自動從資料庫讀取 + 業務備註）"""
        try:
            return self._get_schema_info_auto()
        except Exception:
            return self._get_schema_info_fallback()

    def _get_schema_info_auto(self) -> str:
        """自動從資料庫讀取真實結構，附加業務語義備註"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 取得所有表名（排除 alembic 和 sqlite 內部表）
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'alembic%' AND name NOT LIKE 'sqlite_%' "
            "ORDER BY name"
        )
        tables = cursor.fetchall()

        # 業務語義備註，幫助 LLM 理解欄位含義
        business_notes = {
            'parts': '零件主檔。part_number 是唯一零件編號，lead_time 是採購前置期（天）',
            'warehouses': (
                '倉庫主檔。code 是倉庫代碼。'
                'name 是倉庫簡稱（為了方便辨識，以管理人員的暱稱命名，如 阿良、筆、家榮、柏元 等）。'
                '倉庫代表「儲存區域」，不是操作人員。'
                '查詢某倉庫的出入庫用 warehouses.name。'
            ),
            'warehouse_locations': '倉位表。warehouse_id 關聯 warehouses',
            'part_warehouse_location': '零件與倉位的多對多關聯表',
            'users': (
                '系統用戶表。username=帳號, full_name=真實姓名, department=部門。'
                'inventory_transactions.user_id 關聯到 users.id，表示實際執行出入庫操作的人員。'
                '操作人員與倉庫是不同概念：倉庫=儲存區域，操作人員=執行領料/入庫的人'
            ),
            'current_inventory': (
                '現行庫存表。quantity_on_hand=實際庫存, available_quantity=可用庫存, '
                'safety_stock=安全庫存, reorder_point=補貨點, '
                'desired_days_of_stock=預期存貨天數(DDS), moq=最小訂購量(MOQ)'
            ),
            'inventory_transactions': (
                '庫存交易記錄表。transaction_type: IN_PURCHASE=採購入庫, OUT_WORK_ORDER=工單出庫, '
                'IN_TRANSFER=轉倉入庫, OUT_TRANSFER=轉倉出庫, OUT_AFTER_SALES=售後出庫, OUT_SCRAP=報廢出庫。'
                'quantity 正數=入庫, 負數=出庫。transaction_date 用於時間範圍查詢'
            ),
            'work_order_demand': '工單需求表。order_id=工單編號, part_number=零件編號',
            'order_history': '採購訂單表。status: pending=待處理, confirmed=已確認。supplier=供應商',
        }

        schema = "資料庫結構說明（自動讀取）：\n"
        for (table_name,) in tables:
            cursor.execute(f"PRAGMA table_info([{table_name}])")
            columns = cursor.fetchall()

            note = business_notes.get(table_name, '')
            schema += f"\n{table_name} 表"
            if note:
                schema += f" — {note}"
            schema += ":\n"
            for col in columns:
                # col: (cid, name, type, notnull, default, pk)
                col_desc = f"  - {col[1]} ({col[2]})"
                if col[5]:
                    col_desc += " [PK]"
                schema += col_desc + "\n"

        conn.close()
        return schema

    def _get_schema_info_fallback(self) -> str:
        """手寫的 schema 備援（當自動讀取失敗時使用）"""
        return """
        資料庫結構說明：

        1. parts (零件表)
           - id, part_number(唯一), name, description, unit
           - quantity_per_box, lead_time(採購前置期), standard_cost, is_active

        2. warehouses (倉庫表) — 代表儲存區域，name為管理暱稱（如阿良、筆、家榮）
           - id, code(唯一), name(倉庫簡稱), description, is_active

        3. warehouse_locations (倉位表)
           - id, warehouse_id, location_code, description

        4. current_inventory (現行庫存表)
           - id, part_id, warehouse_id, warehouse_location_id
           - quantity_on_hand(實際庫存), reserved_quantity, available_quantity(可用庫存)
           - safety_stock(安全庫存), reorder_point(補貨點), last_updated

        5. inventory_transactions (庫存交易表)
           - id, part_id, warehouse_id, warehouse_location_id
           - transaction_type(IN_PURCHASE/OUT_WORK_ORDER/IN_TRANSFER/OUT_TRANSFER等)
           - quantity(正=入庫,負=出庫), unit_cost, transaction_date, notes, created_by
           - user_id(關聯 users.id，實際執行操作的人員)

        6. users (用戶表) — 代表操作人員，與倉庫是不同概念
           - id, username(帳號), full_name(姓名), department(部門), role, is_active
           - 倉庫=儲存區域(用warehouses.name)，操作人員=執行動作的人(用users.full_name)

        7. work_order_demand (工單需求表)
           - id, order_id, part_number, required_quantity, required_date

        7. order_history (訂單表)
           - id, part_id, warehouse_id, quantity_ordered, quantity_received
           - unit_cost, status(pending/confirmed), supplier, expected_date, order_date
        """
        
    def _generate_sql_query_with_context(self, user_question: str, session_id: str) -> str:
        """使用AI生成SQL查詢，考慮對話歷史"""
        
        # 獲取對話歷史
        conversation_history = self._get_conversation_history(session_id)
        
        sql_instructions = f"""你是SQL查詢生成器。根據用戶的問題，生成一個SQLite SQL SELECT語句。只返回SQL，不要包含任何解釋。

{self._get_schema_info()}

重要規則：
- 只返回一個 SELECT 語句，不要有其他文字
- 加上 LIMIT 50（除非用戶要求全部）
- 時間查詢用 date('now','-7 days') 格式
- 入庫: transaction_type LIKE 'IN_%'，出庫: transaction_type LIKE 'OUT_%'
- 查詢異動記錄用 inventory_transactions，查詢當前庫存用 current_inventory
- 需要零件名稱就 JOIN parts，需要倉庫名稱就 JOIN warehouses

★ 倉庫 vs 操作人員（兩個不同維度，不要混淆）：
  - 「倉庫/倉位」= 儲存區域，倉庫名稱是暱稱（如阿良、筆、家榮、柏元），查詢用 warehouses.name
  - 「操作人員/誰」= 執行出入庫動作的人，查詢用 JOIN users u ON it.user_id = u.id，用 u.full_name
  - 問「阿良倉出了什麼」→ 用 warehouses.name（倉庫維度）
  - 問「誰操作/誰領料/某人執行」→ 用 users.full_name（人員維度）
  - 預設問「阿良出庫」一律視為倉庫查詢，除非明確說「操作人員」或「誰」

範例：
問：有多少個零件？ → SELECT COUNT(*) as total FROM parts
問：最近一週入庫記錄？ → SELECT it.*, p.part_number, p.name as part_name FROM inventory_transactions it JOIN parts p ON it.part_id = p.id WHERE it.transaction_type LIKE 'IN_%' AND it.transaction_date >= date('now', '-7 days') ORDER BY it.transaction_date DESC LIMIT 50
問：庫存不足的零件？ → SELECT p.part_number, p.name, ci.available_quantity, ci.safety_stock, ci.reorder_point FROM parts p JOIN current_inventory ci ON p.id = ci.part_id WHERE ci.available_quantity < ci.reorder_point ORDER BY ci.available_quantity ASC LIMIT 50
問：哪些倉庫零件種類最多？ → SELECT w.code, w.name, COUNT(DISTINCT ci.part_id) as part_count FROM warehouses w JOIN current_inventory ci ON w.id = ci.warehouse_id GROUP BY w.id ORDER BY part_count DESC
問：零件 P001 的最近異動？ → SELECT it.transaction_type, it.quantity, it.transaction_date, it.notes, w.name as warehouse_name FROM inventory_transactions it JOIN parts p ON it.part_id = p.id JOIN warehouses w ON it.warehouse_id = w.id WHERE p.part_number = 'P001' ORDER BY it.transaction_date DESC LIMIT 20
問：今天有哪些庫存交易？ → SELECT it.*, p.part_number, p.name as part_name FROM inventory_transactions it JOIN parts p ON it.part_id = p.id WHERE date(it.transaction_date) = date('now') ORDER BY it.transaction_date DESC LIMIT 50
問：工單需求量最高前10零件？ → SELECT wod.part_number, SUM(wod.required_quantity) as total_demand, COUNT(*) as order_count FROM work_order_demand wod GROUP BY wod.part_number ORDER BY total_demand DESC LIMIT 10
問：待處理採購訂單數量？ → SELECT COUNT(*) as pending_count FROM order_history WHERE status = 'pending'
問：庫存價值最高前10零件？ → SELECT p.part_number, p.name, ci.quantity_on_hand, p.standard_cost, (ci.quantity_on_hand * p.standard_cost) as total_value FROM parts p JOIN current_inventory ci ON p.id = ci.part_id WHERE p.standard_cost > 0 ORDER BY total_value DESC LIMIT 10
問：最近三天出庫最多零件？ → SELECT p.part_number, p.name, SUM(ABS(it.quantity)) as total_out FROM inventory_transactions it JOIN parts p ON it.part_id = p.id WHERE it.transaction_type LIKE 'OUT_%' AND it.transaction_date >= date('now', '-3 days') GROUP BY it.part_id ORDER BY total_out DESC LIMIT 10
問：各倉庫庫存總量？ → SELECT w.code, w.name, SUM(ci.quantity_on_hand) as total_qty, COUNT(DISTINCT ci.part_id) as part_types FROM warehouses w JOIN current_inventory ci ON w.id = ci.warehouse_id GROUP BY w.id ORDER BY total_qty DESC
問：工單需求但庫存為零的零件？ → SELECT DISTINCT wod.part_number, wod.material_description, COALESCE(ci.quantity_on_hand, 0) as on_hand FROM work_order_demand wod LEFT JOIN parts p ON wod.part_number = p.part_number LEFT JOIN current_inventory ci ON p.id = ci.part_id WHERE COALESCE(ci.quantity_on_hand, 0) = 0 LIMIT 50
問：阿良倉本週出庫哪些零件？ → SELECT p.part_number, p.name, it.quantity, it.transaction_type, it.transaction_date, it.notes FROM inventory_transactions it JOIN parts p ON it.part_id = p.id JOIN warehouses w ON it.warehouse_id = w.id WHERE w.name LIKE '%阿良%' AND it.transaction_type LIKE 'OUT_%' AND it.transaction_date >= date('now', 'weekday 0', '-7 days') ORDER BY it.transaction_date DESC LIMIT 50
問：柏元倉最近入庫了什麼？ → SELECT p.part_number, p.name, it.quantity, it.transaction_type, it.transaction_date FROM inventory_transactions it JOIN parts p ON it.part_id = p.id JOIN warehouses w ON it.warehouse_id = w.id WHERE w.name LIKE '%柏元%' AND it.transaction_type LIKE 'IN_%' ORDER BY it.transaction_date DESC LIMIT 50
問：誰今天出庫最多？ → SELECT u.full_name, COUNT(*) as tx_count, SUM(ABS(it.quantity)) as total_qty FROM inventory_transactions it JOIN users u ON it.user_id = u.id WHERE it.transaction_type LIKE 'OUT_%' AND date(it.transaction_date) = date('now') GROUP BY it.user_id ORDER BY total_qty DESC LIMIT 10
問：棁柏章今天操作了哪些出庫？ → SELECT p.part_number, p.name, it.quantity, it.transaction_date, w.name as warehouse_name, it.notes FROM inventory_transactions it JOIN parts p ON it.part_id = p.id JOIN warehouses w ON it.warehouse_id = w.id JOIN users u ON it.user_id = u.id WHERE u.full_name LIKE '%棁柏章%' AND it.transaction_type LIKE 'OUT_%' AND date(it.transaction_date) = date('now') ORDER BY it.transaction_date DESC LIMIT 50
"""
        
        # 構建對話訊息（不用 system role）
        messages = []
        
        # 添加最近的對話歷史（最多5輪）
        for item in conversation_history[-5:]:
            messages.append({'role': 'user', 'content': item['question']})
            messages.append({'role': 'assistant', 'content': item['sql_query']})
        
        # 添加當前問題
        messages.append({'role': 'user', 'content': f'{sql_instructions}\n\n現在請為以下問題生成SQL：\n{user_question}'})
        
        try:
            sql_query = self._chat(messages)
            
            # 清理SQL查詢，移除可能的格式化字符
            if sql_query.startswith('```sql'):
                sql_query = sql_query[6:]
            if sql_query.startswith('```'):
                sql_query = sql_query[3:]
            if sql_query.endswith('```'):
                sql_query = sql_query[:-3]
            
            # 移除可能的前綴
            prefixes_to_remove = ['SQL:', 'sql:', '查詢:', '答案:', 'Query:', 'Answer:']
            for prefix in prefixes_to_remove:
                if sql_query.upper().startswith(prefix.upper()):
                    sql_query = sql_query[len(prefix):].strip()
            
            # 移除可能的多餘空白和換行
            sql_query = ' '.join(sql_query.split())
            
            # 移除可能的不可見字符
            sql_query = ''.join(char for char in sql_query if ord(char) >= 32 or char in ['\t', '\n'])
            
            # 保持SQLite標準的引號格式
            # SQLite支持雙引號，不需要統一改成單引號
            
            # 驗證SQL查詢是否以SELECT開頭
            if not sql_query.upper().startswith('SELECT'):
                raise Exception(f"生成的查詢不是有效的SELECT語句: {sql_query}")
            
            return sql_query
            
        except Exception as e:
            raise Exception(f"生成SQL查詢失敗: {str(e)}")

    def _generate_sql_query(self, user_question: str) -> str:
        """使用AI生成SQL查詢（舊方法，保持向後兼容）"""
        return self._generate_sql_query_with_context(user_question, "default")
    
    def _execute_sql_query(self, sql_query: str) -> List[Dict[str, Any]]:
        """執行SQL查詢"""
        try:
            # 連接到SQLite資料庫
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # 讓結果可以用字典方式存取
            cursor = conn.cursor()
            
            # 記錄執行的SQL查詢用於調試（可選）
            # print(f"DEBUG: 執行SQL查詢: {sql_query}")
            
            # 執行查詢
            cursor.execute(sql_query)
            results = cursor.fetchall()
            
            # 轉換為字典列表
            result_list = []
            for row in results:
                result_list.append(dict(row))
            
            conn.close()
            return result_list
            
        except sqlite3.Error as e:
            raise Exception(f"執行SQL查詢失敗: {str(e)} | SQL: {sql_query}")
        except Exception as e:
            raise Exception(f"執行SQL查詢失敗: {str(e)}")

    def _retry_sql_with_error(self, user_question: str, failed_sql: str, error_msg: str, session_id: str) -> str:
        """SQL 執行失敗時，讓 LLM 根據錯誤訊息修正 SQL"""
        retry_prompt = f"""
你之前生成的 SQL 查詢執行失敗了，請根據錯誤訊息修正。

用戶的問題：{user_question}

失敗的 SQL：{failed_sql}

錯誤訊息：{error_msg}

{self._get_schema_info()}

請生成一個修正後的 SQL SELECT 語句。只返回 SQL，不要包含任何解釋。
"""
        try:
            sql_query = self._chat([{'role': 'user', 'content': retry_prompt}])
            # 清理格式
            if sql_query.startswith('```sql'):
                sql_query = sql_query[6:]
            if sql_query.startswith('```'):
                sql_query = sql_query[3:]
            if sql_query.endswith('```'):
                sql_query = sql_query[:-3]
            sql_query = ' '.join(sql_query.split())

            if not sql_query.upper().startswith('SELECT'):
                raise Exception(f"修正後的查詢不是有效的SELECT語句: {sql_query}")
            return sql_query
        except Exception as e:
            raise Exception(f"SQL 修正失敗: {str(e)}")
    
    def _format_answer_with_context(self, user_question: str, query_results: List[Dict[str, Any]], sql_query: str, session_id: str) -> str:
        """使用AI格式化答案，考慮對話歷史"""
        
        conversation_history = self._get_conversation_history(session_id)
        
        # 構建精確的查詢上下文
        result_text = json.dumps(query_results[:30], ensure_ascii=False, indent=2) if query_results else '[]'
        
        # 將指令和數據合併到單一 prompt，避免模型忽略查詢結果
        prompt = f"""以下是螺絲庫存系統的資料庫查詢結果，請直接根據這些數據回答用戶的問題。

規則：繁體中文回答、用 Markdown 表格呈現多筆數據、粗體標示重點數字、不要詢問用戶提供資料。

用戶問題：{user_question}

已執行的SQL：{sql_query}

查詢結果（共 {len(query_results)} 筆）：
{result_text}

請根據以上查詢結果直接回答。"""

        # 構建對話訊息（不用 system role，全部放 user/assistant）
        messages = []
        
        # 添加最近的對話歷史（最多3輪）
        for item in conversation_history[-3:]:
            messages.append({'role': 'user', 'content': item['question']})
            messages.append({'role': 'assistant', 'content': item['answer'][:200]})
        
        messages.append({'role': 'user', 'content': prompt})
        
        try:
            return self._chat(messages)
            
        except Exception as e:
            # 如果AI格式化失敗，返回基本的結果摘要
            return self._format_answer(user_question, query_results, sql_query)

    def _format_answer(self, user_question: str, query_results: List[Dict[str, Any]], sql_query: str) -> str:
        """使用AI格式化答案（舊方法，保持向後兼容）"""
        result_text = json.dumps(query_results[:30], ensure_ascii=False, indent=2) if query_results else '[]'
        prompt = f"""以下是螺絲庫存系統的資料庫查詢結果，請直接根據這些數據回答用戶的問題。
規則：繁體中文回答、用 Markdown 表格呈現多筆數據、粗體標示重點數字。

用戶問題：{user_question}

已執行的SQL：{sql_query}

查詢結果（共 {len(query_results)} 筆）：
{result_text}

請根據以上查詢結果直接回答。"""
        
        try:
            return self._chat([{'role': 'user', 'content': prompt}])
            
        except Exception as e:
            # 如果AI格式化失敗，返回基本的結果摘要
            if not query_results:
                return "查詢完成，但沒有找到相關數據。"
            
            summary = f"查詢完成，共找到 {len(query_results)} 筆記錄。\n\n"
            
            # 顯示前幾筆結果
            for i, result in enumerate(query_results[:5]):
                summary += f"記錄 {i+1}:\n"
                for key, value in result.items():
                    summary += f"  {key}: {value}\n"
                summary += "\n"
            
            if len(query_results) > 5:
                summary += f"... 還有 {len(query_results) - 5} 筆記錄\n"
            
            return summary
    
    def _get_conversation_history(self, session_id: str) -> List[Dict[str, Any]]:
        """獲取對話歷史"""
        return self.conversation_history.get(session_id, [])
    
    def _update_conversation_history(self, session_id: str, question: str, sql_query: str, results: List[Dict[str, Any]], answer: str):
        """更新對話歷史"""
        if session_id not in self.conversation_history:
            self.conversation_history[session_id] = []
        
        # 添加新的對話記錄
        self.conversation_history[session_id].append({
            'timestamp': datetime.now().isoformat(),
            'question': question,
            'sql_query': sql_query,
            'results': results[:5],  # 只保存前5個結果以節省記憶體
            'result_count': len(results),
            'answer': answer
        })
        
        # 保持歷史記錄不超過20輪對話
        if len(self.conversation_history[session_id]) > 20:
            self.conversation_history[session_id] = self.conversation_history[session_id][-20:]
    
    def clear_conversation_history(self, session_id: str = None):
        """清除對話歷史"""
        if session_id:
            if session_id in self.conversation_history:
                del self.conversation_history[session_id]
        else:
            self.conversation_history.clear()
    
    def get_conversation_summary(self, session_id: str) -> Dict[str, Any]:
        """獲取對話摘要"""
        history = self._get_conversation_history(session_id)
        if not history:
            return {
                'session_id': session_id,
                'total_conversations': 0,
                'last_activity': None
            }
        
        return {
            'session_id': session_id,
            'total_conversations': len(history),
            'last_activity': history[-1]['timestamp'],
            'recent_topics': [item['question'] for item in history[-5:]]
        }
    
    def check_ollama_connection(self) -> Dict[str, Any]:
        """檢查Ollama連接"""
        try:
            # 嘗試列出可用模型
            models = self.ollama_client.list()
            
            # 檢查我們的模型是否可用
            model_available = any(model['name'].startswith(self.model_name) for model in models.get('models', []))
            
            return {
                'success': True,
                'model_available': model_available,
                'available_models': [model['name'] for model in models.get('models', [])],
                'current_model': self.model_name
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': '無法連接到Ollama服務，請確認Ollama已啟動並且模型已下載'
            }
    
    def query_database(self, user_question: str, session_id: str = "default") -> Dict[str, Any]:
        """主要查詢方法，支持對話歷史和 SQL 自動重試"""
        try:
            # 1. 檢查Ollama連接
            connection_status = self.check_ollama_connection()
            if not connection_status['success']:
                return {
                    'success': False,
                    'error': connection_status['message'],
                    'details': connection_status
                }
            
            if not connection_status['model_available']:
                return {
                    'success': False,
                    'error': f'模型 {self.model_name} 不可用',
                    'details': f'可用模型: {", ".join(connection_status["available_models"])}'
                }
            
            # 2. 生成SQL查詢（考慮對話歷史）
            sql_query = self._generate_sql_query_with_context(user_question, session_id)
            
            # 3. 執行查詢（含自動重試）
            query_results = None
            last_error = None
            max_retries = 2  # 最多重試2次（共3次機會）
            
            for attempt in range(max_retries + 1):
                try:
                    query_results = self._execute_sql_query(sql_query)
                    break  # 成功就跳出
                except Exception as e:
                    last_error = str(e)
                    if attempt < max_retries:
                        # 讓 LLM 根據錯誤訊息修正 SQL
                        sql_query = self._retry_sql_with_error(
                            user_question, sql_query, last_error, session_id
                        )
                    else:
                        # 所有重試都失敗
                        return {
                            'success': False,
                            'error': f'SQL 執行失敗（已重試 {max_retries} 次）: {last_error}',
                            'sql_query': sql_query,
                            'user_question': user_question,
                            'session_id': session_id
                        }
            
            # 4. 格式化回答（考慮對話歷史）
            formatted_answer = self._format_answer_with_context(user_question, query_results, sql_query, session_id)
            
            # 5. 更新對話歷史
            self._update_conversation_history(session_id, user_question, sql_query, query_results, formatted_answer)
            
            return {
                'success': True,
                'answer': formatted_answer,
                'sql_query': sql_query,
                'raw_results': query_results,
                'result_count': len(query_results),
                'session_id': session_id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'user_question': user_question,
                'session_id': session_id
            }
    
    def get_suggested_questions(self) -> List[str]:
        """獲取建議的查詢問題"""
        return [
            "目前有哪些零件庫存不足？",
            "最近一週有哪些入庫記錄？",
            "最近三天有哪些出庫記錄？",
            "工單需求量最高的前10個零件是什麼？",
            "哪些零件還沒有設定儲存位置？",
            "目前有多少待處理的採購訂單？",
            "庫存價值最高的前10個零件是什麼？",
            "最近的庫存異動記錄有哪些？",
            "哪些倉庫的零件種類最多？",
            "即將到期的採購訂單有哪些？",
            "工單需求但零件庫沒有的零件有哪些？",
            "今天有哪些庫存交易？"
        ]