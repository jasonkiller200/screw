from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
from functools import wraps
from sqlalchemy import inspect
from extensions import db
from models.weekly_order import User
from models.part import Part
from models.inventory import CurrentInventory, InventoryTransaction
from models.work_order import WorkOrderDemand
from models.weekly_order import WeeklyOrderCycle, OrderRegistration
from models.notification import Notification, Announcement

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# 權限配置
PERMISSION_LEVELS = {
    'VIEW': ['User', 'Part', 'CurrentInventory', 'InventoryTransaction', 'WorkOrderDemand', 
             'WeeklyOrderCycle', 'OrderRegistration', 'Notification', 'Announcement'],
    'EDIT': ['Part', 'CurrentInventory', 'WorkOrderDemand', 'WeeklyOrderCycle', 'OrderRegistration'],
    'DELETE': ['CurrentInventory', 'WorkOrderDemand', 'OrderRegistration']
}

PROTECTED_FIELDS = {
    'User': ['password_hash'],
    'ALL': ['id', 'created_at', 'updated_at']
}

def admin_required(f):
    """管理員權限裝飾器"""
    @wraps(f)
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flash('您沒有權限訪問此頁面', 'error')
            return redirect(url_for('web.index'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/')
@admin_required
def index():
    """管理員首頁"""
    return redirect(url_for('admin.database_management'))

@admin_bp.route('/database')
@admin_required
def database_management():
    """資料庫管理主頁"""
    models_info = []
    model_classes = {
        'User': User,
        'Part': Part,
        'CurrentInventory': CurrentInventory,
        'InventoryTransaction': InventoryTransaction,
        'WorkOrderDemand': WorkOrderDemand,
        'WeeklyOrderCycle': WeeklyOrderCycle,
        'OrderRegistration': OrderRegistration,
        'Notification': Notification,
        'Announcement': Announcement
    }
    
    for name, model_class in model_classes.items():
        try:
            count = db.session.query(model_class).count()
            models_info.append({
                'name': name,
                'display_name': get_display_name(name),
                'count': count,
                'can_view': name in PERMISSION_LEVELS['VIEW'],
                'can_edit': name in PERMISSION_LEVELS['EDIT'],
                'can_delete': name in PERMISSION_LEVELS['DELETE']
            })
        except Exception as e:
            print(f"Error getting count for {name}: {e}")
    
    return render_template('admin/database_management.html', models=models_info)

def get_display_name(table_name):
    """獲取表格的顯示名稱"""
    display_names = {
        'User': '👥 使用者',
        'Part': '📦 零件',
        'CurrentInventory': '📊 當前庫存',
        'InventoryTransaction': '📋 庫存交易',
        'WorkOrderDemand': '🔧 工單需求',
        'WeeklyOrderCycle': '📅 週期訂單',
        'OrderRegistration': '📝 訂單登記',
        'Notification': '🔔 通知',
        'Announcement': '📢 公告'
    }
    return display_names.get(table_name, table_name)
