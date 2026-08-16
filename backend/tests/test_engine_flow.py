import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus
from app.core import worker
from app.models import Challenge, ChallengeProgress, Event, RewardLedgerEntry, UserStreak
from app.schemas.engine import EventIn
from app.services.engine import ingestion_service


async def _active_challenge(session, user, **kw):
    now = datetime.now(timezone.utc)
    defaults = dict(
        name="c", status=ChallengeStatus.ACTIVE,
        start_at=now - timedelta(days=1), end_at=now + timedelta(days=1), created_by=user.id,
    )
    ch = Challenge(**{**defaults, **kw})
    session.add(ch)
    await session.commit()
    return ch


@pytest.mark.asyncio
async def test_full_flow_emit_worker_progress_reward_at_most_once(session_factory, db_session, user):
    # A count challenge: 2 post_created events → +50 points, once.
    ch = await _active_challenge(
        db_session, user, type=ChallengeType.COUNT, event_type=ev_const.POST_CREATED,
        rule_config={"target": 2, "window": "total"}, reward={"type": "points", "amount": 50},
    )
    # Emit two distinct events through the real ingestion path (202 semantics).
    for _ in range(2):
        await ingestion_service.ingest_event(
            db_session,
            user_id=user.id,
            data=EventIn(event_id=uuid.uuid4(), event_type=ev_const.POST_CREATED, payload={}),
        )

    # The durable worker (default evaluate = real evaluate_event) drains the queue.
    processed = await worker.run_worker_once(session_factory, batch_size=10)
    assert processed == 2

    async with session_factory() as s:
        prog = (await s.execute(select(ChallengeProgress).where(ChallengeProgress.challenge_id == ch.id))).scalar_one()
        assert prog.current_value == 2 and prog.completed_at is not None
        ledger = (await s.execute(select(func.count()).select_from(RewardLedgerEntry))).scalar_one()
        assert ledger == 1  # reward disbursed exactly once
        pending = (await s.execute(select(func.count()).select_from(Event).where(Event.status == EventStatus.PENDING))).scalar_one()
        assert pending == 0

    # Re-running the worker must not disburse again (at-most-once, idempotent).
    again = await worker.run_worker_once(session_factory, batch_size=10)
    assert again == 0
    async with session_factory() as s:
        ledger = (await s.execute(select(func.count()).select_from(RewardLedgerEntry))).scalar_one()
        assert ledger == 1


@pytest.mark.asyncio
async def test_duplicate_event_id_is_deduped_at_ingest(session_factory, db_session, user):
    eid = uuid.uuid4()
    for _ in range(2):
        await ingestion_service.ingest_event(
            db_session, user_id=user.id, data=EventIn(event_id=eid, event_type=ev_const.POST_CREATED)
        )
    async with session_factory() as s:
        count = (await s.execute(select(func.count()).select_from(Event))).scalar_one()
    assert count == 1  # second submit was a no-op


@pytest.mark.asyncio
async def test_streak_challenge_completes_over_consecutive_days(session_factory, db_session, user):
    # 3-day contribution streak → a badge, once.
    await _active_challenge(
        db_session, user, type=ChallengeType.STREAK, event_type=ev_const.CONTRIBUTION,
        rule_config={"target_days": 3}, reward={"type": "badge", "badge_code": "streak_3"},
    )
    base = datetime.now(timezone.utc) - timedelta(days=2)
    for i in range(3):
        await ingestion_service.ingest_event(
            db_session,
            user_id=user.id,
            data=EventIn(
                event_id=uuid.uuid4(),
                event_type=ev_const.POST_CREATED,
                occurred_at=base + timedelta(days=i),
            ),
        )
    await worker.run_worker_once(session_factory, batch_size=10)
    async with session_factory() as s:
        streak = await s.get(UserStreak, (user.id, ev_const.CONTRIBUTION))
        assert streak.current_streak == 3
        badges = (await s.execute(select(RewardLedgerEntry).where(RewardLedgerEntry.badge_code == "streak_3"))).scalars().all()
        assert len(badges) == 1
