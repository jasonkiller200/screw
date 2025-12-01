"""
訊息通知相關資料模型
"""
from extensions import db
from datetime import datetime, timedelta, timezone

def get_taipei_time():
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)


class Notification(db.Model):
    """個人訊息通知"""
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # order_rejected, order_modified, announcement, system
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text)
    is_read = db.Column(db.Boolean, default=False, index=True)
    created_at = db.Column(db.DateTime, default=get_taipei_time, index=True)
    read_at = db.Column(db.DateTime, nullable=True)
    
    # 關聯的訂單（如果是訂單相關通知）
    order_registration_id = db.Column(db.Integer, db.ForeignKey('order_registrations.id'), nullable=True)
    
    # 關聯的公告（如果是公告通知）
    announcement_id = db.Column(db.Integer, db.ForeignKey('announcements.id'), nullable=True)
    
    # 關聯
    user = db.relationship('User', backref='notifications')
    order_registration = db.relationship('OrderRegistration', backref='notifications')
    
    def __repr__(self):
        return f'<Notification {self.id}: {self.title} for User {self.user_id}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'type': self.type,
            'title': self.title,
            'content': self.content,
            'is_read': self.is_read,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'read_at': self.read_at.strftime('%Y-%m-%d %H:%M:%S') if self.read_at else None,
            'order_registration_id': self.order_registration_id,
            'announcement_id': self.announcement_id
        }
    
    def mark_as_read(self):
        """標記為已讀"""
        if not self.is_read:
            self.is_read = True
            self.read_at = get_taipei_time()
            db.session.commit()


class Announcement(db.Model):
    """系統公告"""
    __tablename__ = 'announcements'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), default='normal')  # high, normal, low
    is_active = db.Column(db.Boolean, default=True, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=get_taipei_time, index=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    
    # 關聯
    creator = db.relationship('User', backref='created_announcements')
    notifications = db.relationship('Notification', backref='announcement', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Announcement {self.id}: {self.title}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'priority': self.priority,
            'is_active': self.is_active,
            'created_by': self.created_by,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'expires_at': self.expires_at.strftime('%Y-%m-%d %H:%M:%S') if self.expires_at else None,
            'creator_name': self.creator.username if self.creator else None
        }
    
    @property
    def is_expired(self):
        """檢查公告是否已過期"""
        if not self.expires_at:
            return False
        return get_taipei_time() > self.expires_at
    
    @property
    def is_valid(self):
        """檢查公告是否有效（啟用且未過期）"""
        return self.is_active and not self.is_expired