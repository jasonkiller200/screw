# SDD 使用者登入機制與交易活動紀錄整合 - 審查與建議

## 📋 專案現況分析

### ✅ 已具備的基礎設施

1. **User 模型已存在** (`models/weekly_order.py`)
   - ✅ 基本欄位完整：username, email, full_name, department, role
   - ✅ 已預留 `password_hash` 欄位
   - ✅ 已有 `is_active` 和 `last_login` 欄位
   - ✅ 已安裝 `Flask-Login==0.6.3` 和 `bcrypt==5.0.0`

2. **資料庫架構完整**
   - ✅ 使用 Flask-SQLAlchemy + Flask-Migrate
   - ✅ 已有 `extensions.py` 統一管理擴充套件
   - ✅ MVC 架構清晰 (models, controllers, services)

3. **需要追蹤操作人員的模型**
   - ✅ `InventoryTransaction`: 已有 `created_by` (String) 欄位
   - ✅ `OrderRegistration`: 已有 `applicant_id` (Integer) 和 `applicant_name` (String)
   - ✅ `OrderReviewLog`: 已有 `reviewer_id` (Integer) 和 `reviewer_name` (String)

4. **現有模板系統**
   - ✅ 使用 Bootstrap 5
   - ✅ 有完整的 `base.html` 基礎模板
   - ✅ 已有導航列結構

---

## 🎯 SDD 計畫審查

### 第一階段：核心登入/登出功能

#### ✅ 規劃合理的部分
1. **Flask-Login 整合**: 標準且成熟的方案
2. **密碼加密**: 使用 bcrypt 是業界最佳實踐
3. **全系統存取控制**: 使用 `@login_required` 裝飾器

#### ⚠️ 需要補充的部分

**1. 缺少初始化管理員帳號的機制**
```python
# 建議：需要建立初始化腳本或命令
# 例如：python -m flask init-admin
```

**2. 缺少使用者註冊機制**
- 建議提供「管理員審核式註冊」或「開放式註冊」兩種方案選擇

**3. 缺少密碼重置/忘記密碼機制**
- 在 SDD 中未提及，但建議至少有「管理員重置」功能

**4. Session 管理設定**
```python
# 建議在 app.py 中加入：
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
app.config['SESSION_COOKIE_SECURE'] = True  # 如果使用 HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
```

**5. 登出後的導向處理**
- 建議登出後清除所有 flash messages
- 考慮記錄登出時間到 audit log

**6. 權限管理**
- SDD 中提到 `role` 欄位，但未規劃如何使用
- 建議明確定義角色：admin, manager, operator, viewer

---

### 第二階段：交易活動與人員資訊綁定

#### ✅ 規劃完整的部分
1. **識別需要追蹤的三個關鍵模型**
2. **善用現有欄位** (applicant_id, reviewer_id)

#### ⚠️ 需要調整的部分

**1. InventoryTransaction 的 user_id 問題**

**問題分析：**
- SDD 計畫新增 `user_id` (Foreign Key)
- 但目前已有 `created_by` (String) 欄位
- 兩個欄位功能重疊

**建議方案 A（推薦）：** 改用現有欄位，調整型別
```python
# 將 created_by 改為 Integer Foreign Key
user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
# 保留舊欄位一段時間作為遷移期使用
created_by = db.Column(db.String(100), default='system')
```

**建議方案 B：** 保持雙欄位
```python
# user_id: 已登入用戶的 ID
# created_by: 保留作為系統操作記錄（如 'system', 'api', 'migration'）
user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
created_by = db.Column(db.String(100), default='system')
```

**2. 資料庫遷移策略**

建議分兩步執行：
```bash
# Step 1: 新增欄位（允許 NULL）
flask db migrate -m "Add user_id to inventory_transactions"
flask db upgrade

# Step 2: 回填資料（可選）
# 將現有的 'admin', '管理員' 等字串對應到實際 user_id

# Step 3: 視需要調整 nullable 約束
```

**3. 批次操作的處理**

現有系統有「批次出庫」功能，需考慮：
```python
# 例如在 batch_stock_out 時
# 一次性記錄多筆 InventoryTransaction
# 都應該使用同一個 current_user.id
```

**4. API 呼叫的使用者識別**

對於 `/api/*` 路由：
- 在第一階段，API 也應該需要登入
- 可以使用 `@login_required` 或自訂裝飾器
- 第三階段再引入 Token 機制

---

### 第三階段：API Token 機制

#### ✅ 規劃前瞻性良好
預留未來擴展空間

#### 💡 實作建議

**1. Token 欄位設計**
```python
class User(db.Model):
    # ... 現有欄位 ...
    api_token = db.Column(db.String(64), unique=True, nullable=True, index=True)
    api_token_created_at = db.Column(db.DateTime, nullable=True)
    api_token_expires_at = db.Column(db.DateTime, nullable=True)  # 可選：Token 過期
```

**2. Token 驗證裝飾器**
```python
from functools import wraps
from flask import request, jsonify

def token_or_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 先檢查 Bearer Token
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            user = User.query.filter_by(api_token=token, is_active=True).first()
            if user:
                login_user(user)
                return f(*args, **kwargs)
        
        # 否則要求 Session 登入
        if not current_user.is_authenticated:
            return jsonify({'error': 'Unauthorized'}), 401
        
        return f(*args, **kwargs)
    return decorated_function
```

**3. 安全考量**
- Token 應使用 `secrets.token_urlsafe(32)` 生成
- 考慮 Token 輪換機制
- 記錄 Token 使用歷史（可選）

---

## 🏗️ 實作架構建議

### 檔案結構規劃

```
screw/
├── controllers/
│   ├── auth_controller.py          # 新增：登入/登出路由
│   └── user_management_controller.py # 新增：使用者管理（未來）
├── models/
│   └── weekly_order.py             # User 模型（已存在，需增強）
├── services/
│   └── auth_service.py             # 新增：驗證邏輯服務層
├── templates/
│   ├── auth/
│   │   ├── login.html              # 新增：登入頁面
│   │   └── change_password.html    # 建議：修改密碼頁面
│   └── base.html                   # 修改：加入使用者資訊顯示
├── migrations/
│   └── versions/
│       └── [timestamp]_add_auth_system.py  # 資料庫遷移腳本
└── utils/
    └── decorators.py               # 新增：自訂裝飾器
```

### 控制器設計

```python
# controllers/auth_controller.py
from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
from models.weekly_order import User
from services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('web.index'))
    
    if request.method == 'POST':
        result = AuthService.authenticate_user(
            request.form.get('username'),
            request.form.get('password')
        )
        if result['success']:
            login_user(result['user'], remember=request.form.get('remember'))
            next_page = request.args.get('next')
            return redirect(next_page or url_for('web.index'))
        flash(result['message'], 'error')
    
    return render_template('auth/login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """使用者註冊"""
    if current_user.is_authenticated:
        return redirect(url_for('web.index'))
    
    if request.method == 'POST':
        result = AuthService.register_user(
            username=request.form.get('username'),
            password=request.form.get('password'),
            password_confirm=request.form.get('password_confirm'),
            email=request.form.get('email'),
            full_name=request.form.get('full_name'),
            department=request.form.get('department')
        )
        
        if result['success']:
            flash(result['message'], 'success')
            return redirect(url_for('auth.login'))
        else:
            flash(result['message'], 'error')
    
    return render_template('auth/register.html')

@auth_bp.route('/logout')
@login_required
def logout():
    AuthService.log_logout(current_user.id)
    logout_user()
    flash('您已成功登出', 'info')
    return redirect(url_for('auth.login'))
```

### 服務層設計

```python
# services/auth_service.py
from werkzeug.security import generate_password_hash, check_password_hash
from models.weekly_order import User, get_taipei_time
from extensions import db

class AuthService:
    @staticmethod
    def authenticate_user(username, password):
        user = User.query.filter_by(username=username, is_active=True).first()
        
        if not user or not user.password_hash:
            return {'success': False, 'message': '帳號或密碼錯誤'}
        
        if not check_password_hash(user.password_hash, password):
            return {'success': False, 'message': '帳號或密碼錯誤'}
        
        # 更新最後登入時間
        user.last_login = get_taipei_time()
        db.session.commit()
        
        return {'success': True, 'user': user}
    
    @staticmethod
    def register_user(username, password, password_confirm, email, full_name, department=None):
        """使用者註冊"""
        # 驗證輸入
        if not username or not password or not full_name:
            return {'success': False, 'message': '使用者名稱、密碼和姓名為必填項目'}
        
        # 驗證密碼確認
        if password != password_confirm:
            return {'success': False, 'message': '兩次輸入的密碼不一致'}
        
        # 驗證密碼強度
        is_valid, message = AuthService.validate_password(password)
        if not is_valid:
            return {'success': False, 'message': message}
        
        # 檢查使用者名稱是否已存在
        if User.query.filter_by(username=username).first():
            return {'success': False, 'message': '使用者名稱已存在'}
        
        # 檢查 Email 是否已存在
        if email and User.query.filter_by(email=email).first():
            return {'success': False, 'message': 'Email 已被使用'}
        
        try:
            # 建立新使用者
            user = User(
                username=username,
                email=email,
                full_name=full_name,
                department=department,
                role='user',  # 預設為一般使用者
                password_hash=generate_password_hash(password),
                is_active=True  # 可設為 False 需要管理員啟用
            )
            db.session.add(user)
            db.session.commit()
            
            return {
                'success': True, 
                'user': user,
                'message': '註冊成功！請使用您的帳號密碼登入'
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'註冊失敗：{str(e)}'}
    
    @staticmethod
    def validate_password(password):
        """驗證密碼強度"""
        import re
        
        if len(password) < 8:
            return False, '密碼至少需要 8 個字元'
        if not re.search(r'[A-Za-z]', password):
            return False, '密碼必須包含英文字母'
        if not re.search(r'\d', password):
            return False, '密碼必須包含數字'
        return True, ''
    
    @staticmethod
    def create_user(username, password, full_name, **kwargs):
        """管理員建立使用者（內部使用）"""
        if User.query.filter_by(username=username).first():
            return {'success': False, 'message': '使用者名稱已存在'}
        
        user = User(
            username=username,
            full_name=full_name,
            password_hash=generate_password_hash(password),
            **kwargs
        )
        db.session.add(user)
        db.session.commit()
        return {'success': True, 'user': user}
    
    @staticmethod
    def log_logout(user_id):
        # 可選：記錄登出事件到 audit log
        pass
```

---

## 🔒 安全性建議

### 1. 密碼政策
```python
# 已整合在 AuthService.validate_password() 中
# 密碼規則：
# - 至少 8 個字元
# - 包含英文和數字
# 可依需求加強為：
# - 包含大小寫字母
# - 包含特殊符號
```

### 2. 使用者名稱驗證
```python
# 在註冊頁面加入前端驗證
# pattern="[a-zA-Z0-9_]{3,20}"
# 3-20個字元，只能包含英文、數字和底線

# 後端也需驗證
import re

def validate_username(username):
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', username):
        return False, '使用者名稱必須是3-20個字元，只能包含英文、數字和底線'
    return True, ''
```

### 3. 登入失敗次數限制
```python
# 可選：防止暴力破解
# 在 User 模型中加入：
failed_login_attempts = db.Column(db.Integer, default=0)
locked_until = db.Column(db.DateTime, nullable=True)
```

### 3. CSRF 保護
```python
# app.py 中啟用 CSRF
from flask_wtf.csrf import CSRFProtect
csrf = CSRFProtect(app)
```

---

## 📝 User 模型增強建議

```python
# models/weekly_order.py
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin, db.Model):  # 繼承 UserMixin
    """用戶表"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False, unique=True, index=True)
    email = db.Column(db.String(100), nullable=True, unique=True, index=True)
    full_name = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(20), nullable=False, default='user')
    password_hash = db.Column(db.String(256), nullable=True)  # 增加長度
    is_active = db.Column(db.Boolean, default=True)
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    updated_at = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)
    
    # 新增：關聯到交易記錄
    inventory_transactions = relationship("InventoryTransaction", foreign_keys="InventoryTransaction.user_id", backref="user")
    order_registrations = relationship("OrderRegistration", foreign_keys="OrderRegistration.applicant_id", backref="applicant")
    review_logs = relationship("OrderReviewLog", foreign_keys="OrderReviewLog.reviewer_id", backref="reviewer")
    
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
```

---

## 🎨 登入頁面 UI 建議

```html
<!-- templates/auth/login.html -->
{% extends "base.html" %}

{% block title %}登入 - 五金零件庫存管理系統{% endblock %}

{% block content %}
<div class="container">
    <div class="row justify-content-center" style="margin-top: 100px;">
        <div class="col-md-4">
            <div class="card shadow">
                <div class="card-body p-4">
                    <h3 class="text-center mb-4">
                        <i class="fas fa-tools text-primary"></i>
                        系統登入
                    </h3>
                    
                    {% with messages = get_flashed_messages(with_categories=true) %}
                        {% if messages %}
                            {% for category, message in messages %}
                            <div class="alert alert-{{ 'danger' if category == 'error' else category }} alert-dismissible fade show">
                                {{ message }}
                                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                            </div>
                            {% endfor %}
                        {% endif %}
                    {% endwith %}
                    
                    <form method="POST" action="{{ url_for('auth.login') }}">
                        <div class="mb-3">
                            <label for="username" class="form-label">使用者名稱</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-user"></i></span>
                                <input type="text" class="form-control" id="username" name="username" 
                                       required autofocus autocomplete="username">
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="password" class="form-label">密碼</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                <input type="password" class="form-control" id="password" name="password" 
                                       required autocomplete="current-password">
                            </div>
                        </div>
                        
                        <div class="mb-3 form-check">
                            <input type="checkbox" class="form-check-input" id="remember" name="remember">
                            <label class="form-check-label" for="remember">記住我</label>
                        </div>
                        
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-sign-in-alt me-2"></i>登入
                        </button>
                    </form>
                    
                    <div class="text-center mt-3">
                        <a href="{{ url_for('auth.register') }}" class="text-decoration-none">
                            <i class="fas fa-user-plus me-1"></i>還沒有帳號？立即註冊
                        </a>
                    </div>
                    
                    <div class="text-center mt-2">
                        <small class="text-muted">
                            五金零件庫存管理系統 v2.0
                        </small>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
{% endblock %}
```

### 註冊頁面 UI

```html
<!-- templates/auth/register.html -->
{% extends "base.html" %}

{% block title %}註冊 - 五金零件庫存管理系統{% endblock %}

{% block content %}
<div class="container">
    <div class="row justify-content-center" style="margin-top: 50px;">
        <div class="col-md-6">
            <div class="card shadow">
                <div class="card-body p-4">
                    <h3 class="text-center mb-4">
                        <i class="fas fa-user-plus text-primary"></i>
                        使用者註冊
                    </h3>
                    
                    {% with messages = get_flashed_messages(with_categories=true) %}
                        {% if messages %}
                            {% for category, message in messages %}
                            <div class="alert alert-{{ 'danger' if category == 'error' else category }} alert-dismissible fade show">
                                {{ message }}
                                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                            </div>
                            {% endfor %}
                        {% endif %}
                    {% endwith %}
                    
                    <form method="POST" action="{{ url_for('auth.register') }}" id="registerForm">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="username" class="form-label">
                                    使用者名稱 <span class="text-danger">*</span>
                                </label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-user"></i></span>
                                    <input type="text" class="form-control" id="username" name="username" 
                                           required autofocus autocomplete="username"
                                           pattern="[a-zA-Z0-9_]{3,20}"
                                           title="3-20個字元，只能包含英文、數字和底線">
                                </div>
                                <small class="text-muted">3-20個字元，只能使用英文、數字和底線</small>
                            </div>
                            
                            <div class="col-md-6 mb-3">
                                <label for="full_name" class="form-label">
                                    真實姓名 <span class="text-danger">*</span>
                                </label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-id-card"></i></span>
                                    <input type="text" class="form-control" id="full_name" name="full_name" 
                                           required autocomplete="name">
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-envelope"></i></span>
                                <input type="email" class="form-control" id="email" name="email" 
                                       autocomplete="email">
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="department" class="form-label">部門</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="fas fa-building"></i></span>
                                <input type="text" class="form-control" id="department" name="department" 
                                       autocomplete="organization">
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="password" class="form-label">
                                    密碼 <span class="text-danger">*</span>
                                </label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                    <input type="password" class="form-control" id="password" name="password" 
                                           required autocomplete="new-password"
                                           minlength="8">
                                </div>
                                <small class="text-muted">至少8個字元，需包含英文和數字</small>
                            </div>
                            
                            <div class="col-md-6 mb-3">
                                <label for="password_confirm" class="form-label">
                                    確認密碼 <span class="text-danger">*</span>
                                </label>
                                <div class="input-group">
                                    <span class="input-group-text"><i class="fas fa-lock"></i></span>
                                    <input type="password" class="form-control" id="password_confirm" 
                                           name="password_confirm" required autocomplete="new-password"
                                           minlength="8">
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>密碼要求：</strong>
                                <ul class="mb-0 mt-2">
                                    <li>至少 8 個字元</li>
                                    <li>必須包含英文字母</li>
                                    <li>必須包含數字</li>
                                </ul>
                            </div>
                        </div>
                        
                        <button type="submit" class="btn btn-primary w-100">
                            <i class="fas fa-user-plus me-2"></i>註冊
                        </button>
                    </form>
                    
                    <div class="text-center mt-3">
                        <a href="{{ url_for('auth.login') }}" class="text-decoration-none">
                            <i class="fas fa-arrow-left me-1"></i>返回登入
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
// 即時驗證密碼是否一致
document.getElementById('registerForm').addEventListener('submit', function(e) {
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password_confirm').value;
    
    if (password !== passwordConfirm) {
        e.preventDefault();
        alert('兩次輸入的密碼不一致，請重新輸入');
        return false;
    }
});

// 即時顯示密碼強度
document.getElementById('password').addEventListener('input', function(e) {
    const password = e.target.value;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const isLongEnough = password.length >= 8;
    
    // 可以在此加入視覺化的密碼強度指示器
});
</script>
{% endblock %}
```

---

## 🔐 註冊功能進階選項

### 選項 A：開放式註冊（推薦用於內部系統）

使用者註冊後立即啟用，可直接登入：

```python
# AuthService.register_user() 中
is_active=True  # 立即啟用
```

### 選項 B：管理員審核式註冊（推薦用於外部系統）

使用者註冊後需要管理員審核才能使用：

```python
# AuthService.register_user() 中
is_active=False  # 需要管理員啟用

# 註冊成功訊息改為：
'message': '註冊申請已提交，請等待管理員審核'
```

然後需要管理員介面來啟用使用者：

```python
# controllers/user_management_controller.py
@user_management_bp.route('/users/<int:user_id>/activate', methods=['POST'])
@login_required
@admin_required
def activate_user(user_id):
    user = User.query.get_or_404(user_id)
    user.is_active = True
    db.session.commit()
    flash(f'使用者 {user.username} 已啟用', 'success')
    return redirect(url_for('user_management.users'))
```

### 選項 C：Email 驗證式註冊（進階功能）

需要使用者驗證 Email 才能啟用（需額外開發）：

```python
# User 模型加入
email_verified = db.Column(db.Boolean, default=False)
email_verification_token = db.Column(db.String(100), unique=True, nullable=True)

# 註冊時發送驗證郵件
# 點擊連結後才啟用帳號
```

---

## 📋 實作檢查清單（更新）

### 第一階段任務分解

### 第一階段任務分解

- [ ] **1.1 User 模型增強**
  - [ ] 加入 `UserMixin` 繼承
  - [ ] 實作 `set_password()` 和 `check_password()` 方法
  - [ ] 加入 `has_role()` 和 `is_admin` 方法
  - [ ] 建立資料庫遷移腳本

- [ ] **1.2 建立 AuthService**
  - [ ] `authenticate_user()` 方法
  - [ ] `register_user()` 方法（新增）
  - [ ] `validate_password()` 方法（新增）
  - [ ] `create_user()` 方法（管理員用）
  - [ ] `change_password()` 方法
  - [ ] 密碼驗證邏輯

- [ ] **1.3 建立 AuthController**
  - [ ] `GET /login` 路由
  - [ ] `POST /login` 路由
  - [ ] `GET /register` 路由（新增）
  - [ ] `POST /register` 路由（新增）
  - [ ] `GET /logout` 路由
  - [ ] 處理 `next` 參數

- [ ] **1.4 初始化 Flask-Login**
  - [ ] 在 `extensions.py` 加入 `LoginManager`
  - [ ] 在 `app.py` 初始化
  - [ ] 實作 `user_loader` callback
  - [ ] 設定 `login_view`

- [ ] **1.5 建立登入與註冊頁面**
  - [ ] `templates/auth/login.html`
  - [ ] `templates/auth/register.html`（新增）
  - [ ] 表單驗證
  - [ ] 錯誤訊息顯示
  - [ ] 密碼強度即時檢查（新增）
  - [ ] 響應式設計

- [ ] **1.6 修改 base.html**
  - [ ] 加入使用者資訊顯示
  - [ ] 加入登出按鈕
  - [ ] 根據登入狀態顯示不同選單

- [ ] **1.7 全系統存取控制**
  - [ ] 在所有 web 路由加入 `@login_required`
  - [ ] API 路由的驗證策略
  - [ ] 設定白名單路由（login, static files）

- [ ] **1.8 建立初始管理員**
  - [ ] 建立 CLI 命令 `flask init-admin`
  - [ ] 或建立初始化腳本 `init_admin.py`

- [ ] **1.9 測試**
  - [ ] 登入功能測試
  - [ ] 註冊功能測試（新增）
  - [ ] 密碼驗證測試（新增）
  - [ ] 重複使用者名稱/Email 測試（新增）
  - [ ] 登出功能測試
  - [ ] 未授權訪問測試
  - [ ] 記住我功能測試

### 第二階段任務分解

- [ ] **2.1 InventoryTransaction 調整**
  - [ ] 新增 `user_id` 欄位（Foreign Key）
  - [ ] 建立遷移腳本
  - [ ] 更新 `CurrentInventory.update_stock()` 方法
  - [ ] 更新所有呼叫 `update_stock()` 的地方

- [ ] **2.2 庫存操作綁定使用者**
  - [ ] 修改入庫 controller
  - [ ] 修改出庫 controller
  - [ ] 修改批次出庫 controller
  - [ ] 修改調整庫存 controller
  - [ ] 修改盤點完成 controller

- [ ] **2.3 OrderRegistration 調整**
  - [ ] 確認 `applicant_id` 欄位存在
  - [ ] 修改訂單申請 controller
  - [ ] 自動填入 `current_user.id` 和 `current_user.full_name`

- [ ] **2.4 OrderReviewLog 調整**
  - [ ] 確認 `reviewer_id` 欄位存在
  - [ ] 修改訂單審查 controller
  - [ ] 自動填入 `current_user.id` 和 `current_user.full_name`

- [ ] **2.5 歷史資料處理**
  - [ ] 決定歷史資料的 user_id 處理策略
  - [ ] 建立資料回填腳本（可選）

- [ ] **2.6 UI 顯示調整**
  - [ ] 庫存交易記錄顯示操作人員
  - [ ] 訂單申請顯示申請人
  - [ ] 審查記錄顯示審查人

- [ ] **2.7 測試**
  - [ ] 各項操作的使用者記錄測試
  - [ ] 多使用者同時操作測試
  - [ ] 歷史記錄查詢測試

### 第三階段任務分解（未來）

- [ ] **3.1 Token 機制設計**
  - [ ] User 模型加入 token 相關欄位
  - [ ] Token 生成邏輯
  - [ ] Token 驗證邏輯

- [ ] **3.2 API 驗證增強**
  - [ ] 建立 `@token_or_login_required` 裝飾器
  - [ ] 更新 API 路由使用新裝飾器

- [ ] **3.3 Token 管理介面**
  - [ ] 生成 Token 的 UI
  - [ ] 重置 Token 功能
  - [ ] 查看 Token 使用歷史

---

## 💡 額外建議

### 1. 審計日誌系統（Audit Log）

考慮建立獨立的審計日誌表：
```python
class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)  # LOGIN, LOGOUT, CREATE, UPDATE, DELETE
    table_name = db.Column(db.String(50), nullable=True)
    record_id = db.Column(db.Integer, nullable=True)
    changes = db.Column(db.Text, nullable=True)  # JSON format
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=get_taipei_time)
```

### 2. 權限管理系統

如果需要細粒度的權限控制：
```python
# 建議使用 Flask-Principal 或自訂裝飾器
from functools import wraps
from flask_login import current_user

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            abort(403)
        return f(*args, **kwargs)
    return decorated_function
```

### 3. 活動監控

在 `app.py` 中加入：
```python
from flask_login import user_logged_in, user_logged_out

@user_logged_in.connect_via(app)
def on_user_logged_in(sender, user):
    # 記錄登入事件
    pass

@user_logged_out.connect_via(app)
def on_user_logged_out(sender, user):
    # 記錄登出事件
    pass
```

### 4. 使用者管理介面

建議在第一階段完成後，規劃第 1.5 階段：
- 使用者列表頁面（僅管理員可見）
- 新增使用者（管理員功能）
- 編輯使用者資料
- 啟用/停用使用者（針對註冊審核）
- 重置密碼（管理員功能）
- 查看使用者活動記錄

### 5. 註冊驗證增強

**A. 圖形驗證碼（CAPTCHA）**
```python
# 可使用 Flask-ReCaptcha
pip install flask-recaptcha

# app.py
from flask_recaptcha import ReCaptcha
recaptcha = ReCaptcha(app)
app.config['RECAPTCHA_SITE_KEY'] = 'your_site_key'
app.config['RECAPTCHA_SECRET_KEY'] = 'your_secret_key'

# register.html
{{ recaptcha }}

# auth_controller.py
if not recaptcha.verify():
    flash('請完成驗證', 'error')
```

**B. Email 驗證（進階）**
```python
# 註冊時發送驗證連結
from itsdangerous import URLSafeTimedSerializer

def generate_verification_token(email):
    serializer = URLSafeTimedSerializer(app.secret_key)
    return serializer.dumps(email, salt='email-verify')

def verify_token(token, expiration=3600):
    serializer = URLSafeTimedSerializer(app.secret_key)
    try:
        email = serializer.loads(token, salt='email-verify', max_age=expiration)
        return email
    except:
        return None
```

### 6. 使用者體驗優化

**A. 即時使用者名稱檢查**
```javascript
// AJAX 檢查使用者名稱是否已被使用
document.getElementById('username').addEventListener('blur', async function(e) {
    const username = e.target.value;
    const response = await fetch(`/api/check-username?username=${username}`);
    const data = await response.json();
    if (!data.available) {
        // 顯示錯誤訊息
    }
});
```

**B. 密碼強度視覺化**
```html
<!-- 在註冊頁面加入密碼強度指示器 -->
<div class="progress mt-2" style="height: 5px;">
    <div id="password-strength-bar" class="progress-bar" role="progressbar" style="width: 0%"></div>
</div>
<small id="password-strength-text" class="text-muted"></small>
```

---

## 📊 優先級建議

### 🔴 高優先級（第一階段必須）
1. Flask-Login 整合
2. User 模型增強（密碼功能）
3. 登入/登出路由
4. 登入頁面 UI
5. 初始管理員建立
6. 全系統存取控制

### 🟡 中優先級（第二階段核心）
1. InventoryTransaction user_id
2. 庫存操作綁定使用者
3. OrderRegistration 使用者綁定
4. OrderReviewLog 使用者綁定

### 🟢 低優先級（可延後）
1. 修改密碼功能
2. 使用者管理介面
3. 審計日誌系統
4. 權限細粒度控制
5. API Token 機制

---

## ⚡ 快速啟動建議

建議實作順序：

**Week 1: 基礎驗證系統**
1. 增強 User 模型
2. 建立 AuthService（包含註冊功能）
3. 建立 AuthController（登入 + 註冊路由）
4. 建立登入和註冊頁面
5. 初始化 Flask-Login
6. 建立初始管理員（或開放首位註冊者為管理員）

**Week 2: 存取控制與註冊優化**
1. 修改 base.html 顯示使用者資訊
2. 為所有路由加入 `@login_required`
3. 測試全系統存取控制
4. 加入密碼強度視覺化
5. 實作使用者名稱即時檢查（可選）

**Week 3: 使用者綁定（庫存）**
1. 調整 InventoryTransaction 模型
2. 修改庫存相關 controller
3. 測試庫存操作記錄

**Week 4: 使用者綁定（訂單）+ 管理功能**
1. 修改 OrderRegistration controller
2. 修改 OrderReviewLog controller
3. 建立使用者管理介面（管理員審核註冊）
4. 全面測試

---

## 🎯 結論（更新）

**SDD 計畫總體評價：⭐⭐⭐⭐⭐ (5/5) - 加入註冊功能後**

✅ **優點：**
- 三階段規劃清晰合理
- 善用現有基礎設施
- 識別了關鍵需求
- **新增：完整的使用者註冊流程**
- **新增：多種註冊策略可選（開放式/審核式/Email驗證）**

⚠️ **需要補強（已解決部分）：**
- ~~缺少使用者註冊機制~~ ✅ 已加入
- 建議選擇適合的註冊策略（推薦內部系統使用「開放式註冊」）
- Session 安全性設定需配置
- InventoryTransaction 欄位設計需調整

💡 **最終建議：**
1. 參考本文檔的「實作檢查清單」逐項實作
2. **優先實作「開放式註冊」，後續可切換為「審核式」**
3. 註冊頁面加入前端驗證提升使用者體驗
4. 每個階段完成後進行充分測試
5. 考慮引入審計日誌系統以提升追溯能力
6. **建議在登入頁面加入「註冊」連結，提升易用性**

## 📌 註冊功能快速決策表

| 情境 | 推薦方案 | 優點 | 缺點 |
|------|---------|------|------|
| **內部員工使用** | 開放式註冊 | 立即可用，無需等待 | 任何人都能註冊 |
| **需要控管人員** | 管理員審核式 | 可控制誰能使用系統 | 使用者需等待審核 |
| **外部合作夥伴** | Email 驗證式 | 確保 Email 有效性 | 需開發郵件功能 |
| **混合模式** | 首位為 Admin，後續審核 | 平衡便利性與安全性 | 需確保首位註冊者可信 |

**建議：** 對於內部五金零件管理系統，推薦使用「開放式註冊 + 首位為管理員」模式。

此 SDD 計畫具有良好的實作基礎，配合本文檔的建議調整後，可以建立一個安全、完整的使用者驗證與活動追蹤系統。
