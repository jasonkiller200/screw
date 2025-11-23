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
from ollama import Message
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation
from models.inventory import CurrentInventory, InventoryTransaction
from models.work_order import WorkOrderDemand
from models.order import Order
from extensions import db

class AIService:
    def __init__(self):
        self.model_name = "llama3.1:8b"  # 預設模型，可以配置
        self.db_path = "instance/hardware.db"  # 正確的資料庫路徑
        self.conversation_history = {}  # 存儲對話歷史，按會話ID分組

        # 配置 Ollama服務的遠端地址
        os.environ['OLLAMA_HOST'] = 'http://192.168.24.57:11434'
        
    def _get_schema_info(self) -> str:
        """獲取資料庫結構資訊"""
        schema_info = """
        資料庫結構說明：
        
        1. parts (零件表)
           - id: 零件ID
           - part_number: 零件編號 
           - name: 零件名稱
           - type: 類型
           - description: 描述
           - unit: 單位
           - quantity_per_box: 每盒數量
           - lead_time: 採購前置期
           - standard_cost: 標準成本
           - is_active: 是否啟用
           - created_at: 建立時間
           
        2. warehouses (倉庫表)
           - id: 倉庫ID
           - code: 倉庫代碼
           - name: 倉庫名稱
           - description: 描述
           - is_active: 是否啟用
           - created_at: 建立時間
           
        3. warehouse_locations (倉位表)
           - id: 倉位ID
           - warehouse_id: 倉庫ID
           - location_code: 位置代碼
           - description: 描述
           
        4. current_inventory (現行庫存表) - 存儲當前庫存狀態
           - id: 記錄ID
           - part_id: 零件ID
           - warehouse_id: 倉庫ID
           - warehouse_location_id: 倉位ID
           - quantity_on_hand: 實際庫存數量
           - reserved_quantity: 已預留數量
           - available_quantity: 可用數量
           - safety_stock: 安全庫存
           - reorder_point: 補貨點
           - last_updated: 最後更新時間
           
        5. inventory_transactions (庫存交易表) - 存儲所有庫存異動記錄（入庫、出庫等）
           - id: 交易ID
           - part_id: 零件ID
           - warehouse_id: 倉庫ID
           - warehouse_location_id: 倉位ID
           - transaction_type: 交易類型 (IN_PURCHASE=採購入庫, OUT_WORK_ORDER=工單出庫, IN_TRANSFER=轉倉入庫, OUT_TRANSFER=轉倉出庫等)
           - quantity: 數量（正數為入庫，負數為出庫）
           - unit_cost: 單位成本
           - transaction_date: 交易日期（用於查詢特定時間範圍的記錄）
           - reference_type: 參考類型
           - reference_id: 參考ID
           - notes: 備註
           - created_by: 建立者
           - user_id: 操作人員ID
           - created_at: 建立時間
           
        6. work_order_demand (工單需求表)
           - id: 需求ID
           - order_id: 工單編號
           - part_number: 零件編號
           - required_quantity: 需求數量
           - material_description: 物料說明
           - operation_description: 作業說明
           - parent_material_description: 上層物料說明
           - required_date: 需求日期
           - bulk_material: 散裝物料
           - created_at: 建立時間
           
        7. order_history (訂單表)
           - id: 訂單ID
           - part_id: 零件ID
           - warehouse_id: 倉庫ID
           - quantity_ordered: 訂購數量
           - quantity_received: 已收貨數量
           - unit_cost: 單位成本
           - status: 狀態 (pending, confirmed等)
           - supplier: 供應商
           - warehouse_location_id: 倉位ID
           - expected_date: 預期到貨日期
           - received_date: 收貨日期
           - order_date: 訂單日期
           - notes: 備註
           - created_at: 建立時間
        """
        return schema_info
        
    def _generate_sql_query_with_context(self, user_question: str, session_id: str) -> str:
        """使用AI生成SQL查詢，考慮對話歷史"""
        
        # 獲取對話歷史
        conversation_history = self._get_conversation_history(session_id)
        
        system_prompt = f"""
        你是一個專業的SQL查詢生成器。根據用戶的問題，生成對應的SQL查詢語句。

        {self._get_schema_info()}

        重要規則：
        1. 只返回一個有效的SQL SELECT語句，不要包含任何解釋或其他文字
        2. SQL語句必須以SELECT開頭
        3. 如果需要統計數量，使用COUNT(*)
        4. 如果需要連接表格，使用適當的JOIN語句
        5. 限制結果數量，在查詢結尾加上LIMIT 50（除非用戶特別要求全部）
        6. 使用正確的表名和欄位名
        7. 對於時間相關查詢，使用datetime函數
        8. 如果用戶問的是延續性問題（如"那麼"、"再看看"、"這些中"），請參考對話歷史來理解上下文
        
        重要提示：
        - 查詢"入庫記錄"、"出庫記錄"、"庫存交易"等異動記錄時，使用 inventory_transactions 表
        - 查詢"當前庫存"、"現有庫存"時，使用 current_inventory 表
        - 查詢時間範圍時，inventory_transactions 使用 transaction_date 欄位
        - 入庫記錄的 transaction_type 通常包含 'IN_' 開頭（如 IN_PURCHASE, IN_TRANSFER）
        - 出庫記錄的 transaction_type 通常包含 'OUT_' 開頭（如 OUT_WORK_ORDER, OUT_TRANSFER）

        範例：
        用戶問：有多少個零件？
        回答：SELECT COUNT(*) FROM parts

        用戶問：最近一週有哪些入庫記錄？
        回答：SELECT * FROM inventory_transactions WHERE transaction_type LIKE 'IN_%' AND transaction_date >= date('now', '-7 days') ORDER BY transaction_date DESC LIMIT 50

        用戶問：庫存不足的零件有哪些？
        回答：SELECT p.part_number, p.name, ci.available_quantity FROM parts p JOIN current_inventory ci ON p.id = ci.part_id WHERE ci.available_quantity < ci.reorder_point LIMIT 50
        """
        
        # 構建包含歷史的對話訊息
        messages: List[Message] = [Message(role='system', content=system_prompt)]
        
        # 添加最近的對話歷史（最多5輪）
        for item in conversation_history[-5:]:
            messages.append(Message(role='user', content=item['question']))
            messages.append(Message(role='assistant', content=f"SQL: {item['sql_query']}"))
        
        # 添加當前問題
        messages.append(Message(role='user', content=user_question))
        
        try:
            response = ollama.chat(
                model=self.model_name,
                messages=messages
            )
            
            sql_query = (response['message']['content'] or '').strip()
            
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
    
    def _format_answer_with_context(self, user_question: str, query_results: List[Dict[str, Any]], sql_query: str, session_id: str) -> str:
        """使用AI格式化答案，考慮對話歷史"""
        
        conversation_history = self._get_conversation_history(session_id)
        
        system_prompt = """
        你是一個專業的資料分析助手。根據用戶的問題和查詢結果，提供清晰、有用的回答。
        
        重要規則：
        1. 所有回答都必須完全使用繁體中文，包括欄位名稱和標籤。
        2. 例如，將 'Part Number' 翻譯為 '零件編號'，'total inventory' 翻譯為 '總庫存'。
        3. 回答格式要清晰易讀。如果數據很多，請總結重點。
        4. 可以包含具體的數字和重要信息。
        5. 如果用戶的問題是延續之前的對話，請考慮上下文來提供更相關的回答。
        """
        
        # 構建包含歷史的對話訊息
        messages: List[Message] = [Message(role='system', content=system_prompt)]
        
        # 添加最近的對話歷史（最多3輪）
        for item in conversation_history[-3:]:
            messages.append(Message(role='user', content=item['question']))
            messages.append(Message(role='assistant', content=item['answer'][:200] + "..."))  # 截短歷史回答
        
        # 添加當前查詢上下文
        user_prompt = f"""
        用戶問題：{user_question}
        
        SQL查詢：{sql_query}
        
        查詢結果：{json.dumps(query_results, ensure_ascii=False, indent=2)}
        
        請根據以上信息提供清晰的回答。
        """
        
        messages.append(Message(role='user', content=user_prompt))
        
        try:
            response = ollama.chat(
                model=self.model_name,
                messages=messages
            )
            
            content = response['message']['content']
            if content is None:
                return ''
            return content
            
        except Exception as e:
            # 如果AI格式化失敗，返回基本的結果摘要
            return self._format_answer(user_question, query_results, sql_query)

    def _format_answer(self, user_question: str, query_results: List[Dict[str, Any]], sql_query: str) -> str:
        """使用AI格式化答案（舊方法，保持向後兼容）"""
        system_prompt = """
        你是一個專業的資料分析助手。根據用戶的問題和查詢結果，提供清晰、有用的回答。
        
        重要規則：
        1. 所有回答都必須完全使用繁體中文，包括欄位名稱和標籤。
        2. 例如，將 'Part Number' 翻譯為 '零件編號'，'total inventory' 翻譯為 '總庫存'。
        3. 回答格式要清晰易讀。如果數據很多，請總結重點。
        4. 可以包含具體的數字和重要信息。
        """
        
        user_prompt = f"""
        用戶問題：{user_question}
        
        SQL查詢：{sql_query}
        
        查詢結果：{json.dumps(query_results, ensure_ascii=False, indent=2)}
        
        請根據以上信息提供清晰的回答。
        """
        
        try:
            response = ollama.chat(
                model=self.model_name,
                messages=[
                    Message(role='system', content=system_prompt),
                    Message(role='user', content=user_prompt)
                ]
            )
            
            content = response['message']['content']
            if content is None:
                return ''
            return content
            
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
            models = ollama.list()
            
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
        """主要查詢方法，支持對話歷史"""
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
            
            # 3. 執行查詢
            query_results = self._execute_sql_query(sql_query)
            
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
    
    def get_suggested_questions(self, mode: str = "query") -> List[str]:
        """
        獲取建議的查詢問題
        
        Args:
            mode: 模式，'query' 為資料庫查詢，'chat' 為一般聊天
        """
        if mode == "chat":
            return [
                "你好，請介紹一下你自己",
                "你能幫我做什麼？",
                "請解釋什麼是庫存管理系統",
                "如何有效管理零件庫存？",
                "什麼是安全庫存？",
                "ERP 系統的主要功能有哪些？",
                "庫存盤點的最佳實踐是什麼？",
                "如何降低庫存成本？"
            ]
        else:  # query mode
            return [
                "顯示所有零件的庫存數量",
                "哪些零件的可用數量小於10？",
                "查詢最近7天的入庫記錄",
                "顯示所有倉庫的名稱和代碼",
                "零件編號包含'SCR'的有哪些？",
                "查詢所有工單需求資料",
                "哪些零件有設定安全庫存？",
                "顯示今天的所有庫存交易",
                "查詢採購入庫的交易記錄",
                "列出所有倉位的位置代碼",
                "哪些零件的名稱包含'螺絲'？",
                "顯示庫存數量前10的零件"
            ]
    
    def chat(self, user_message: str, session_id: str = "default", system_context: Optional[str] = None) -> Dict[str, Any]:
        """
        一般AI聊天功能
        
        Args:
            user_message: 用戶的訊息
            session_id: 會話ID，用於維持對話上下文
            system_context: 可選的系統上下文，用於設定AI的角色和行為
        
        Returns:
            包含AI回應的字典
        """
        try:
            # 檢查Ollama連接
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
            
            # 設定系統提示
            if system_context is None:
                system_context = """
                你是一個專業且友善的AI助手，專門協助硬體零件庫存管理系統的用戶。
                
                你的特點：
                1. 使用繁體中文回答
                2. 回答要清晰、準確、有幫助
                3. 對於專業問題，可以提供詳細的解釋
                4. 保持友善和專業的態度
                5. 如果不確定答案，會誠實告知
                
                你可以協助用戶：
                - 解答有關庫存管理的問題
                - 提供系統使用建議
                - 解釋庫存管理的概念和最佳實踐
                - 進行一般的對話和交流
                """
            
            # 構建對話訊息
            messages: List[Message] = [Message(role='system', content=system_context)]
            
            # 添加對話歷史（最多10輪）
            chat_history_key = f"chat_{session_id}"
            if chat_history_key not in self.conversation_history:
                self.conversation_history[chat_history_key] = []
            
            for item in self.conversation_history[chat_history_key][-10:]:
                messages.append(Message(role='user', content=item['user_message']))
                messages.append(Message(role='assistant', content=item['ai_response']))
            
            # 添加當前用戶訊息
            messages.append(Message(role='user', content=user_message))
            
            # 調用Ollama生成回應
            response = ollama.chat(
                model=self.model_name,
                messages=messages
            )
            
            ai_response = response['message']['content']
            if ai_response is None:
                ai_response = ''
            
            # 更新對話歷史
            self.conversation_history[chat_history_key].append({
                'timestamp': datetime.now().isoformat(),
                'user_message': user_message,
                'ai_response': ai_response
            })
            
            # 保持歷史記錄不超過20輪對話
            if len(self.conversation_history[chat_history_key]) > 20:
                self.conversation_history[chat_history_key] = self.conversation_history[chat_history_key][-20:]
            
            return {
                'success': True,
                'response': ai_response,
                'session_id': session_id,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'聊天功能發生錯誤: {str(e)}',
                'user_message': user_message,
                'session_id': session_id
            }
    
    def get_chat_history(self, session_id: str = "default", limit: int = 20) -> Dict[str, Any]:
        """
        獲取聊天歷史記錄
        
        Args:
            session_id: 會話ID
            limit: 返回的最大記錄數
        
        Returns:
            包含聊天歷史的字典
        """
        chat_history_key = f"chat_{session_id}"
        history = self.conversation_history.get(chat_history_key, [])
        
        return {
            'success': True,
            'session_id': session_id,
            'total_messages': len(history),
            'history': history[-limit:] if limit else history
        }
    
    def clear_chat_history(self, session_id: str = "default") -> Dict[str, Any]:
        """
        清除聊天歷史記錄
        
        Args:
            session_id: 會話ID，如果為None則清除所有聊天歷史
        
        Returns:
            操作結果
        """
        try:
            if session_id:
                chat_history_key = f"chat_{session_id}"
                if chat_history_key in self.conversation_history:
                    del self.conversation_history[chat_history_key]
                    return {
                        'success': True,
                        'message': f'已清除會話 {session_id} 的聊天歷史'
                    }
                else:
                    return {
                        'success': False,
                        'message': f'會話 {session_id} 不存在'
                    }
            else:
                # 清除所有聊天歷史
                chat_keys = [k for k in self.conversation_history.keys() if k.startswith('chat_')]
                for key in chat_keys:
                    del self.conversation_history[key]
                return {
                    'success': True,
                    'message': f'已清除所有聊天歷史（共 {len(chat_keys)} 個會話）'
                }
        except Exception as e:
            return {
                'success': False,
                'error': f'清除聊天歷史失敗: {str(e)}'
            }
