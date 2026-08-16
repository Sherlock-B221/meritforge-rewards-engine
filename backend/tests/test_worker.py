import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.constants.enums import EventStatus
from app.core import worker
from app.models import Event


async def _add_pending(session, user_id, n):
    for i in range(n):
        session.add(
            Event(
                event_id=uuid.uuid4(),
                user_id=user_id,
                event_type="post_created",
                payload={"i": i},
                status=EventStatus.PENDING,
                occurred_at=datetime.now(timezone.utc),
            )
        )
    await session.commit()


@pytest.mark.asyncio
async def test_run_once_processes_all_pending(session_factory, db_session, user):
    await _add_pending(db_session, user.id, 3)
    seen = []

    async def fake_eval(session, *, event):
        seen.append(event.event_id)
        event.status = EventStatus.PROCESSED
        event.processed_at = datetime.now(timezone.utc)

    n = await worker.run_worker_once(session_factory, evaluate=fake_eval, batch_size=10)
    assert n == 3 and len(seen) == 3
    async with session_factory() as s:
        remaining = (
            await s.execute(select(Event).where(Event.status == EventStatus.PENDING))
        ).scalars().all()
    assert remaining == []


@pytest.mark.asyncio
async def test_run_once_is_idempotent_no_double_process(session_factory, db_session, user):
    await _add_pending(db_session, user.id, 2)
    calls = {"n": 0}

    async def fake_eval(session, *, event):
        calls["n"] += 1
        event.status = EventStatus.PROCESSED

    await worker.run_worker_once(session_factory, evaluate=fake_eval, batch_size=10)
    again = await worker.run_worker_once(session_factory, evaluate=fake_eval, batch_size=10)
    assert calls["n"] == 2  # second run found nothing pending
    assert again == 0


@pytest.mark.asyncio
async def test_failure_rolls_back_and_records_error_then_retries(session_factory, db_session, user):
    await _add_pending(db_session, user.id, 1)

    async def boom(session, *, event):
        raise RuntimeError("kaboom")

    processed = await worker.run_worker_once(session_factory, evaluate=boom, batch_size=10)
    assert processed == 1  # the event was claimed and attempted
    async with session_factory() as s:
        ev = (await s.execute(select(Event))).scalar_one()
    assert ev.status == EventStatus.PENDING  # still retriable (< max_retries)
    assert ev.retry_count == 1
    assert "kaboom" in (ev.error or "")
