from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.constants.enums import ChallengeStatus, ChallengeType
from app.models import Challenge, ChallengeProgress, UserStreak
from app.services.engine.evaluators.registry import get_evaluator


async def _make_challenge(session, user, *, ctype, rule, event_type):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name="c", type=ctype, event_type=event_type, rule_config=rule,
        reward={"type": "points", "amount": 10}, status=ChallengeStatus.ACTIVE,
        start_at=now - timedelta(days=1), end_at=now + timedelta(days=1), created_by=user.id,
    )
    session.add(ch)
    await session.flush()
    return ch


@pytest.mark.asyncio
async def test_count_evaluator_increments_and_completes(db_session, user):
    now = datetime.now(timezone.utc)
    ch = await _make_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 2, "window": "total"}, event_type="post_created",
    )
    ev = get_evaluator(ChallengeType.COUNT)
    o1 = await ev.evaluate(db_session, challenge=ch, user_id=user.id, now=now)
    assert o1.current_value == 1 and o1.completed is False and o1.period_key == ""
    o2 = await ev.evaluate(db_session, challenge=ch, user_id=user.id, now=now)
    assert o2.current_value == 2 and o2.completed is True
    await db_session.commit()
    rows = (await db_session.execute(select(ChallengeProgress))).scalars().all()
    assert len(rows) == 1 and rows[0].current_value == 2  # single upserted row


@pytest.mark.asyncio
async def test_count_evaluator_weekly_uses_iso_week_period(db_session, user):
    now = datetime(2026, 8, 16, 12, 0, tzinfo=timezone.utc)  # ISO week 33
    ch = await _make_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 5, "window": "weekly"}, event_type="comment_posted",
    )
    ev = get_evaluator(ChallengeType.COUNT)
    o = await ev.evaluate(db_session, challenge=ch, user_id=user.id, now=now)
    assert o.period_key == "2026-W33"


@pytest.mark.asyncio
async def test_streak_evaluator_mirrors_precomputed_streak(db_session, user):
    now = datetime.now(timezone.utc)
    db_session.add(
        UserStreak(user_id=user.id, event_type="contribution", current_streak=7, best_streak=7)
    )
    ch = await _make_challenge(
        db_session, user, ctype=ChallengeType.STREAK,
        rule={"target_days": 7}, event_type="contribution",
    )
    await db_session.flush()
    ev = get_evaluator(ChallengeType.STREAK)
    o = await ev.evaluate(db_session, challenge=ch, user_id=user.id, now=now)
    assert o.current_value == 7 and o.target_value == 7 and o.completed is True
