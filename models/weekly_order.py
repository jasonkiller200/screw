from extensions import db
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import relationship

# Helper function to get current time in UTC+8
def get_taipei_time():
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

class WeeklyOrderCycle(db.Model):
    """週期申請表 - 管理每週的申請週期"""
    __tablename__ = 'weekly_order_cycles'
    
    id = db.Column(db.Integer, primary_key=True)
    cycle_name = db.Column(db.String(100), nullable=False, comment='申請週期名稱')
    start_date = db.Column(db.DateTime, nullable=False, comment='申請開始日期')
    deadline = db.Column(db.DateTime, nullable=False, comment='申請截止日期(週三17:00)')
    status = db.Column(db.String(20), nullable=False, default='active', comment='狀態')
    created_by = db.Column(db.Integer, nullable=True, comment='建立者ID')
    reviewed_by = db.Column(db.Integer, nullable=True, comment='審查者ID')
    reviewed_at = db.Column(db.DateTime, nullable=True, comment='審查時間')
    excel_generated = db.Column(db.Boolean, default=False, comment='是否已生成Excel')
    excel_path = db.Column(db.String(500), nullable=True, comment='Excel檔案路徑')
    notes = db.Column(db.Text, nullable=True, comment='備註')
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    updated_at = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)
    
    # 關聯
    registrations = relationship("OrderRegistration", back_populates="cycle", cascade="all, delete-orphan")
    review_logs = relationship("OrderReviewLog", back_populates="cycle", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f'<WeeklyOrderCycle {self.cycle_name}>'
    
    @property
    def is_active(self):
        """檢查申請週期是否仍在進行中"""
        now = get_taipei_time()
        deadline_aware = self.deadline
        if deadline_aware.tzinfo is None:
            # 如果 deadline 沒有時區信息，假設它是台北時間
            from datetime import timezone, timedelta
            tz_taipei = timezone(timedelta(hours=8))
            deadline_aware = deadline_aware.replace(tzinfo=tz_taipei)
        return self.status == 'active' and now <= deadline_aware
    
    @property
    def is_overdue(self):
        """檢查是否已過申請截止時間"""
        now = get_taipei_time()
        deadline_aware = self.deadline
        if deadline_aware.tzinfo is None:
            # 如果 deadline 沒有時區信息，假設它是台北時間
            from datetime import timezone, timedelta
            tz_taipei = timezone(timedelta(hours=8))
            deadline_aware = deadline_aware.replace(tzinfo=tz_taipei)
        return now > deadline_aware
    
    @property
    def total_registrations(self):
        """總登記數量"""
        return len(self.registrations)
    
    @property
    def approved_registrations(self):
        """已核准的登記數量"""
        return len([r for r in self.registrations if r.status == 'approved'])
    
    def to_dict(self):
        return {
            'id': self.id,
            'cycle_name': self.cycle_name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'status': self.status,
            'total_registrations': self.total_registrations,
            'approved_registrations': self.approved_registrations,
            'excel_generated': self.excel_generated,
            'is_active': self.is_active,
            'is_overdue': self.is_overdue,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def get_current_cycle(cls):
        """獲取當前活躍的申請週期"""
        now = get_taipei_time()
        return cls.query.filter(
            cls.status == 'active',
            cls.deadline > now
        ).first()
    
    @classmethod
    def create_weekly_cycle(cls, start_date=None):
        """創建新的週期申請"""
        if start_date is None:
            start_date = get_taipei_time()
        
        # 計算下個週三17:00為截止時間
        days_until_wednesday = (2 - start_date.weekday()) % 7  # 0=週一, 2=週三
        if days_until_wednesday == 0 and start_date.hour >= 17:
            days_until_wednesday = 7  # 如果已過本週三17:00，延到下週三
        
        deadline = start_date.replace(hour=17, minute=0, second=0, microsecond=0)
        deadline += timedelta(days=days_until_wednesday)
        
        cycle_name = f"週期申請 {deadline.strftime('%Y-%m-%d')}"
        
        new_cycle = cls()
        new_cycle.cycle_name = cycle_name
        new_cycle.start_date = start_date
        new_cycle.deadline = deadline
        new_cycle.status = 'active'
        
        db.session.add(new_cycle)
        db.session.commit()
        return new_cycle


class OrderRegistration(db.Model):
    """申請登記表 - 個別項目登記"""
    __tablename__ = 'order_registrations'
    
    id = db.Column(db.Integer, primary_key=True)
    cycle_id = db.Column(db.Integer, db.ForeignKey('weekly_order_cycles.id'), nullable=False)
    item_sequence = db.Column(db.Integer, nullable=False, comment='項次')
    part_number = db.Column(db.String(100), nullable=False, comment='品號')
    material_nature = db.Column(db.String(50), nullable=True, comment='物料性質')
    part_name = db.Column(db.String(200), nullable=False, comment='品名')
    specifications = db.Column(db.String(200), nullable=True, comment='規格')
    quantity = db.Column(db.Integer, nullable=False, comment='數量')
    unit = db.Column(db.String(20), nullable=False, comment='單位')
    category = db.Column(db.String(50), nullable=True, comment='種類')
    required_date = db.Column(db.DateTime, nullable=True, comment='需用日期')
    priority = db.Column(db.String(20), nullable=False, default='normal', comment='申請優先級: normal, urgent')
    purpose_notes = db.Column(db.String(200), nullable=True, comment='台份用/備註')
    applicant_name = db.Column(db.String(50), nullable=False, comment='申請人')
    applicant_id = db.Column(db.Integer, nullable=True, comment='申請人ID(未來用)')
    department = db.Column(db.String(100), nullable=True, comment='申請單位')
    status = db.Column(db.String(20), nullable=False, default='registered', comment='狀態')
    admin_notes = db.Column(db.Text, nullable=True, comment='主管備註')
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    updated_at = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)
    
    # 關聯
    cycle = relationship("WeeklyOrderCycle", back_populates="registrations")
    
    def __repr__(self):
        return f'<OrderRegistration {self.part_number}: {self.part_name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'cycle_id': self.cycle_id,
            'item_sequence': self.item_sequence,
            'part_number': self.part_number,
            'material_nature': self.material_nature,
            'part_name': self.part_name,
            'specifications': self.specifications,
            'quantity': self.quantity,
            'unit': self.unit,
            'category': self.category,
            'required_date': self.required_date.isoformat() if self.required_date else None,
            'priority': self.priority,
            'purpose_notes': self.purpose_notes,
            'applicant_name': self.applicant_name,
            'department': self.department,
            'status': self.status,
            'admin_notes': self.admin_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class User(db.Model):
    """用戶表 - 為未來登入機制準備"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False, unique=True, comment='用戶名')
    email = db.Column(db.String(100), nullable=True, unique=True, comment='Email')
    full_name = db.Column(db.String(100), nullable=False, comment='全名')
    department = db.Column(db.String(100), nullable=True, comment='部門')
    role = db.Column(db.String(20), nullable=False, default='user', comment='角色')
    password_hash = db.Column(db.String(128), nullable=True, comment='密碼雜湊(未來用)')
    is_active = db.Column(db.Boolean, default=True, comment='是否啟用')
    last_login = db.Column(db.DateTime, nullable=True, comment='最後登入時間')
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    updated_at = db.Column(db.DateTime, default=get_taipei_time, onupdate=get_taipei_time)
    
    def __repr__(self):
        return f'<User {self.username}: {self.full_name}>'
    
    def to_dict(self):
        return {
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


class OrderReviewLog(db.Model):
    """申請單審查記錄表"""
    __tablename__ = 'order_review_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    cycle_id = db.Column(db.Integer, db.ForeignKey('weekly_order_cycles.id'), nullable=False)
    registration_id = db.Column(db.Integer, db.ForeignKey('order_registrations.id'), nullable=True)
    reviewer_id = db.Column(db.Integer, nullable=True, comment='審查人ID')
    reviewer_name = db.Column(db.String(50), nullable=False, comment='審查人姓名')
    action = db.Column(db.String(20), nullable=False, comment='操作')
    old_status = db.Column(db.String(20), nullable=True, comment='原狀態')
    new_status = db.Column(db.String(20), nullable=True, comment='新狀態')
    notes = db.Column(db.Text, nullable=True, comment='審查備註')
    created_at = db.Column(db.DateTime, default=get_taipei_time)
    
    # 關聯
    cycle = relationship("WeeklyOrderCycle", back_populates="review_logs")
    
    def __repr__(self):
        return f'<OrderReviewLog {self.action} by {self.reviewer_name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'cycle_id': self.cycle_id,
            'registration_id': self.registration_id,
            'reviewer_name': self.reviewer_name,
            'action': self.action,
            'old_status': self.old_status,
            'new_status': self.new_status,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }