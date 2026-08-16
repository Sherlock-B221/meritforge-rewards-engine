"""engine tables (challenges, progress, activity, streaks, reward_ledger) + events.retry_count

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

challenge_type_enum = postgresql.ENUM("count", "streak", name="challenge_type")
challenge_status_enum = postgresql.ENUM(
    "draft", "active", "expired", "archived", name="challenge_status"
)
reward_type_enum = postgresql.ENUM("points", "badge", name="reward_type")


def upgrade() -> None:
    bind = op.get_bind()
    challenge_type_enum.create(bind, checkfirst=True)
    challenge_status_enum.create(bind, checkfirst=True)
    reward_type_enum.create(bind, checkfirst=True)

    op.add_column(
        "events",
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "type",
            postgresql.ENUM("count", "streak", name="challenge_type", create_type=False),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("rule_config", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("reward", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column(
            "status",
            postgresql.ENUM(
                "draft", "active", "expired", "archived", name="challenge_status", create_type=False
            ),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(op.f("ix_challenges_event_type"), "challenges", ["event_type"])
    op.create_index(op.f("ix_challenges_status"), "challenges", ["status"])

    op.create_table(
        "challenge_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "challenge_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("challenges.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period_key", sa.String(length=16), nullable=False, server_default=""),
        sa.Column("current_value", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("target_value", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint(
            "challenge_id", "user_id", "period_key", name="uq_progress_challenge_user_period"
        ),
    )

    op.create_table(
        "user_daily_activity",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True, nullable=False),
        sa.Column("activity_date", sa.Date(), primary_key=True, nullable=False),
        sa.Column("event_type", sa.String(length=100), primary_key=True, nullable=False),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "user_streaks",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True, nullable=False),
        sa.Column("event_type", sa.String(length=100), primary_key=True, nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
    )

    op.create_table(
        "reward_ledger",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("challenges.id"), nullable=False),
        sa.Column(
            "reward_type",
            postgresql.ENUM("points", "badge", name="reward_type", create_type=False),
            nullable=False,
        ),
        sa.Column("amount", sa.Integer(), nullable=True),
        sa.Column("badge_code", sa.String(length=50), nullable=True),
        sa.Column("disbursal_key", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("disbursal_key", name="uq_reward_ledger_disbursal_key"),
    )
    op.create_index(op.f("ix_reward_ledger_user_id"), "reward_ledger", ["user_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_reward_ledger_user_id"), table_name="reward_ledger")
    op.drop_table("reward_ledger")
    op.drop_table("user_streaks")
    op.drop_table("user_daily_activity")
    op.drop_table("challenge_progress")
    op.drop_index(op.f("ix_challenges_status"), table_name="challenges")
    op.drop_index(op.f("ix_challenges_event_type"), table_name="challenges")
    op.drop_table("challenges")
    op.drop_column("events", "retry_count")
    bind = op.get_bind()
    reward_type_enum.drop(bind, checkfirst=True)
    challenge_status_enum.drop(bind, checkfirst=True)
    challenge_type_enum.drop(bind, checkfirst=True)
