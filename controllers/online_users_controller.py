from flask import Blueprint
from flask_socketio import emit, disconnect
from flask_login import current_user
from extensions import socketio

online_users_bp = Blueprint('online_users', __name__)

# 儲存線上用戶
online_users = {}

@socketio.on('connect')
def handle_connect():
    """處理用戶連線"""
    if current_user.is_authenticated:
        user_id = current_user.id
        username = current_user.full_name
        
        # 記錄線上用戶
        if user_id not in online_users:
            online_users[user_id] = {
                'username': username,
                'connections': 0
            }
        online_users[user_id]['connections'] += 1
        
        # 廣播線上人數更新
        emit('online_count_update', {
            'count': len(online_users),
            'users': [{'id': uid, 'username': info['username']} for uid, info in online_users.items()]
        }, broadcast=True)
        
        print(f"✅ 用戶連線: {username} (總線上: {len(online_users)})")

@socketio.on('disconnect')
def handle_disconnect():
    """處理用戶斷線"""
    if current_user.is_authenticated:
        user_id = current_user.id
        
        if user_id in online_users:
            online_users[user_id]['connections'] -= 1
            
            # 如果該用戶沒有任何連線了，移除該用戶
            if online_users[user_id]['connections'] <= 0:
                username = online_users[user_id]['username']
                del online_users[user_id]
                print(f"❌ 用戶離線: {username} (總線上: {len(online_users)})")
            
            # 廣播線上人數更新
            emit('online_count_update', {
                'count': len(online_users),
                'users': [{'id': uid, 'username': info['username']} for uid, info in online_users.items()]
            }, broadcast=True)

@socketio.on('request_online_count')
def handle_request_online_count():
    """主動請求線上人數"""
    emit('online_count_update', {
        'count': len(online_users),
        'users': [{'id': uid, 'username': info['username']} for uid, info in online_users.items()]
    })
