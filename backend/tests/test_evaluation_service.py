import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus
from app.models import (
    Challenge,
    ChallengeProgress,
    Event,
    RewardLedgerEntry,
    UserDailyActivity,
    UserStreak,
)
from app.services.engine.evaluation_service import evaluate_event


async def _active_count_challenge(session, user, *, target, event_type, amount=50):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name="c", type=ChallengeType.COUNT, event_type=event_type,
        rule_config={"target": target, "window": "total"},
        reward={"type": "points", "amount": amount}, status=ChallengeStatus.ACTIVE,
        start_at=now - timedelta(days=1), end_at=now + timedelta(days=1), created_by=user.id,
    )
    session.add(ch)
    await session.flush()
    return ch


async def _pending_event(session, user, event_type, occurred_at=None):
    e = Event(
        event_id=uuid.uuid4(), user_id=user.id, event_type=event_type, payload={},
        status=EventStatus.PENDING, occurred_at=occurred_at or datetime.now(timezone.utc),
    )
    session.add(e)
    await session.flush()
    return e


@pytest.mark.asyncio
async def test_evaluate_records_activity_streak_and_marks_processed(db_session, user):
    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()
    assert e.status == EventStatus.PROCESSED and e.processed_at is not None
    # activity recorded for the raw type AND the synthetic contribution type
    types = {
        r.event_type
        for r in (await db_session.execute(select(UserDailyActivity))).scalars().all()
    }
    assert ev_const.POST_CREATED in types and ev_const.CONTRIBUTION in types
    streak = await db_session.get(UserStreak, (user.id, ev_const.CONTRIBUTION))
    assert streak.current_streak == 1


@pytest.mark.asyncio
async def test_evaluate_completes_count_challenge_and_disburses_once(db_session, user):
    await _active_count_challenge(db_session, user, target=2, event_type=ev_const.POST_CREATED)
    e1 = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e1)
    await db_session.commit()
    prog = (await db_session.execute(select(ChallengeProgress))).scalar_one()
    assert prog.current_value == 1 and prog.completed_at is None
    e2 = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e2)
    await db_session.commit()
    # progress is incremented via raw upsert (bypasses the ORM identity map); expire
    # the loaded objects so the re-read reflects the authoritative DB state.
    db_session.expire_all()
    prog = (await db_session.execute(select(ChallengeProgress))).scalar_one()
    assert prog.current_value == 2 and prog.completed_at is not None
    ledger = (await db_session.execute(select(func.count()).select_from(RewardLedgerEntry))).scalar_one()
    assert ledger == 1  # disbursed exactly once on completion


@pytest.mark.asyncio
async def test_evaluate_already_processed_is_noop(db_session, user):
    await _active_count_challenge(db_session, user, target=1, event_type=ev_const.POST_CREATED)
    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    e.status = EventStatus.PROCESSED  # simulate an already-done event
    await db_session.flush()
    await evaluate_event(db_session, event=e)
    await db_session.commit()
    progress = (await db_session.execute(select(func.count()).select_from(ChallengeProgress))).scalar_one()
    assert progress == 0  # nothing evaluated


@pytest.mark.asyncio
async def test_evaluate_ignores_non_matching_and_inactive_challenges(db_session, user):
    # matching event_type but DRAFT status → ignored
    now = datetime.now(timezone.utc)
    draft = Challenge(
        name="d", type=ChallengeType.COUNT, event_type=ev_const.POST_CREATED,
        rule_config={"target": 1, "window": "total"}, reward={"type": "points", "amount": 5},
        status=ChallengeStatus.DRAFT, start_at=now - timedelta(days=1), end_at=now + timedelta(days=1),
        created_by=user.id,
    )
    db_session.add(draft)
    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()
    progress = (await db_session.execute(select(func.count()).select_from(ChallengeProgress))).scalar_one()
    assert progress == 0
