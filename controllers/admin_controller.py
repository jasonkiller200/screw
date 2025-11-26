from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, send_file
import io
import pandas as pd
from datetime import datetime
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

@admin_bp.route('/table/<table_name>')
@admin_required
def view_table(table_name):
    """查看指定表格的資料"""
    if table_name not in PERMISSION_LEVELS['VIEW']:
        flash('您沒有權限查看此表格', 'error')
        return redirect(url_for('admin.database_management'))
    
    # 分頁參數
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '', type=str)
    sort_by = request.args.get('sort_by', 'id', type=str)
    sort_order = request.args.get('sort_order', 'asc', type=str)
    
    # 獲取模型類
    model_class = get_model_class(table_name)
    if not model_class:
        flash('找不到指定的表格', 'error')
        return redirect(url_for('admin.database_management'))
    
    # 建立查詢
    query = db.session.query(model_class)
    
    # 搜尋功能
    if search:
        search_filters = []
        columns = get_table_columns(model_class)
        
        for column in columns:
            if not column['protected']:
                column_attr = getattr(model_class, column['name'], None)
                if column_attr is not None:
                    try:
                        column_type = str(column['type']).lower()
                        
                        # 文字類型欄位 - 使用 LIKE 搜尋
                        if any(t in column_type for t in ['varchar', 'text', 'string', 'char']):
                            search_filters.append(column_attr.like(f'%{search}%'))
                        
                        # 數字類型欄位 - 精確匹配
                        elif any(t in column_type for t in ['integer', 'float', 'decimal', 'numeric']):
                            try:
                                # 嘗試將搜尋詞轉換為數字
                                if '.' in search:
                                    search_num = float(search)
                                else:
                                    search_num = int(search)
                                search_filters.append(column_attr == search_num)
                            except ValueError:
                                # 如果無法轉換為數字，跳過此欄位
                                pass
                        
                        # 布林類型欄位
                        elif 'boolean' in column_type:
                            search_lower = search.lower()
                            if search_lower in ['true', '是', 'yes', '1']:
                                search_filters.append(column_attr == True)
                            elif search_lower in ['false', '否', 'no', '0']:
                                search_filters.append(column_attr == False)
                        
                        # 日期時間類型欄位 - 轉換為文字後搜尋
                        elif any(t in column_type for t in ['datetime', 'timestamp', 'date']):
                            # 使用 CAST 將日期轉換為文字進行搜尋
                            from sqlalchemy import cast, String
                            search_filters.append(cast(column_attr, String).like(f'%{search}%'))
                            
                    except Exception as e:
                        # 如果某個欄位搜尋失敗，跳過並繼續
                        print(f"搜尋欄位 {column['name']} 時發生錯誤: {e}")
                        continue
        
        if search_filters:
            from sqlalchemy import or_
            query = query.filter(or_(*search_filters))
            print(f"搜尋 '{search}' 在 {table_name} 表格中，找到 {len(search_filters)} 個可搜尋欄位")
        else:
            print(f"搜尋 '{search}' 在 {table_name} 表格中，沒有找到匹配的搜尋欄位")
    
    # 排序功能
    if hasattr(model_class, sort_by):
        sort_column = getattr(model_class, sort_by)
        if sort_order == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())
    
    # 分頁
    try:
        pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
    except Exception as e:
        flash(f'查詢資料時發生錯誤：{str(e)}', 'error')
        return redirect(url_for('admin.database_management'))
    
    # 獲取欄位資訊
    columns = get_table_columns(model_class)
    
    # 將查詢結果轉換為字典格式，便於模板使用
    items_dict = []
    for item in pagination.items:
        item_dict = {}
        for column in columns:
            item_dict[column['name']] = getattr(item, column['name'], None)
        items_dict.append(item_dict)
    
    # 更新分頁對象的items
    pagination.items = items_dict
    
    return render_template('admin/table_view.html', 
                         table_name=table_name,
                         display_name=get_display_name(table_name),
                         columns=columns,
                         pagination=pagination,
                         search=search,
                         sort_by=sort_by,
                         sort_order=sort_order,
                         can_edit=table_name in PERMISSION_LEVELS['EDIT'],
                         can_delete=table_name in PERMISSION_LEVELS['DELETE'])

@admin_bp.route('/export/<table_name>')
@admin_required
def export_table(table_name):
    """匯出表格資料為Excel"""
    if table_name not in PERMISSION_LEVELS['VIEW']:
        flash('您沒有權限匯出此表格', 'error')
        return redirect(url_for('admin.database_management'))
    
    # 獲取模型類
    model_class = get_model_class(table_name)
    if not model_class:
        flash('找不到指定的表格', 'error')
        return redirect(url_for('admin.database_management'))
    
    # 獲取所有資料
    try:
        records = db.session.query(model_class).all()
        columns = get_table_columns(model_class)
        
        # 準備資料
        data = []
        for record in records:
            row = {}
            for column in columns:
                if not column['protected']:
                    value = getattr(record, column['name'], None)
                    if value is not None:
                        # 處理日期時間格式
                        if hasattr(value, 'strftime'):
                            value = value.strftime('%Y-%m-%d %H:%M:%S')
                    row[column['name']] = value
            data.append(row)
        
        # 建立Excel文件
        df = pd.DataFrame(data)
        
        # 建立內存中的Excel文件
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=table_name, index=False)
        
        output.seek(0)
        
        # 生成檔案名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'{get_display_name(table_name)}_{timestamp}.xlsx'
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        flash(f'匯出資料時發生錯誤：{str(e)}', 'error')
        return redirect(url_for('admin.view_table', table_name=table_name))

def get_model_class(table_name):
    """根據表格名稱獲取模型類"""
    model_mapping = {
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
    return model_mapping.get(table_name)

def get_table_columns(model_class):
    """獲取表格的欄位資訊"""
    inspector = inspect(model_class)
    columns = []
    
    for column in inspector.columns:
        column_info = {
            'name': column.name,
            'type': str(column.type),
            'nullable': column.nullable,
            'primary_key': column.primary_key,
            'protected': column.name in PROTECTED_FIELDS.get(model_class.__name__, []) or 
                        column.name in PROTECTED_FIELDS.get('ALL', [])
        }
        columns.append(column_info)
    
    return columns

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

