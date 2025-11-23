"""
AI查詢控制器
處理AI相關的HTTP請求
"""

from flask import Blueprint, request, jsonify, render_template
from services.ai_service import AIService
from datetime import datetime
import logging

# 創建藍圖
ai_bp = Blueprint('ai', __name__, url_prefix='/ai')

# 初始化AI服務
ai_service = AIService()

@ai_bp.route('/')
def ai_chat_page():
    """AI聊天頁面"""
    return render_template('ai_chat.html')

@ai_bp.route('/query', methods=['POST'])
def ai_query():
    """處理AI查詢請求"""
    try:
        data = request.get_json()
        if not data or 'question' not in data:
            return jsonify({
                'success': False,
                'error': '請提供查詢問題'
            }), 400
        
        user_question = data['question'].strip()
        if not user_question:
            return jsonify({
                'success': False,
                'error': '查詢問題不能為空'
            }), 400
        
        # 獲取會話ID，如果沒有提供則生成新的
        session_id = data.get('session_id', f'session_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        
        # 執行AI查詢
        result = ai_service.query_database(user_question, session_id)
        
        return jsonify(result)
        
    except Exception as e:
        logging.error(f"AI查詢錯誤: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'查詢處理失敗: {str(e)}'
        }), 500

@ai_bp.route('/status', methods=['GET'])
def ai_status():
    """檢查AI服務狀態"""
    try:
        status = ai_service.check_ollama_connection()
        return jsonify(status)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/suggestions', methods=['GET'])
def ai_suggestions():
    """獲取建議的查詢問題"""
    try:
        mode = request.args.get('mode', 'query')  # 預設為查詢模式
        suggestions = ai_service.get_suggested_questions(mode)
        return jsonify({
            'success': True,
            'suggestions': suggestions
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/models', methods=['GET'])
def get_available_models():
    """獲取可用的AI模型列表"""
    try:
        status = ai_service.check_ollama_connection()
        if status['success']:
            return jsonify({
                'success': True,
                'models': status.get('available_models', []),
                'current_model': status.get('current_model', '')
            })
        else:
            return jsonify({
                'success': False,
                'error': status.get('error', '無法連接到Ollama服務'),
                'models': []
            })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'models': []
        }), 500

@ai_bp.route('/set-model', methods=['POST'])
def set_model():
    """設定使用的AI模型"""
    try:
        data = request.get_json()
        if not data or 'model' not in data:
            return jsonify({
                'success': False,
                'error': '請提供模型名稱'
            }), 400
        
        model_name = data['model'].strip()
        if not model_name:
            return jsonify({
                'success': False,
                'error': '模型名稱不能為空'
            }), 400
        
        # 設定新模型
        ai_service.model_name = model_name
        
        # 檢查模型是否可用
        status = ai_service.check_ollama_connection()
        
        return jsonify({
            'success': True,
            'model': model_name,
            'status': status
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/conversation/clear', methods=['POST'])
def clear_conversation():
    """清除對話歷史"""
    try:
        data = request.get_json()
        session_id = data.get('session_id') if data else None
        
        ai_service.clear_conversation_history(session_id)
        
        return jsonify({
            'success': True,
            'message': '對話歷史已清除'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/conversation/summary/<session_id>', methods=['GET'])
def get_conversation_summary(session_id):
    """獲取對話摘要"""
    try:
        summary = ai_service.get_conversation_summary(session_id)
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/conversation/history/<session_id>', methods=['GET'])
def get_conversation_history(session_id):
    """獲取完整對話歷史"""
    try:
        history = ai_service._get_conversation_history(session_id)
        return jsonify({
            'success': True,
            'session_id': session_id,
            'history': history
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/chat', methods=['POST'])
def ai_chat():
    """處理一般AI聊天請求"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                'success': False,
                'error': '請提供訊息內容'
            }), 400
        
        user_message = data['message'].strip()
        if not user_message:
            return jsonify({
                'success': False,
                'error': '訊息內容不能為空'
            }), 400
        
        # 獲取會話ID和系統上下文
        session_id = data.get('session_id', f'chat_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        system_context = data.get('system_context')
        
        # 執行AI聊天
        result = ai_service.chat(user_message, session_id, system_context)
        
        return jsonify(result)
        
    except Exception as e:
        logging.error(f"AI聊天錯誤: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'聊天處理失敗: {str(e)}'
        }), 500

@ai_bp.route('/chat/history/<session_id>', methods=['GET'])
def get_chat_history(session_id):
    """獲取聊天歷史記錄"""
    try:
        limit = request.args.get('limit', default=20, type=int)
        result = ai_service.get_chat_history(session_id, limit)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@ai_bp.route('/chat/clear', methods=['POST'])
def clear_chat_history():
    """清除聊天歷史記錄"""
    try:
        data = request.get_json()
        session_id = data.get('session_id') if data else None
        
        result = ai_service.clear_chat_history(session_id)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
