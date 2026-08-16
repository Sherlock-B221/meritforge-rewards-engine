import uuid
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus, RewardType
from app.models.base import Base


class Event(Base):
    __tablename__ = "events"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[EventStatus] = mapped_column(
        SAEnum(EventStatus, name="event_status", values_callable=lambda e: [m.value for m in e]),
        default=EventStatus.PENDING,
        index=True,
        nullable=False,
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    type: Mapped[ChallengeType] = mapped_column(
        SAEnum(ChallengeType, name="challenge_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    rule_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reward: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[ChallengeStatus] = mapped_column(
        SAEnum(ChallengeStatus, name="challenge_status", values_callable=lambda e: [m.value for m in e]),
        default=ChallengeStatus.DRAFT,
        index=True,
        nullable=False,
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ChallengeProgress(Base):
    __tablename__ = "challenge_progress"
    __table_args__ = (
        UniqueConstraint(
            "challenge_id", "user_id", "period_key", name="uq_progress_challenge_user_period"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    period_key: Mapped[str] = mapped_column(String(16), nullable=False, default="")
    current_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    target_value: Mapped[int] = mapped_column(Integer, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class UserDailyActivity(Base):
    __tablename__ = "user_daily_activity"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    activity_date: Mapped[date] = mapped_column(Date, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), primary_key=True)
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class UserStreak(Base):
    __tablename__ = "user_streaks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    event_type: Mapped[str] = mapped_column(String(100), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class RewardLedgerEntry(Base):
    __tablename__ = "reward_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    challenge_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenges.id"), nullable=False
    )
    reward_type: Mapped[RewardType] = mapped_column(
        SAEnum(RewardType, name="reward_type", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    badge_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    disbursal_key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
