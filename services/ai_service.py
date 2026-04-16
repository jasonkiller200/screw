"""
AI 查詢服務
提供與 Ollama 模型整合的查詢功能
"""

import ollama
import json
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
        self.ollama_client = ollama.Client(host='http://192.168.6.137:11434')  # Ollama 服務器位址
        
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
            'warehouses': '倉庫主檔。code 是倉庫代碼',
            'warehouse_locations': '倉位表。warehouse_id 關聯 warehouses',
            'part_warehouse_location': '零件與倉位的多對多關聯表',
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

        2. warehouses (倉庫表)
           - id, code(唯一), name, description, is_active

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

        6. work_order_demand (工單需求表)
           - id, order_id, part_number, required_quantity, required_date

        7. order_history (訂單表)
           - id, part_id, warehouse_id, quantity_ordered, quantity_received
           - unit_cost, status(pending/confirmed), supplier, expected_date, order_date
        """
        
    def _generate_sql_query_with_context(self, user_question: str, session_id: str) -> str:
        """使用AI生成SQL查詢，考慮對話歷史"""
        
        # 獲取對話歷史
        conversation_history = self._get_conversation_history(session_id)
        
        system_prompt = f"""
        你是一個專業的SQL查詢生成器。根據用戶的問題，生成對應的SQLite SQL查詢語句。

        {self._get_schema_info()}

        重要規則：
        1. 只返回一個有效的SQL SELECT語句，不要包含任何解釋或其他文字
        2. SQL語句必須以SELECT開頭
        3. 如果需要統計數量，使用COUNT(*)
        4. 如果需要連接表格，使用適當的JOIN語句
        5. 限制結果數量，在查詢結尾加上LIMIT 50（除非用戶特別要求全部）
        6. 使用正確的表名和欄位名
        7. 對於時間相關查詢，使用SQLite的date()/datetime()函數，例如 date('now','-7 days')
        8. 如果用戶問的是延續性問題（如"那麼"、"再看看"、"這些中"），請參考對話歷史來理解上下文
        
        重要提示：
        - 查詢"入庫記錄"、"出庫記錄"、"庫存交易"等異動記錄時，使用 inventory_transactions 表
        - 查詢"當前庫存"、"現有庫存"時，使用 current_inventory 表
        - 查詢時間範圍時，inventory_transactions 使用 transaction_date 欄位
        - 入庫記錄的 transaction_type 以 'IN_' 開頭（IN_PURCHASE, IN_TRANSFER）
        - 出庫記錄的 transaction_type 以 'OUT_' 開頭（OUT_WORK_ORDER, OUT_TRANSFER, OUT_AFTER_SALES, OUT_SCRAP）
        - 需要零件名稱時，JOIN parts 表用 part_id 或 part_number 關聯
        - 需要倉庫名稱時，JOIN warehouses 表用 warehouse_id 關聯

        範例（請嚴格學習這些模式）：

        用戶問：有多少個零件？
        回答：SELECT COUNT(*) as total FROM parts

        用戶問：最近一週有哪些入庫記錄？
        回答：SELECT it.*, p.part_number, p.name as part_name FROM inventory_transactions it JOIN parts p ON it.part_id = p.id WHERE it.transaction_type LIKE 'IN_%' AND it.transaction_date >= date('now', '-7 days') ORDER BY it.transaction_date DESC LIMIT 50

        用戶問：庫存不足的零件有哪些？
        回答：SELECT p.part_number, p.name, ci.available_quantity, ci.safety_stock, ci.reorder_point FROM parts p JOIN current_inventory ci ON p.id = ci.part_id WHERE ci.available_quantity < ci.reorder_point ORDER BY ci.available_quantity ASC LIMIT 50

        用戶問：哪些倉庫的零件種類最多？
        回答：SELECT w.code, w.name, COUNT(DISTINCT ci.part_id) as part_count FROM warehouses w JOIN current_inventory ci ON w.id = ci.warehouse_id GROUP BY w.id ORDER BY part_count DESC

        用戶問：零件 P001 的最近異動記錄？
        回答：SELECT it.transaction_type, it.quantity, it.transaction_date, it.notes, w.name as warehouse_name FROM inventory_transactions it JOIN parts p ON it.part_id = p.id JOIN warehouses w ON it.warehouse_id = w.id WHERE p.part_number = 'P001' ORDER BY it.transaction_date DESC LIMIT 20

        用戶問：今天有哪些庫存交易？
        回答：SELECT it.*, p.part_number, p.name as part_name FROM inventory_transactions it JOIN parts p ON it.part_id = p.id WHERE date(it.transaction_date) = date('now') ORDER BY it.transaction_date DESC LIMIT 50

        用戶問：工單需求量最高的前10個零件是什麼？
        回答：SELECT wod.part_number, SUM(wod.required_quantity) as total_demand, COUNT(*) as order_count FROM work_order_demand wod GROUP BY wod.part_number ORDER BY total_demand DESC LIMIT 10

        用戶問：目前有多少待處理的採購訂單？
        回答：SELECT COUNT(*) as pending_count FROM order_history WHERE status = 'pending'

        用戶問：庫存價值最高的前10個零件？
        回答：SELECT p.part_number, p.name, ci.quantity_on_hand, p.standard_cost, (ci.quantity_on_hand * p.standard_cost) as total_value FROM parts p JOIN current_inventory ci ON p.id = ci.part_id WHERE p.standard_cost > 0 ORDER BY total_value DESC LIMIT 10

        用戶問：最近三天出庫最多的零件？
        回答：SELECT p.part_number, p.name, SUM(ABS(it.quantity)) as total_out FROM inventory_transactions it JOIN parts p ON it.part_id = p.id WHERE it.transaction_type LIKE 'OUT_%' AND it.transaction_date >= date('now', '-3 days') GROUP BY it.part_id ORDER BY total_out DESC LIMIT 10

        用戶問：各倉庫的庫存總量？
        回答：SELECT w.code, w.name, SUM(ci.quantity_on_hand) as total_qty, COUNT(DISTINCT ci.part_id) as part_types FROM warehouses w JOIN current_inventory ci ON w.id = ci.warehouse_id GROUP BY w.id ORDER BY total_qty DESC

        用戶問：哪些零件有工單需求但庫存為零？
        回答：SELECT DISTINCT wod.part_number, wod.material_description, COALESCE(ci.quantity_on_hand, 0) as on_hand FROM work_order_demand wod LEFT JOIN parts p ON wod.part_number = p.part_number LEFT JOIN current_inventory ci ON p.id = ci.part_id WHERE COALESCE(ci.quantity_on_hand, 0) = 0 LIMIT 50
        """
        
        # 構建包含歷史的對話訊息
        messages = [{'role': 'system', 'content': system_prompt}]
        
        # 添加最近的對話歷史（最多5輪）
        for item in conversation_history[-5:]:
            messages.append({'role': 'user', 'content': item['question']})
            messages.append({'role': 'assistant', 'content': f"SQL: {item['sql_query']}"})
        
        # 添加當前問題
        messages.append({'role': 'user', 'content': user_question})
        
        try:
            response = self.ollama_client.chat(
                model=self.model_name,
                messages=messages
            )
            
            sql_query = response['message']['content'].strip()
            
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
            response = self.ollama_client.chat(
                model=self.model_name,
                messages=[
                    {'role': 'user', 'content': retry_prompt}
                ]
            )
            sql_query = response['message']['content'].strip()
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
        
        system_prompt = """
        你是一個專業的資料分析助手。根據用戶的問題和查詢結果，提供清晰、有用的回答。
        
        請用繁體中文回答，格式要清晰易讀。如果數據很多，請總結重點。
        可以包含具體的數字和重要信息。
        
        如果用戶的問題是延續之前的對話，請考慮上下文來提供更相關的回答。
        """
        
        # 構建包含歷史的對話訊息
        messages = [{'role': 'system', 'content': system_prompt}]
        
        # 添加最近的對話歷史（最多3輪）
        for item in conversation_history[-3:]:
            messages.append({'role': 'user', 'content': item['question']})
            messages.append({'role': 'assistant', 'content': item['answer'][:200] + "..."})  # 截短歷史回答
        
        # 添加當前查詢上下文
        user_prompt = f"""
        用戶問題：{user_question}
        
        SQL查詢：{sql_query}
        
        查詢結果：{json.dumps(query_results, ensure_ascii=False, indent=2)}
        
        請根據以上信息提供清晰的回答。
        """
        
        messages.append({'role': 'user', 'content': user_prompt})
        
        try:
            response = self.ollama_client.chat(
                model=self.model_name,
                messages=messages
            )
            
            return response['message']['content']
            
        except Exception as e:
            # 如果AI格式化失敗，返回基本的結果摘要
            return self._format_answer(user_question, query_results, sql_query)

    def _format_answer(self, user_question: str, query_results: List[Dict[str, Any]], sql_query: str) -> str:
        """使用AI格式化答案（舊方法，保持向後兼容）"""
        system_prompt = """
        你是一個專業的資料分析助手。根據用戶的問題和查詢結果，提供清晰、有用的回答。
        
        請用繁體中文回答，格式要清晰易讀。如果數據很多，請總結重點。
        可以包含具體的數字和重要信息。
        """
        
        user_prompt = f"""
        用戶問題：{user_question}
        
        SQL查詢：{sql_query}
        
        查詢結果：{json.dumps(query_results, ensure_ascii=False, indent=2)}
        
        請根據以上信息提供清晰的回答。
        """
        
        try:
            response = self.ollama_client.chat(
                model=self.model_name,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ]
            )
            
            return response['message']['content']
            
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