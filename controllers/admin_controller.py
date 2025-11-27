from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for, send_file, current_app
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


@admin_bp.route('/update_record/<table_name>/<int:record_id>', methods=['POST'])
@login_required
@admin_required
def update_record(table_name, record_id):
    """更新記錄"""
    import traceback
    
    try:
        # 記錄開始
        current_app.logger.info(f'=== 開始更新 {table_name} 記錄 ID: {record_id} ===')
        
        # 檢查表格權限
        if table_name not in PERMISSION_LEVELS.get('EDIT', []):
            current_app.logger.error(f'權限不足：無法編輯 {table_name}')
            return jsonify({
                'success': False,
                'message': f'沒有編輯 {table_name} 的權限'
            }), 403
        
        # 獲取模型
        model_class = get_model_by_name(table_name)
        if not model_class:
            current_app.logger.error(f'找不到模型: {table_name}')
            return jsonify({
                'success': False,
                'message': '找不到對應的資料表'
            }), 404
        
        # 查找記錄 - 使用動態主鍵查找
        try:
            # 獲取主鍵欄位名稱
            primary_key = model_class.__table__.primary_key.columns.keys()[0]
            record = db.session.query(model_class).filter(
                getattr(model_class, primary_key) == record_id
            ).first()
            
            if not record:
                current_app.logger.error(f'找不到記錄 ID: {record_id}')
                return jsonify({
                    'success': False,
                    'message': '找不到指定的記錄'
                }), 404
        except Exception as e:
            current_app.logger.error(f'查找記錄時發生錯誤: {str(e)}')
            current_app.logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'message': f'查找記錄失敗: {str(e)}'
            }), 500
        
        # 獲取提交的資料
        data = request.get_json()
        current_app.logger.info(f'收到的資料: {data}')
        
        if not data:
            current_app.logger.error('沒有收到更新資料')
            return jsonify({
                'success': False,
                'message': '沒有收到更新資料'
            }), 400
        
        # 獲取受保護欄位列表
        protected_fields = PROTECTED_FIELDS.get(table_name, [])
        protected_fields.extend(PROTECTED_FIELDS.get('ALL', []))
        current_app.logger.info(f'受保護欄位: {protected_fields}')
        
        # 更新欄位
        updated_fields = []
        for field_name, value in data.items():
            current_app.logger.info(f'處理欄位: {field_name} = {value} (類型: {type(value).__name__})')
            
            if field_name in protected_fields:
                current_app.logger.info(f'跳過受保護欄位: {field_name}')
                continue
                
            if hasattr(record, field_name):
                # 類型轉換和驗證
                try:
                    column = getattr(model_class, field_name)
                    column_type = str(column.type)
                    current_app.logger.info(f'欄位 {field_name} 資料庫類型: {column_type}')
                    
                    old_value = getattr(record, field_name)
                    
                    # 處理空值標記（前端用 '-' 表示 NULL）
                    if value == '-' or value == '' or value == 'None':
                        value = None
                    
                    # 處理不同的資料類型
                    if 'BOOLEAN' in column_type.upper():
                        value = bool(value) if isinstance(value, bool) else str(value).lower() in ['true', '1', 'yes', '是']
                    elif 'INTEGER' in column_type.upper() or 'NUMERIC' in column_type.upper():
                        if value is not None:
                            try:
                                value = float(value) if '.' in str(value) else int(value)
                            except (ValueError, TypeError):
                                # 如果轉換失敗，檢查欄位是否可為空
                                if column.nullable:
                                    value = None
                                else:
                                    raise ValueError(f'欄位 {field_name} 不可為空，且無法轉換為數字')
                    elif 'DATETIME' in column_type.upper():
                        if value and value != '-':
                            from datetime import datetime
                            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
                        else:
                            value = None
                    elif 'DATE' in column_type.upper():
                        if value and value != '-':
                            from datetime import datetime
                            value = datetime.fromisoformat(value).date()
                        else:
                            value = None
                    
                    # 設定新值
                    current_app.logger.info(f'欄位 {field_name}: {old_value} → {value}')
                    setattr(record, field_name, value)
                    updated_fields.append(field_name)
                    
                except (ValueError, TypeError) as e:
                    current_app.logger.error(f'欄位 {field_name} 轉換失敗: {str(e)}')
                    current_app.logger.error(traceback.format_exc())
                    return jsonify({
                        'success': False,
                        'message': f'欄位 {field_name} 的值格式不正確: {str(e)}'
                    }), 400
            else:
                current_app.logger.warning(f'模型沒有此欄位: {field_name}')
        
        if not updated_fields:
            current_app.logger.warning(f'沒有欄位被更新。資料: {data}, 受保護欄位: {protected_fields}')
            return jsonify({
                'success': False,
                'message': '沒有有效的欄位可以更新'
            }), 400
        
        # 儲存變更
        current_app.logger.info(f'準備提交變更，更新欄位: {updated_fields}')
        db.session.commit()
        current_app.logger.info('變更已提交成功')
        
        # 記錄操作日誌
        current_app.logger.info(f'用戶 {current_user.username} 更新了 {table_name} 記錄 ID: {record_id}, 更新欄位: {", ".join(updated_fields)}')
        
        # 返回更新後的資料
        updated_data = {}
        for field in updated_fields:
            value = getattr(record, field)
            if hasattr(value, 'isoformat'):
                updated_data[field] = value.isoformat()
            else:
                updated_data[field] = value
        
        return jsonify({
            'success': True,
            'message': f'成功更新 {len(updated_fields)} 個欄位',
            'data': updated_data
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'更新記錄錯誤 - 表格: {table_name}, ID: {record_id}, 錯誤: {str(e)}')
        import traceback
        current_app.logger.error(f'詳細錯誤: {traceback.format_exc()}')
        return jsonify({
            'success': False,
            'message': f'更新失敗: {str(e)}'
        }), 500


@admin_bp.route('/delete_record/<table_name>/<int:record_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_record(table_name, record_id):
    """刪除記錄"""
    try:
        # 檢查表格權限
        if table_name not in PERMISSION_LEVELS.get('DELETE', []):
            return jsonify({
                'success': False,
                'message': f'沒有刪除 {table_name} 的權限'
            }), 403
        
        # 獲取模型
        model_class = get_model_by_name(table_name)
        if not model_class:
            return jsonify({
                'success': False,
                'message': '找不到對應的資料表'
            }), 404
        
        # 查找記錄 - 使用動態主鍵查找
        try:
            # 獲取主鍵欄位名稱
            primary_key = model_class.__table__.primary_key.columns.keys()[0]
            record = db.session.query(model_class).filter(
                getattr(model_class, primary_key) == record_id
            ).first()
            
            if not record:
                return jsonify({
                    'success': False,
                    'message': '找不到指定的記錄'
                }), 404
        except Exception as e:
            current_app.logger.error(f'查找記錄時發生錯誤: {str(e)}')
            return jsonify({
                'success': False,
                'message': f'查找記錄失敗: {str(e)}'
            }), 500
        
        # 備份記錄資訊用於日誌
        record_info = {}
        for column in model_class.__table__.columns:
            if column.name not in PROTECTED_FIELDS.get('ALL', []):
                value = getattr(record, column.name)
                record_info[column.name] = str(value) if value is not None else 'NULL'
        
        # 刪除記錄
        db.session.delete(record)
        db.session.commit()
        
        # 記錄操作日誌
        current_app.logger.warning(f'用戶 {current_user.username} 刪除了 {table_name} 記錄 ID: {record_id}, 內容: {record_info}')
        
        return jsonify({
            'success': True,
            'message': '記錄已成功刪除'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'刪除記錄錯誤 - 表格: {table_name}, ID: {record_id}, 錯誤: {str(e)}')
        import traceback
        current_app.logger.error(f'詳細錯誤: {traceback.format_exc()}')
        return jsonify({
            'success': False,
            'message': f'刪除失敗: {str(e)}'
        }), 500


@admin_bp.route('/batch_update/<table_name>', methods=['POST'])
@login_required
@admin_required
def batch_update(table_name):
    """批量更新記錄"""
    try:
        # 檢查表格權限
        if table_name not in PERMISSION_LEVELS.get('EDIT', []):
            return jsonify({
                'success': False,
                'message': f'沒有編輯 {table_name} 的權限'
            }), 403
        
        # 獲取模型
        model_class = get_model_by_name(table_name)
        if not model_class:
            return jsonify({
                'success': False,
                'message': '找不到對應的資料表'
            }), 404
        
        # 獲取請求資料
        data = request.get_json()
        record_ids = data.get('record_ids', [])
        update_data = data.get('update_data', {})
        
        if not record_ids or not update_data:
            return jsonify({
                'success': False,
                'message': '請提供記錄ID列表和更新資料'
            }), 400
        
        # 獲取受保護欄位
        protected_fields = PROTECTED_FIELDS.get(table_name, [])
        protected_fields.extend(PROTECTED_FIELDS.get('ALL', []))
        
        # 過濾受保護欄位
        filtered_data = {k: v for k, v in update_data.items() if k not in protected_fields}
        
        if not filtered_data:
            return jsonify({
                'success': False,
                'message': '沒有可更新的欄位'
            }), 400
        
        # 批量更新 - 使用動態主鍵
        try:
            primary_key = model_class.__table__.primary_key.columns.keys()[0]
            primary_key_attr = getattr(model_class, primary_key)
            updated_count = db.session.query(model_class).filter(
                primary_key_attr.in_(record_ids)
            ).update(filtered_data, synchronize_session=False)
        except Exception as e:
            current_app.logger.error(f'批量更新時發生錯誤: {str(e)}')
            return jsonify({
                'success': False,
                'message': f'批量更新失敗: {str(e)}'
            }), 500
        
        db.session.commit()
        
        # 記錄操作日誌
        current_app.logger.info(f'用戶 {current_user.username} 批量更新了 {updated_count} 筆 {table_name} 記錄')
        
        return jsonify({
            'success': True,
            'message': f'成功更新 {updated_count} 筆記錄'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'批量更新錯誤: {str(e)}')
        return jsonify({
            'success': False,
            'message': f'批量更新失敗: {str(e)}'
        }), 500


@admin_bp.route('/batch_delete/<table_name>', methods=['POST'])
@login_required
@admin_required
def batch_delete(table_name):
    """批量刪除記錄"""
    try:
        # 檢查表格權限
        if table_name not in PERMISSION_LEVELS.get('DELETE', []):
            return jsonify({
                'success': False,
                'message': f'沒有刪除 {table_name} 的權限'
            }), 403
        
        # 獲取模型
        model_class = get_model_by_name(table_name)
        if not model_class:
            return jsonify({
                'success': False,
                'message': '找不到對應的資料表'
            }), 404
        
        # 獲取記錄ID列表
        data = request.get_json()
        record_ids = data.get('record_ids', [])
        
        if not record_ids:
            return jsonify({
                'success': False,
                'message': '請提供要刪除的記錄ID列表'
            }), 400
        
        # 批量刪除 - 使用動態主鍵
        try:
            primary_key = model_class.__table__.primary_key.columns.keys()[0]
            primary_key_attr = getattr(model_class, primary_key)
            deleted_count = db.session.query(model_class).filter(
                primary_key_attr.in_(record_ids)
            ).delete(synchronize_session=False)
        except Exception as e:
            current_app.logger.error(f'批量刪除時發生錯誤: {str(e)}')
            return jsonify({
                'success': False,
                'message': f'批量刪除失敗: {str(e)}'
            }), 500
        
        db.session.commit()
        
        # 記錄操作日誌
        current_app.logger.warning(f'用戶 {current_user.username} 批量刪除了 {deleted_count} 筆 {table_name} 記錄')
        
        return jsonify({
            'success': True,
            'message': f'成功刪除 {deleted_count} 筆記錄'
        })
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f'批量刪除錯誤: {str(e)}')
        return jsonify({
            'success': False,
            'message': f'批量刪除失敗: {str(e)}'
        }), 500


def get_model_by_name(table_name):
    """根據表格名稱獲取模型類別"""
    try:
        # 直接從已載入的模組中獲取模型
        import sys
        
        # 檢查模型是否已經在 sys.modules 中
        model_paths = {
            'User': 'models.weekly_order.User',
            'Part': 'models.part.Part',
            'CurrentInventory': 'models.inventory.CurrentInventory',
            'InventoryTransaction': 'models.inventory.InventoryTransaction', 
            'WorkOrderDemand': 'models.work_order.WorkOrderDemand',
            'WeeklyOrderCycle': 'models.weekly_order.WeeklyOrderCycle',
            'OrderRegistration': 'models.weekly_order.OrderRegistration',
            'Notification': 'models.notification.Notification',
            'Announcement': 'models.notification.Announcement'
        }
        
        if table_name not in model_paths:
            current_app.logger.error(f'Unknown table name: {table_name}')
            return None
            
        model_path = model_paths[table_name]
        module_name, class_name = model_path.rsplit('.', 1)
        
        # 檢查模組是否已載入
        if module_name in sys.modules:
            module = sys.modules[module_name]
            if hasattr(module, class_name):
                return getattr(module, class_name)
        
        # 如果模組未載入，嘗試導入
        try:
            module = __import__(module_name, fromlist=[class_name])
            return getattr(module, class_name)
        except ImportError as ie:
            current_app.logger.error(f'Failed to import {model_path}: {str(ie)}')
            return None
        
    except Exception as e:
        current_app.logger.error(f'Error getting model {table_name}: {str(e)}')
        import traceback
        current_app.logger.error(f'Traceback: {traceback.format_exc()}')
        return None

