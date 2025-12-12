"""
訊息通知控制器
"""
from flask import Blueprint, request, jsonify, render_template, flash, redirect, url_for
from flask_login import login_required, current_user
from extensions import db
from services.notification_service import NotificationService, AnnouncementService
from controllers.user_controller import admin_required
from datetime import datetime

notification_bp = Blueprint('notification', __name__, url_prefix='/notifications')


@notification_bp.route('/api/unread-count')
def api_unread_count():
    """獲取未讀通知數量 API"""
    if not current_user.is_authenticated:
        return jsonify({'error': '用戶未認證', 'unread_count': 0}), 401
    count = NotificationService.get_unread_count(current_user.id)
    return jsonify({'unread_count': count})


@notification_bp.route('/api/list')
def api_list():
    """獲取通知列表 API"""
    if not current_user.is_authenticated:
        return jsonify({'error': '用戶未認證', 'notifications': []}), 401
    
    limit = request.args.get('limit', 20, type=int)
    only_unread = request.args.get('unread', False, type=bool)
    
    notifications = NotificationService.get_user_notifications(
        current_user.id, 
        limit=limit, 
        only_unread=only_unread
    )
    print(f"DEBUG: api_list - only_unread: {only_unread}, notifications count: {len(notifications)}")
    # for n in notifications:
    #     print(f"DEBUG: Notification ID: {n['id']}, Title: {n['title']}, Is Read: {n['is_read']}")
    
    return jsonify({'notifications': notifications})


@notification_bp.route('/api/mark-read/<int:notification_id>', methods=['POST'])
@login_required
def api_mark_read(notification_id):
    """標記單個通知為已讀"""
    success, message = NotificationService.mark_as_read(notification_id, current_user.id)
    
    return jsonify({
        'success': success,
        'message': message
    })


@notification_bp.route('/api/mark-all-read', methods=['POST'])
@login_required
def api_mark_all_read():
    """標記所有通知為已讀"""
    success, message = NotificationService.mark_all_as_read(current_user.id)
    
    return jsonify({
        'success': success,
        'message': message
    })


@notification_bp.route('/api/delete/<int:notification_id>', methods=['DELETE'])
@login_required
def api_delete(notification_id):
    """刪除通知"""
    success, message = NotificationService.delete_notification(notification_id, current_user.id)
    
    return jsonify({
        'success': success,
        'message': message
    })



@notification_bp.route('/announcements')
@admin_required
def announcements():
    """公告管理頁面"""
    announcements = AnnouncementService.get_all_announcements()
    return render_template('notifications/announcements.html', announcements=announcements)


@notification_bp.route('/announcements/create', methods=['GET', 'POST'])
@admin_required
def create_announcement():
    """創建公告"""
    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        content = request.form.get('content', '').strip()
        priority = request.form.get('priority', 'normal')
        expires_at_str = request.form.get('expires_at', '').strip()
        
        if not title or not content:
            flash('標題和內容不能為空', 'error')
            return render_template('notifications/create_announcement.html')
        
        expires_at = None
        if expires_at_str:
            try:
                expires_at = datetime.strptime(expires_at_str, '%Y-%m-%dT%H:%M')
            except ValueError:
                flash('過期時間格式不正確', 'error')
                return render_template('notifications/create_announcement.html')
        
        success, announcement, message = AnnouncementService.create_announcement(
            title=title,
            content=content,
            created_by=current_user.id,
            priority=priority,
            expires_at=expires_at
        )
        
        if success:
            flash(f'公告創建成功！{message}', 'success')
            return redirect(url_for('notification.announcements'))
        else:
            flash(f'公告創建失敗：{message}', 'error')
    
    return render_template('notifications/create_announcement.html')


@notification_bp.route('/api/announcements/<int:announcement_id>/toggle', methods=['POST'])
@admin_required
def toggle_announcement(announcement_id):
    """停用/啟用公告"""
    from models.notification import Announcement
    
    announcement = Announcement.query.get_or_404(announcement_id)
    announcement.is_active = not announcement.is_active
    
    try:
        db.session.commit()
        action = '啟用' if announcement.is_active else '停用'
        return jsonify({'success': True, 'message': f'公告已{action}'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500


@notification_bp.route('/api/announcements/active')
def api_active_announcements():
    """獲取活躍公告 API（不需要登入）"""
    announcements = AnnouncementService.get_active_announcements()
    return jsonify({'announcements': announcements})