from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
from functools import wraps
from extensions import db
from models.weekly_order import User
from datetime import datetime

user_bp = Blueprint('user', __name__, url_prefix='/users')

def admin_required(f):
    """裝飾器：要求管理員權限"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flash('需要管理員權限才能訪問此頁面', 'danger')
            return redirect(url_for('web.index'))
        return f(*args, **kwargs)
    return decorated_function


@user_bp.route('/manage')
@admin_required
def manage_users():
    """使用者管理頁面"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    role_filter = request.args.get('role', '').strip()
    status_filter = request.args.get('status', '').strip()
    
    query = User.query
    
    # 搜尋條件
    if search:
        query = query.filter(
            db.or_(
                User.username.ilike(f'%{search}%'),
                User.full_name.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%'),
                User.department.ilike(f'%{search}%')
            )
        )
    
    # 角色篩選
    if role_filter:
        query = query.filter(User.role == role_filter)
    
    # 狀態篩選
    if status_filter == 'active':
        query = query.filter(User.is_active == True)
    elif status_filter == 'inactive':
        query = query.filter(User.is_active == False)
    
    # 排序與分頁
    query = query.order_by(User.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    users = pagination.items
    
    return render_template('users/manage.html',
                         users=users,
                         pagination=pagination,
                         search=search,
                         role_filter=role_filter,
                         status_filter=status_filter)


@user_bp.route('/api/list')
@admin_required
def api_list_users():
    """API：獲取使用者列表"""
    try:
        users = User.query.order_by(User.created_at.desc()).all()
        return jsonify({
            'success': True,
            'users': [user.to_dict() for user in users]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@user_bp.route('/api/create', methods=['POST'])
@admin_required
def api_create_user():
    """API：創建新使用者"""
    try:
        data = request.get_json()
        
        # 驗證必填欄位
        if not data.get('username'):
            return jsonify({'success': False, 'message': '使用者名稱為必填'}), 400
        if not data.get('full_name'):
            return jsonify({'success': False, 'message': '全名為必填'}), 400
        if not data.get('password'):
            return jsonify({'success': False, 'message': '密碼為必填'}), 400
        if not data.get('department'):
            return jsonify({'success': False, 'message': '部門為必填'}), 400
        
        # 檢查使用者名稱是否已存在
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'success': False, 'message': '使用者名稱已存在'}), 400
        
        # 檢查 email 是否已存在
        if data.get('email') and User.query.filter_by(email=data['email']).first():
            return jsonify({'success': False, 'message': 'Email 已被使用'}), 400
        
        # 創建新使用者
        user = User(
            username=data['username'],
            email=data.get('email'),
            full_name=data['full_name'],
            department=data.get('department'),
            role=data.get('role', 'user'),
            is_active=data.get('is_active', True)
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '使用者創建成功',
            'user': user.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@user_bp.route('/api/<int:user_id>', methods=['PUT'])
@admin_required
def api_update_user(user_id):
    """API：更新使用者資訊"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        # 檢查使用者名稱是否被其他使用者使用
        if data.get('username') and data['username'] != user.username:
            if User.query.filter_by(username=data['username']).first():
                return jsonify({'success': False, 'message': '使用者名稱已存在'}), 400
        
        # 檢查 email 是否被其他使用者使用
        if data.get('email') and data['email'] != user.email:
            if User.query.filter_by(email=data['email']).first():
                return jsonify({'success': False, 'message': 'Email 已被使用'}), 400
        
        # 更新欄位
        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        if 'full_name' in data:
            user.full_name = data['full_name']
        if 'department' in data:
            user.department = data['department']
        if 'role' in data:
            user.role = data['role']
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '使用者資訊更新成功',
            'user': user.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@user_bp.route('/api/<int:user_id>/toggle-status', methods=['POST'])
@admin_required
def api_toggle_user_status(user_id):
    """API：切換使用者啟用狀態"""
    try:
        user = User.query.get_or_404(user_id)
        
        # 防止停用自己
        if user.id == current_user.id:
            return jsonify({'success': False, 'message': '不能停用自己的帳號'}), 400
        
        user.is_active = not user.is_active
        db.session.commit()
        
        status_text = '啟用' if user.is_active else '停用'
        return jsonify({
            'success': True,
            'message': f'使用者已{status_text}',
            'is_active': user.is_active
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@user_bp.route('/api/<int:user_id>/reset-password', methods=['POST'])
@admin_required
def api_reset_password(user_id):
    """API：重置使用者密碼"""
    try:
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if not data.get('new_password'):
            return jsonify({'success': False, 'message': '請輸入新密碼'}), 400
        
        user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': '密碼重置成功'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@user_bp.route('/api/<int:user_id>', methods=['DELETE'])
@admin_required
def api_delete_user(user_id):
    """API：刪除使用者（真正從資料庫中移除）"""
    try:
        user = User.query.get_or_404(user_id)
        
        # 防止刪除自己
        if user.id == current_user.id:
            return jsonify({'success': False, 'message': '不能刪除自己的帳號'}), 400
        
        # 防止刪除管理員
        if user.is_admin:
            return jsonify({'success': False, 'message': '不能刪除管理員帳號'}), 400
        
        # 真正從資料庫中刪除使用者
        username = user.username
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'使用者「{username}」已永久刪除'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
