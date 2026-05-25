"""
驗證控制器 (Authentication Controller)
處理登入、註冊、登出相關路由
"""

from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from models.user import User
from services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """登入頁面"""
    # 如果已登入，導向首頁
    if current_user.is_authenticated:
        return redirect(url_for('web.index'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        remember = request.form.get('remember') == 'on'
        
        # 驗證使用者
        result = AuthService.authenticate_user(username, password)
        
        if result['success']:
            # 登入成功
            login_user(result['user'], remember=remember)
            flash(f'歡迎回來，{result["user"].full_name}！', 'success')
            
            # 處理 next 參數（登入後導向原本要訪問的頁面）
            next_page = request.args.get('next')
            if next_page and next_page.startswith('/'):
                return redirect(next_page)
            return redirect(url_for('web.index'))
        else:
            # 登入失敗
            flash(result['message'], 'error')
    
    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """註冊頁面"""
    # 如果已登入，導向首頁
    if current_user.is_authenticated:
        return redirect(url_for('web.index'))
    
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')
        email = request.form.get('email', '').strip() or None
        full_name = request.form.get('full_name', '').strip()
        department = request.form.get('department', '').strip() or None
        
        # 註冊使用者
        result = AuthService.register_user(
            username=username,
            password=password,
            password_confirm=password_confirm,
            email=email,
            full_name=full_name,
            department=department
        )
        
        if result['success']:
            flash(result['message'], 'success')
            return redirect(url_for('auth.login'))
        else:
            flash(result['message'], 'error')
    
    return render_template('auth/register.html')


@auth_bp.route('/logout')
@login_required
def logout():
    """登出"""
    AuthService.log_logout(current_user.id)
    logout_user()
    flash('您已成功登出', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/logout-silent', methods=['POST'])
@login_required
def logout_silent():
    """靜默登出（當瀏覽器關閉時）"""
    try:
        AuthService.log_logout(current_user.id)
        logout_user()
        return '', 204  # 返回空響應
    except Exception:
        return '', 204  # 即使發生錯誤也返回成功，避免前端報錯


@auth_bp.route('/change-password', methods=['GET', 'POST'])
@login_required
def change_password():
    """修改密碼"""
    if request.method == 'POST':
        old_password = request.form.get('old_password', '')
        new_password = request.form.get('new_password', '')
        new_password_confirm = request.form.get('new_password_confirm', '')
        
        result = AuthService.change_password(
            user=current_user,
            old_password=old_password,
            new_password=new_password,
            new_password_confirm=new_password_confirm
        )
        
        if result['success']:
            flash(result['message'], 'success')
            return redirect(url_for('web.index'))
        else:
            flash(result['message'], 'error')
    
    return render_template('auth/change_password.html')
