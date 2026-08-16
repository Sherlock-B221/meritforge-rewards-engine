import uuid
from datetime import date, timedelta

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserDailyActivity, UserStreak


async def record_activity(
    session: AsyncSession, *, user_id: uuid.UUID, event_type: str, activity_date: date
) -> None:
    """Increment the (user, day, event_type) activity counter. Feeds the streak
    logic and the contribution heatmap. Atomic upsert on the composite PK."""
    stmt = (
        pg_insert(UserDailyActivity)
        .values(user_id=user_id, activity_date=activity_date, event_type=event_type, event_count=1)
        .on_conflict_do_update(
            index_elements=["user_id", "activity_date", "event_type"],
            set_={"event_count": UserDailyActivity.event_count + 1},
        )
    )
    await session.execute(stmt)


async def advance_streak(
    session: AsyncSession, *, user_id: uuid.UUID, event_type: str, activity_date: date
) -> int:
    """Advance the (user, event_type) streak by UTC-day rules and return the
    resulting current_streak:

    - first-ever activity → 1
    - same UTC day again → unchanged (a day counts once)
    - the immediately-next day → +1
    - a gap of >1 day → reset to 1
    - an older / out-of-order day → ignored (streak unchanged)
    """
    streak = await session.get(UserStreak, (user_id, event_type))
    if streak is None:
        session.add(
            UserStreak(
                user_id=user_id,
                event_type=event_type,
                current_streak=1,
                best_streak=1,
                last_activity_date=activity_date,
            )
        )
        return 1

    last = streak.last_activity_date
    if last is None or activity_date > last:
        if last is not None and activity_date == last + timedelta(days=1):
            streak.current_streak += 1
        else:
            streak.current_streak = 1
        streak.last_activity_date = activity_date
        streak.best_streak = max(streak.best_streak, streak.current_streak)
    # activity_date == last (same day) or activity_date < last (out of order) → no change
    return streak.current_streak
