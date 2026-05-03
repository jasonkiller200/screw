"""
驗證服務 (Authentication Service)
處理使用者登入、註冊、密碼驗證等功能
"""

from werkzeug.security import generate_password_hash, check_password_hash
from models.user import User
from utils.datetime_utils import get_taipei_time
from extensions import db
import re


class AuthService:
    
    @staticmethod
    def authenticate_user(username, password):
        """
        驗證使用者登入
        
        Args:
            username: 使用者名稱
            password: 密碼
            
        Returns:
            dict: {'success': bool, 'message': str, 'user': User}
        """
        user = User.query.filter_by(username=username, is_active=True).first()
        
        if not user or not user.password_hash:
            return {'success': False, 'message': '帳號或密碼錯誤'}
        
        if not check_password_hash(user.password_hash, password):
            return {'success': False, 'message': '帳號或密碼錯誤'}
        
        # 更新最後登入時間
        user.last_login = get_taipei_time()
        db.session.commit()
        
        return {'success': True, 'user': user, 'message': '登入成功'}
    
    @staticmethod
    def register_user(username, password, password_confirm, email, full_name, department=None):
        """
        使用者註冊
        
        Args:
            username: 使用者名稱
            password: 密碼
            password_confirm: 確認密碼
            email: Email
            full_name: 真實姓名
            department: 部門
            
        Returns:
            dict: {'success': bool, 'message': str, 'user': User}
        """
        # 驗證輸入
        if not username or not password or not full_name:
            return {'success': False, 'message': '使用者名稱、密碼和姓名為必填項目'}
        
        if not department:
            return {'success': False, 'message': '部門為必填項目'}
        
        # 驗證使用者名稱格式
        is_valid, message = AuthService.validate_username(username)
        if not is_valid:
            return {'success': False, 'message': message}
        
        # 驗證密碼確認
        if password != password_confirm:
            return {'success': False, 'message': '兩次輸入的密碼不一致'}
        
        # 驗證密碼強度
        is_valid, message = AuthService.validate_password(password)
        if not is_valid:
            return {'success': False, 'message': message}
        
        # 檢查使用者名稱是否已存在
        if User.query.filter_by(username=username).first():
            return {'success': False, 'message': '使用者名稱已存在'}
        
        # 檢查 Email 是否已存在
        if email and User.query.filter_by(email=email).first():
            return {'success': False, 'message': 'Email 已被使用'}
        
        try:
            # 檢查是否為首位使用者（首位自動成為管理員）
            user_count = User.query.count()
            role = 'admin' if user_count == 0 else 'user'
            
            # 建立新使用者
            user = User(
                username=username,
                email=email,
                full_name=full_name,
                department=department,
                role=role,
                is_active=True  # 開放式註冊，立即啟用
            )
            user.set_password(password)
            
            db.session.add(user)
            db.session.commit()
            
            success_message = '註冊成功！請使用您的帳號密碼登入'
            if role == 'admin':
                success_message += '（您是第一位註冊者，已自動設為管理員）'
            
            return {
                'success': True, 
                'user': user,
                'message': success_message
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'註冊失敗：{str(e)}'}
    
    @staticmethod
    def validate_username(username):
        """
        驗證使用者名稱格式
        
        規則：3-20個字元，只能包含英文、數字和底線
        """
        if not username:
            return False, '使用者名稱不能為空'
        
        if len(username) < 3 or len(username) > 20:
            return False, '使用者名稱必須是3-20個字元'
        
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return False, '使用者名稱只能包含英文、數字和底線'
        
        return True, ''
    
    @staticmethod
    def validate_password(password):
        """
        驗證密碼強度
        
        規則：
        - 至少 8 個字元
        - 必須包含英文字母和數字
        """
        if len(password) < 8:
            return False, "密碼長度必須至少為 8 個字元。"
        if not re.search(r'[a-zA-Z]', password):
            return False, "密碼必須包含至少一個英文字母。"
        if not re.search(r'[0-9]', password):
            return False, "密碼必須包含至少一個數字。"
        
        return True, ''
    
    @staticmethod
    def create_user(username, password, full_name, **kwargs):
        """
        管理員建立使用者（內部使用）
        
        Args:
            username: 使用者名稱
            password: 密碼
            full_name: 真實姓名
            **kwargs: 其他欄位
            
        Returns:
            dict: {'success': bool, 'message': str, 'user': User}
        """
        if User.query.filter_by(username=username).first():
            return {'success': False, 'message': '使用者名稱已存在'}
        
        try:
            user = User(
                username=username,
                full_name=full_name,
                **kwargs
            )
            user.set_password(password)
            
            db.session.add(user)
            db.session.commit()
            return {'success': True, 'user': user, 'message': '使用者建立成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'建立失敗：{str(e)}'}
    
    @staticmethod
    def change_password(user, old_password, new_password, new_password_confirm):
        """
        修改密碼
        
        Args:
            user: User 物件
            old_password: 舊密碼
            new_password: 新密碼
            new_password_confirm: 確認新密碼
            
        Returns:
            dict: {'success': bool, 'message': str}
        """
        # 驗證舊密碼
        if not user.check_password(old_password):
            return {'success': False, 'message': '舊密碼錯誤'}
        
        # 驗證新密碼確認
        if new_password != new_password_confirm:
            return {'success': False, 'message': '兩次輸入的新密碼不一致'}
        
        # 驗證新密碼強度
        is_valid, message = AuthService.validate_password(new_password)
        if not is_valid:
            return {'success': False, 'message': message}
        
        try:
            user.set_password(new_password)
            db.session.commit()
            return {'success': True, 'message': '密碼修改成功'}
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'密碼修改失敗：{str(e)}'}
    
    @staticmethod
    def log_logout(user_id):
        """
        記錄登出事件（可選：未來可擴展為審計日誌）
        
        Args:
            user_id: 使用者 ID
        """
        # TODO: 可以在此記錄登出事件到 audit log
        pass
