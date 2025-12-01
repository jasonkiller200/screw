"""Add quantity modification tracking fields

Revision ID: quantity_modification
Revises: 
Create Date: 2024-01-01 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'f1234567890a'
down_revision = 'e15538e1c3cb'  # 根據最新的遷移設定
head = None

def upgrade():
    # Add columns to track quantity modifications
    op.add_column('order_registration', 
                  sa.Column('original_quantity', sa.Integer(), nullable=True, comment='原始申請數量'))
    op.add_column('order_registration', 
                  sa.Column('quantity_modified_by', sa.String(length=50), nullable=True, comment='數量修改者'))
    op.add_column('order_registration', 
                  sa.Column('quantity_modified_at', sa.DateTime(), nullable=True, comment='數量修改時間'))

def downgrade():
    # Remove the added columns
    op.drop_column('order_registration', 'quantity_modified_at')
    op.drop_column('order_registration', 'quantity_modified_by')
    op.drop_column('order_registration', 'original_quantity')