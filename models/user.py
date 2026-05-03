"""
使用者資料模型 (User Model)
全域核心模型，供所有 Blueprint 和 Service 使用
"""

from extensions import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from utils.datetime_utils import get_taipei_time


class User(UserMixin, db.Model):
    """用戶表"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False, unique=True, index=True, comment='用戶名')
    email = db.Column(db.String(100), nullable=True, unique=True, index=True, comment='Email')
    full_name = db.Column(db.String(100), nullable=False, comment='全名')
    department = db.Column(db.String(100), nullable=True, comment='部門')
    role = db.Column(db.String(20), nullable=False, default='user', comment='角色')
    password_hash = db.Column(db.String(256), nullable=True, comment='密碼雜湊')
    is_active = db.Column(db.Boolean, default=True, comment='是否啟用')
    last_login = db.Column(db.DateTime, nullable=True, comment='最後登入時間')
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    updated_at = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)
    
    def __repr__(self):
        return f'<User {self.username}: {self.full_name}>'
    
    def set_password(self, password):
        """設定密碼"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """驗證密碼"""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)
    
    def has_role(self, *roles):
        """檢查使用者是否擁有特定角色"""
        return self.role in roles
    
    @property
    def is_admin(self):
        """是否為管理員"""
        return self.role == 'admin'
    
    def to_dict(self, include_sensitive=False):
        data = {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'department': self.department,
            'role': self.role,
            'is_active': self.is_active,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_sensitive:
            data['has_password'] = bool(self.password_hash)
        return data
