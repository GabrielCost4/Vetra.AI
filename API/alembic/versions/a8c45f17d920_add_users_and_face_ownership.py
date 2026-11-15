"""Add users and face ownership, preserving unclaimed legacy faces."""

from alembic import op
import sqlalchemy as sa

revision = "a8c45f17d920"
down_revision = "fd51e5804432"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(60), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.add_column("faces", sa.Column("user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_faces_user_id", "faces", "users", ["user_id"], ["id"])
    op.create_index("ix_faces_user_id", "faces", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_faces_user_id", table_name="faces")
    op.drop_constraint("fk_faces_user_id", "faces", type_="foreignkey")
    op.drop_column("faces", "user_id")
    op.drop_table("users")
