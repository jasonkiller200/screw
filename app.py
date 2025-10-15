from flask import Flask
from flask_cors import CORS
from controllers.api_controller import api_bp
from controllers.web_controller import web_bp
from controllers.inventory_controller import inventory_api_bp

def create_app():
    """應用程式工廠函數"""
    app = Flask(__name__)
    app.secret_key = 'your-secret-key-here'  # 在生產環境中請使用環境變數
    
    # Enable Cross-Origin Resource Sharing for mobile app
    CORS(app)
    
    # 註冊藍圖
    app.register_blueprint(api_bp)              # API 路由 (/api/...)
    app.register_blueprint(inventory_api_bp)    # 庫存 API 路由 (/api/inventory/...)
    app.register_blueprint(web_bp)              # 網頁路由 (/...)
    
    return app

app = create_app()

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
        app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=ssl_context)
    else:
        # 使用 HTTP (僅限 Android 和開發測試)
        print("⚠️  HTTP 模式 (iOS 功能受限)")
        print("💡 執行 'python generate_ssl_cert.py' 生成 SSL 憑證以啟用 HTTPS")
        app.run(host='0.0.0.0', port=5000, debug=True)
