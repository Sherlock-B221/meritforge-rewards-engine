import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.constants import events as ev_const
from app.models import Challenge, ChallengeProgress, RewardLedgerEntry, UserDailyActivity, UserStreak
from app.schemas.common import Page
from app.schemas.engine import HeatmapDayOut, ProgressEntryOut, RewardOut, StreakOut, UserStreaksOut
from app.services.engine.periods import utc_today


async def get_my_progress(session: AsyncSession, *, user_id: uuid.UUID) -> list[ProgressEntryOut]:
    rows = (
        await session.execute(
            select(ChallengeProgress, Challenge)
            .join(Challenge, ChallengeProgress.challenge_id == Challenge.id)
            .where(ChallengeProgress.user_id == user_id)
            .order_by(ChallengeProgress.updated_at.desc())
        )
    ).all()
    return [
        ProgressEntryOut(
            challenge_id=challenge.id,
            challenge_name=challenge.name,
            type=challenge.type,
            event_type=challenge.event_type,
            period_key=progress.period_key,
            current_value=progress.current_value,
            target_value=progress.target_value,
            completed=progress.completed_at is not None,
            completed_at=progress.completed_at,
        )
        for progress, challenge in rows
    ]


async def get_my_streaks(session: AsyncSession, *, user_id: uuid.UUID) -> UserStreaksOut:
    streak_rows = (
        await session.execute(select(UserStreak).where(UserStreak.user_id == user_id))
    ).scalars().all()
    streaks = [
        StreakOut(
            event_type=s.event_type,
            current_streak=s.current_streak,
            best_streak=s.best_streak,
            last_activity_date=s.last_activity_date,
        )
        for s in streak_rows
    ]

    since = utc_today() - timedelta(days=get_settings().heatmap_days)
    heatmap_rows = (
        await session.execute(
            select(UserDailyActivity)
            .where(
                UserDailyActivity.user_id == user_id,
                UserDailyActivity.event_type == ev_const.CONTRIBUTION,
                UserDailyActivity.activity_date >= since,
            )
            .order_by(UserDailyActivity.activity_date.asc())
        )
    ).scalars().all()
    heatmap = [
        HeatmapDayOut(activity_date=row.activity_date, event_count=row.event_count)
        for row in heatmap_rows
    ]

    return UserStreaksOut(streaks=streaks, heatmap=heatmap)


async def get_my_rewards(
    session: AsyncSession, *, user_id: uuid.UUID, page: int = 1, limit: int = 20
) -> Page[RewardOut]:
    base_where = (RewardLedgerEntry.user_id == user_id,)
    total = (
        await session.execute(
            select(func.count()).select_from(RewardLedgerEntry).where(*base_where)
        )
    ).scalar_one()
    stmt = (
        select(RewardLedgerEntry, Challenge)
        .join(Challenge, RewardLedgerEntry.challenge_id == Challenge.id)
        .where(*base_where)
        .order_by(RewardLedgerEntry.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    items = [
        RewardOut(
            id=entry.id,
            challenge_id=entry.challenge_id,
            challenge_name=challenge.name,
            reward_type=entry.reward_type,
            amount=entry.amount,
            badge_code=entry.badge_code,
            created_at=entry.created_at,
        )
        for entry, challenge in rows
    ]
    return Page[RewardOut](
        items=items, page=page, limit=limit, total=total, has_next=(page * limit) < total
    )
