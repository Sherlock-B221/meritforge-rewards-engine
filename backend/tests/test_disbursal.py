from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.constants.enums import ChallengeStatus, ChallengeType, RewardType
from app.models import Challenge, RewardLedgerEntry
from app.services.engine.rewards.disbursal import disburse_reward


async def _challenge(session, user, reward):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name="c", type=ChallengeType.COUNT, event_type="post_created",
        rule_config={"target": 1, "window": "total"}, reward=reward,
        status=ChallengeStatus.ACTIVE, start_at=now, end_at=now, created_by=user.id,
    )
    session.add(ch)
    await session.flush()
    return ch


@pytest.mark.asyncio
async def test_points_reward_writes_ledger_once(db_session, user):
    ch = await _challenge(db_session, user, {"type": "points", "amount": 50})
    now = datetime.now(timezone.utc)
    first = await disburse_reward(db_session, user_id=user.id, challenge=ch, period_key="", now=now)
    second = await disburse_reward(db_session, user_id=user.id, challenge=ch, period_key="", now=now)
    await db_session.commit()
    assert first is True and second is False  # at-most-once
    total = (await db_session.execute(select(func.count()).select_from(RewardLedgerEntry))).scalar_one()
    assert total == 1
    row = (await db_session.execute(select(RewardLedgerEntry))).scalar_one()
    assert row.reward_type == RewardType.POINTS and row.amount == 50
    assert row.disbursal_key == f"{ch.id}:{user.id}:"


@pytest.mark.asyncio
async def test_badge_reward_records_badge_code(db_session, user):
    ch = await _challenge(db_session, user, {"type": "badge", "badge_code": "first_solution"})
    now = datetime.now(timezone.utc)
    await disburse_reward(db_session, user_id=user.id, challenge=ch, period_key="", now=now)
    await db_session.commit()
    row = (await db_session.execute(select(RewardLedgerEntry))).scalar_one()
    assert row.reward_type == RewardType.BADGE and row.badge_code == "first_solution"
    assert row.amount is None


@pytest.mark.asyncio
async def test_distinct_periods_disburse_separately(db_session, user):
    ch = await _challenge(db_session, user, {"type": "points", "amount": 5})
    now = datetime.now(timezone.utc)
    a = await disburse_reward(db_session, user_id=user.id, challenge=ch, period_key="2026-W33", now=now)
    b = await disburse_reward(db_session, user_id=user.id, challenge=ch, period_key="2026-W34", now=now)
    await db_session.commit()
    assert a is True and b is True  # weekly resets → a fresh reward each period
    total = (await db_session.execute(select(func.count()).select_from(RewardLedgerEntry))).scalar_one()
    assert total == 2
