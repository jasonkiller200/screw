"""Create weekly order system tables

Revision ID: weekly_order_system
Revises: 161c50b7c195
Create Date: 2025-10-17 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'weekly_order_system'
down_revision = '161c50b7c195'
branch_labels = None
depends_on = None

def get_taipei_time():
    from datetime import timezone, timedelta
    tz_taipei = timezone(timedelta(hours=8))
    return datetime.now(tz_taipei)

def upgrade():
    # 創建週期申請表 (每週申請週期)
    op.create_table('weekly_order_cycles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cycle_name', sa.String(100), nullable=False, comment='申請週期名稱'),
        sa.Column('start_date', sa.DateTime(), nullable=False, comment='申請開始日期'),
        sa.Column('deadline', sa.DateTime(), nullable=False, comment='申請截止日期(週三17:00)'),
        sa.Column('status', sa.String(20), nullable=False, default='active', comment='狀態: active, reviewing, completed, closed'),
        sa.Column('created_by', sa.Integer(), nullable=True, comment='建立者ID'),
        sa.Column('reviewed_by', sa.Integer(), nullable=True, comment='審查者ID'),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True, comment='審查時間'),
        sa.Column('excel_generated', sa.Boolean(), default=False, comment='是否已生成Excel'),
        sa.Column('excel_path', sa.String(500), nullable=True, comment='Excel檔案路徑'),
        sa.Column('notes', sa.Text(), nullable=True, comment='備註'),
        sa.Column('created_at', sa.DateTime(), default=get_taipei_time),
        sa.Column('updated_at', sa.DateTime(), default=get_taipei_time, onupdate=get_taipei_time),
        sa.PrimaryKeyConstraint('id')
    )

    # 創建申請登記表 (個別項目登記)
    op.create_table('order_registrations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cycle_id', sa.Integer(), nullable=False, comment='所屬申請週期'),
        sa.Column('item_sequence', sa.Integer(), nullable=False, comment='項次'),
        sa.Column('part_number', sa.String(100), nullable=False, comment='品號'),
        sa.Column('material_nature', sa.String(50), nullable=True, comment='物料性質'),
        sa.Column('part_name', sa.String(200), nullable=False, comment='品名'),
        sa.Column('specifications', sa.String(200), nullable=True, comment='規格'),
        sa.Column('quantity', sa.Integer(), nullable=False, comment='數量'),
        sa.Column('unit', sa.String(20), nullable=False, comment='單位'),
        sa.Column('category', sa.String(50), nullable=True, comment='種類'),
        sa.Column('required_date', sa.DateTime(), nullable=True, comment='需用日期'),
        sa.Column('purpose_notes', sa.String(200), nullable=True, comment='台份用/備註'),
        sa.Column('applicant_name', sa.String(50), nullable=False, comment='申請人'),
        sa.Column('applicant_id', sa.Integer(), nullable=True, comment='申請人ID(未來用)'),
        sa.Column('department', sa.String(100), nullable=True, comment='申請單位'),
        sa.Column('status', sa.String(20), nullable=False, default='registered', comment='狀態: registered, approved, rejected'),
        sa.Column('admin_notes', sa.Text(), nullable=True, comment='主管備註'),
        sa.Column('created_at', sa.DateTime(), default=get_taipei_time),
        sa.Column('updated_at', sa.DateTime(), default=get_taipei_time, onupdate=get_taipei_time),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['cycle_id'], ['weekly_order_cycles.id'], ),
        sa.Index('idx_cycle_sequence', 'cycle_id', 'item_sequence')
    )

    # 創建用戶表 (為未來登入機制準備)
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False, unique=True, comment='用戶名'),
        sa.Column('email', sa.String(100), nullable=True, unique=True, comment='Email'),
        sa.Column('full_name', sa.String(100), nullable=False, comment='全名'),
        sa.Column('department', sa.String(100), nullable=True, comment='部門'),
        sa.Column('role', sa.String(20), nullable=False, default='user', comment='角色: user, admin, manager'),
        sa.Column('password_hash', sa.String(128), nullable=True, comment='密碼雜湊(未來用)'),
        sa.Column('is_active', sa.Boolean(), default=True, comment='是否啟用'),
        sa.Column('last_login', sa.DateTime(), nullable=True, comment='最後登入時間'),
        sa.Column('created_at', sa.DateTime(), default=get_taipei_time),
        sa.Column('updated_at', sa.DateTime(), default=get_taipei_time, onupdate=get_taipei_time),
        sa.PrimaryKeyConstraint('id')
    )

    # 創建申請單審查記錄表
    op.create_table('order_review_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cycle_id', sa.Integer(), nullable=False, comment='申請週期ID'),
        sa.Column('registration_id', sa.Integer(), nullable=True, comment='登記項目ID(針對單項審查)'),
        sa.Column('reviewer_id', sa.Integer(), nullable=True, comment='審查人ID'),
        sa.Column('reviewer_name', sa.String(50), nullable=False, comment='審查人姓名'),
        sa.Column('action', sa.String(20), nullable=False, comment='操作: approve, reject, modify, generate_excel'),
        sa.Column('old_status', sa.String(20), nullable=True, comment='原狀態'),
        sa.Column('new_status', sa.String(20), nullable=True, comment='新狀態'),
        sa.Column('notes', sa.Text(), nullable=True, comment='審查備註'),
        sa.Column('created_at', sa.DateTime(), default=get_taipei_time),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['cycle_id'], ['weekly_order_cycles.id'], ),
        sa.ForeignKeyConstraint(['registration_id'], ['order_registrations.id'], )
    )

def downgrade():
    op.drop_table('order_review_logs')
    op.drop_table('users')
    op.drop_table('order_registrations')
    op.drop_table('weekly_order_cycles')