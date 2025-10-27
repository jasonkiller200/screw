from flask import Flask
from flask_cors import CORS
from controllers.api_controller import api_bp
from controllers.web_controller import web_bp
from controllers.inventory_controller import inventory_api_bp
from controllers.weekly_order_controller import weekly_order_bp
from controllers.ai_controller import ai_bp
from extensions import db, migrate # Import from extensions

def create_app():
    """應用程式工廠函數"""
    app = Flask(__name__)
    app.secret_key = 'your-secret-key-here'  # 在生產環境中請使用環境變數
    
    # Configure SQLAlchemy
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hardware.db' # Use the existing database file
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Suppress warning
    
    db.init_app(app) # Initialize db with the app
    migrate.init_app(app, db) # Initialize migrate with the app and db
    
    # Enable Cross-Origin Resource Sharing for mobile app
    CORS(app)
    
    # 註冊藍圖
    app.register_blueprint(api_bp)              # API 路由 (/api/...)
    app.register_blueprint(inventory_api_bp)    # 庫存 API 路由 (/api/inventory/...)
    app.register_blueprint(web_bp)              # 網頁路由 (/...)
    app.register_blueprint(weekly_order_bp)     # 週期訂單路由 (/weekly-orders/...)
    app.register_blueprint(ai_bp)               # AI 查詢路由 (/ai/...)
    
    return app

app = create_app()

# Import models AFTER db is defined and initialized
# This avoids circular import issues when models import db
from models.part import Part, Warehouse, WarehouseLocation, PartWarehouseLocation
from models.order import Order
from models.inventory import CurrentInventory, InventoryTransaction, StockCount, StockCountDetail
from models.work_order import WorkOrderDemand # ADD THIS LINE
from models.weekly_order import WeeklyOrderCycle, OrderRegistration, User, OrderReviewLog

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
        app.run(host='0.0.0.0', port=5005, debug=True, ssl_context=ssl_context)
    else:
        # 使用 HTTP (僅限 Android 和開發測試)
        print("⚠️  HTTP 模式 (iOS 功能受限)")
        print("💡 執行 'python generate_ssl_cert.py' 生成 SSL 憑證以啟用 HTTPS")
        app.run(host='0.0.0.0', port=5005, debug=True)