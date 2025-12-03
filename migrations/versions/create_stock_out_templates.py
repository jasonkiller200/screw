"""create stock out templates tables

Revision ID: g1234567890b
Revises: f1234567890a
Create Date: 2024-12-03 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'g1234567890b'
down_revision = 'f1234567890a'
branch_labels = None
depends_on = None

def upgrade():
    # 創建 stock_out_templates 表
    op.create_table('stock_out_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False, comment='模板名稱'),
        sa.Column('warehouse_id', sa.Integer(), nullable=False, comment='倉庫ID'),
        sa.Column('created_by', sa.Integer(), nullable=False, comment='建立者'),
        sa.Column('created_at', sa.DateTime(), nullable=True, comment='建立時間'),
        sa.Column('updated_at', sa.DateTime(), nullable=True, comment='更新時間'),
        sa.Column('is_active', sa.Boolean(), nullable=True, comment='是否啟用'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 創建 stock_out_template_items 表
    op.create_table('stock_out_template_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False, comment='模板ID'),
        sa.Column('part_id', sa.Integer(), nullable=False, comment='零件ID'),
        sa.Column('warehouse_location_id', sa.Integer(), nullable=True, comment='優先儲位'),
        sa.Column('default_quantity', sa.Integer(), nullable=False, comment='預設出庫數量'),
        sa.Column('sort_order', sa.Integer(), nullable=True, comment='排序順序'),
        sa.ForeignKeyConstraint(['part_id'], ['parts.id'], ),
        sa.ForeignKeyConstraint(['template_id'], ['stock_out_templates.id'], ),
        sa.ForeignKeyConstraint(['warehouse_location_id'], ['warehouse_locations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 為模板名稱 + 倉庫ID 創建唯一索引
    op.create_index('idx_template_name_warehouse', 'stock_out_templates', ['name', 'warehouse_id'], unique=True)
    
    # 為模板項目創建索引
    op.create_index('idx_template_items_template', 'stock_out_template_items', ['template_id'])
    op.create_index('idx_template_items_part', 'stock_out_template_items', ['part_id'])

def downgrade():
    op.drop_index('idx_template_items_part', table_name='stock_out_template_items')
    op.drop_index('idx_template_items_template', table_name='stock_out_template_items')
    op.drop_index('idx_template_name_warehouse', table_name='stock_out_templates')
    op.drop_table('stock_out_template_items')
    op.drop_table('stock_out_templates')