"""
訊息通知服務
"""
from extensions import db
from models.notification import Notification, Announcement
from models.weekly_order import User
from datetime import datetime, timedelta, timezone

def get_taipei_time():
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)


class NotificationService:
    """訊息通知服務類"""
    
    @staticmethod
    def create_notification(user_id, notification_type, title, content=None, 
                          order_registration_id=None, announcement_id=None):
        """創建單個通知"""
        try:
            notification = Notification(
                user_id=user_id,
                type=notification_type,
                title=title,
                content=content,
                order_registration_id=order_registration_id,
                announcement_id=announcement_id,
                created_at=get_taipei_time()
            )
            
            db.session.add(notification)
            db.session.commit()
            return True, notification
            
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    @staticmethod
    def create_order_rejection_notification(order_registration):
        """創建訂單拒絕通知"""
        title = f"週期訂單申請被拒絕"
        content = f"您的週期訂單申請（申請日期：{order_registration.created_at.strftime('%Y-%m-%d')}）已被拒絕。"
        
        if hasattr(order_registration, 'rejection_reason') and order_registration.rejection_reason:
            content += f"拒絕原因：{order_registration.rejection_reason}"
        
        return NotificationService.create_notification(
            user_id=order_registration.user_id,
            notification_type='order_rejected',
            title=title,
            content=content,
            order_registration_id=order_registration.id
        )
    
    @staticmethod
    def create_announcement_notifications(announcement_id):
        """為所有用戶創建公告通知"""
        try:
            announcement = Announcement.query.get(announcement_id)
            if not announcement:
                return False, "公告不存在"
            
            # 獲取所有活躍用戶
            users = User.query.filter_by(is_active=True).all()
            created_count = 0
            
            for user in users:
                # 跳過創建者本身
                if user.id == announcement.created_by:
                    continue
                    
                success, _ = NotificationService.create_notification(
                    user_id=user.id,
                    notification_type='announcement',
                    title=f"系統公告：{announcement.title}",
                    content=announcement.content,
                    announcement_id=announcement_id
                )
                
                if success:
                    created_count += 1
            
            return True, f"已為 {created_count} 位用戶創建公告通知"
            
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def get_user_notifications(user_id, limit=20, only_unread=False):
        """獲取用戶通知列表"""
        query = Notification.query.filter_by(user_id=user_id)
        
        if only_unread:
            query = query.filter_by(is_read=False)
        
        notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
        return [notification.to_dict() for notification in notifications]
    
    @staticmethod
    def get_unread_count(user_id):
        """獲取用戶未讀通知數量"""
        return Notification.query.filter_by(user_id=user_id, is_read=False).count()
    
    @staticmethod
    def mark_as_read(notification_id, user_id=None):
        """標記通知為已讀"""
        query = Notification.query.filter_by(id=notification_id)
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        notification = query.first()
        
        if not notification:
            return False, "通知不存在"
        
        if notification.is_read:
            return True, "通知已經是已讀狀態"
        
        try:
            notification.is_read = True
            notification.read_at = get_taipei_time()
            db.session.commit()
            return True, "已標記為已讀"
            
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    @staticmethod
    def mark_all_as_read(user_id):
        """標記用戶所有通知為已讀"""
        try:
            unread_notifications = Notification.query.filter_by(
                user_id=user_id, 
                is_read=False
            ).all()
            
            count = 0
            read_time = get_taipei_time()
            
            for notification in unread_notifications:
                notification.is_read = True
                notification.read_at = read_time
                count += 1
            
            db.session.commit()
            return True, f"已標記 {count} 個通知為已讀"
            
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    @staticmethod
    def delete_notification(notification_id, user_id=None):
        """刪除通知"""
        query = Notification.query.filter_by(id=notification_id)
        
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        notification = query.first()
        
        if not notification:
            return False, "通知不存在"
        
        try:
            db.session.delete(notification)
            db.session.commit()
            return True, "通知已刪除"
            
        except Exception as e:
            db.session.rollback()
            return False, str(e)


class AnnouncementService:
    """公告服務類"""
    
    @staticmethod
    def create_announcement(title, content, created_by, priority='normal', expires_at=None):
        """創建公告"""
        try:
            announcement = Announcement(
                title=title,
                content=content,
                priority=priority,
                created_by=created_by,
                expires_at=expires_at,
                created_at=get_taipei_time()
            )
            
            db.session.add(announcement)
            db.session.flush()  # 獲取 ID
            
            # 為所有用戶創建通知
            success, message = NotificationService.create_announcement_notifications(announcement.id)
            
            if success:
                db.session.commit()
                return True, announcement, message
            else:
                db.session.rollback()
                return False, None, message
                
        except Exception as e:
            db.session.rollback()
            return False, None, str(e)
    
    @staticmethod
    def get_active_announcements(limit=10):
        """獲取活躍公告"""
        now = get_taipei_time()
        announcements = Announcement.query.filter(
            Announcement.is_active == True,
            db.or_(
                Announcement.expires_at.is_(None),
                Announcement.expires_at > now
            )
        ).order_by(
            Announcement.priority.desc(),
            Announcement.created_at.desc()
        ).limit(limit).all()
        
        return [announcement.to_dict() for announcement in announcements]
    
    @staticmethod
    def get_all_announcements(limit=50):
        """獲取所有公告（管理員用）"""
        announcements = Announcement.query.order_by(
            Announcement.created_at.desc()
        ).limit(limit).all()
        
        return [announcement.to_dict() for announcement in announcements]