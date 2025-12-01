"""merge notification and quantity tracking branches

Revision ID: d7a41ba83e51
Revises: 23b655b0023e, f1234567890a
Create Date: 2025-12-01 17:19:21.440958

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd7a41ba83e51'
down_revision = ('23b655b0023e', 'f1234567890a')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
