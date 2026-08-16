from datetime import date

import pytest
from sqlalchemy import select

from app.models import UserDailyActivity, UserStreak
from app.services.engine.streaks import advance_streak, record_activity


async def _streak(session, user_id, event_type):
    return await session.get(UserStreak, (user_id, event_type))


@pytest.mark.asyncio
async def test_first_activity_starts_streak_at_one(db_session, user):
    n = await advance_streak(
        db_session, user_id=user.id, event_type="contribution", activity_date=date(2026, 8, 16)
    )
    await db_session.commit()
    assert n == 1
    s = await _streak(db_session, user.id, "contribution")
    assert s.current_streak == 1 and s.best_streak == 1


@pytest.mark.asyncio
async def test_consecutive_day_increments(db_session, user):
    await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 16))
    n = await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 17))
    await db_session.commit()
    assert n == 2


@pytest.mark.asyncio
async def test_same_day_again_is_noop(db_session, user):
    await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 16))
    n = await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 16))
    await db_session.commit()
    assert n == 1


@pytest.mark.asyncio
async def test_gap_resets_to_one(db_session, user):
    await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 16))
    await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 17))
    n = await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 20))
    await db_session.commit()
    assert n == 1
    s = await _streak(db_session, user.id, "c")
    assert s.best_streak == 2  # remembers the earlier peak


@pytest.mark.asyncio
async def test_out_of_order_older_event_ignored(db_session, user):
    await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 17))
    n = await advance_streak(db_session, user_id=user.id, event_type="c", activity_date=date(2026, 8, 16))
    await db_session.commit()
    assert n == 1  # unchanged; older date does not move the streak
    s = await _streak(db_session, user.id, "c")
    assert s.last_activity_date == date(2026, 8, 17)


@pytest.mark.asyncio
async def test_record_activity_increments_daily_count(db_session, user):
    await record_activity(db_session, user_id=user.id, event_type="post_created", activity_date=date(2026, 8, 16))
    await record_activity(db_session, user_id=user.id, event_type="post_created", activity_date=date(2026, 8, 16))
    await db_session.commit()
    row = (
        await db_session.execute(
            select(UserDailyActivity).where(UserDailyActivity.user_id == user.id)
        )
    ).scalar_one()
    assert row.event_count == 2
