import os
from flask import Flask
from flask_cors import CORS
from controllers.api_controller import api_bp
from controllers.web_controller import web_bp
from controllers.inventory_controller import inventory_api_bp
from controllers.weekly_order_controller import weekly_order_bp
from controllers.ai_controller import ai_bp
from controllers.auth_controller import auth_bp  # 新增
from controllers.user_controller import user_bp  # 使用者管理
from controllers.admin_controller import admin_bp  # 管理員控制器
from extensions import db, migrate, login_manager, socketio  # 新增 socketio
from datetime import timedelta, datetime

def create_app():
    """應用程式工廠函數"""
    app = Flask(__name__)
    app.secret_key = 'your-secret-key-here'  # 在生產環境中請使用環境變數
    
    # Configure SQLAlchemy
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hardware.db' # Use the existing database file
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Suppress warning
    
    # Configure Session
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
    app.config['SESSION_COOKIE_HTTPONLY'] = True
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

    # Jinja2 filter for datetime formatting
    @app.template_filter('datetimeformat')
    def datetimeformat(value, format='%Y-%m-%d %H:%M'):
        if not value:
            return ""
        
        if isinstance(value, str):
            # First, try to parse ISO format with 'T' separator
            try:
                if '.' in value and 'T' in value:
                    dt_obj = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%f')
                elif 'T' in value:
                    dt_obj = datetime.strptime(value, '%Y-%m-%dT%H:%M:%S')
                else:
                    # Fallback to formats with space separator
                    if '.' in value:
                        dt_obj = datetime.strptime(value, '%Y-%m-%d %H:%M:%S.%f')
                    else:
                        dt_obj = datetime.strptime(value, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                try:
                    # Fallback to date-only format
                    dt_obj = datetime.strptime(value, '%Y-%m-%d')
                except ValueError:
                    return value # Return original string if all parsing fails
            return dt_obj.strftime(format)
        
        # If it's already a date/datetime object
        if hasattr(value, 'strftime'):
            return value.strftime(format)
        
        return value
    
    # Initialize extensions
    db.init_app(app) # Initialize db with the app
    migrate.init_app(app, db) # Initialize migrate with the app and db
    
    # Initialize Flask-Login
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    login_manager.login_message = '請先登入才能訪問此頁面'
    login_manager.login_message_category = 'info'
    
    # User loader callback for Flask-Login
    @login_manager.user_loader
    def load_user(user_id):
        from models.weekly_order import User
        return User.query.get(int(user_id))
    
    # Enable Cross-Origin Resource Sharing for mobile app
    CORS(app)
    
    # Conditional blueprint registration for Alembic
    if os.environ.get("ALEMBIC_RUNNING") != "true":
        # 註冊藍圖
        app.register_blueprint(auth_bp)             # 驗證路由 (/login, /register, /logout)
        app.register_blueprint(user_bp)             # 使用者管理路由 (/users/...)
        app.register_blueprint(admin_bp)            # 管理員路由 (/admin/...)
        app.register_blueprint(api_bp)              # API 路由 (/api/...)
        app.register_blueprint(inventory_api_bp)    # 庫存 API 路由 (/api/inventory/...)
        app.register_blueprint(web_bp)              # 網頁路由 (/...)
        app.register_blueprint(weekly_order_bp)     # 週期訂單路由 (/weekly-orders/...)
        app.register_blueprint(ai_bp)               # AI 相關路由 (/ai/...)
        
        from controllers.notification_controller import notification_bp
        app.register_blueprint(notification_bp)     # 通知路由 (/notifications/...)
        
        # Import SocketIO events handler
        from controllers.online_users_controller import online_users_bp
        app.register_blueprint(online_users_bp)
        
        # Initialize SocketIO with app
        socketio.init_app(app)
    else:
        # Initialize SocketIO without registering blueprints that might load models
        # This is a minimal initialization for Alembic
        socketio.init_app(app)
        
    return app

app = create_app()

# Import models AFTER db is defined and initialized
# This avoids circular import issues when models import db
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation
from models.order import Order
from models.inventory import CurrentInventory, InventoryTransaction, StockCount, StockCountDetail
from models.work_order import WorkOrderDemand # ADD THIS LINE
from models.weekly_order import WeeklyOrderCycle, OrderRegistration, User, OrderReviewLog
from models.template import StockOutTemplate, StockOutTemplateItem  # 導入模板模型

if __name__ == '__main__':
    import os
    
    # 檢查是否有 SSL 憑證
    cert_file = 'cert.pem'
    key_file = 'cert.key'
    
    if os.path.exists(cert_file) and os.path.exists(key_file):
        # 使用 HTTPS (支援 iOS Service Worker 和相機存取)
        print("🔐 啟用 HTTPS 模式")
        print("📱 iOS 裝置現在可以使用 Service Worker 和相機功能")
        ssl_context = (cert_file, key_file)
        socketio.run(app, host='0.0.0.0', port=5005, debug=True, ssl_context=ssl_context, allow_unsafe_werkzeug=True)
    else:
        # 使用 HTTP (僅限 Android 和開發測試)
        print("⚠️  HTTP 模式 (iOS 功能受限)")
        print("💡 執行 'python generate_ssl_cert.py' 生成 SSL 憑證以啟用 HTTPS")
        socketio.run(app, host='0.0.0.0', port=5005, debug=True, allow_unsafe_werkzeug=True)
