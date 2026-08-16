import asyncio
import uuid
from collections.abc import Awaitable, Callable, Collection

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import get_settings
from app.constants.enums import EventStatus
from app.core.db import engine
from app.models import Event

EvaluateFn = Callable[..., Awaitable[None]]


async def claim_pending(
    session: AsyncSession,
    limit: int = 1,
    *,
    exclude: Collection[uuid.UUID] | None = None,
) -> list[Event]:
    """Claim up to `limit` pending events, skipping rows another worker holds.
    Row locks are held for the life of the caller's transaction. `exclude` skips
    event ids already attempted in the current pass so a failed-but-retriable
    event is retried on the next poll cycle, not re-hammered within one pass."""
    stmt = (
        select(Event)
        .where(Event.status == EventStatus.PENDING)
        .order_by(Event.received_at.asc())
        .with_for_update(skip_locked=True)
        .limit(limit)
    )
    if exclude:
        stmt = stmt.where(Event.event_id.notin_(exclude))
    return list((await session.execute(stmt)).scalars().all())


async def _resolve_evaluate(evaluate: EvaluateFn | None) -> EvaluateFn:
    if evaluate is not None:
        return evaluate
    # Lazy import so the worker module does not hard-depend on chunk (d) at import time.
    from app.services.engine.evaluation_service import evaluate_event

    return evaluate_event


async def process_next(
    session: AsyncSession,
    *,
    evaluate: EvaluateFn,
    exclude: Collection[uuid.UUID] | None = None,
) -> uuid.UUID | None:
    """Claim one event and evaluate it in a single transaction. On failure,
    roll back the whole unit and record the error (event stays retriable until
    max_retries, then it is marked failed). Returns the claimed event's id, or
    None if nothing was claimed. `exclude` skips ids already attempted this pass."""
    claimed = await claim_pending(session, limit=1, exclude=exclude)
    if not claimed:
        return None
    event = claimed[0]
    event_id = event.event_id
    try:
        await evaluate(session, event=event)
        await session.commit()
    except Exception as exc:  # noqa: BLE001 — the worker must never die on one bad event
        await session.rollback()
        await _record_failure(session, event_id, str(exc))
    return event_id


async def _record_failure(session: AsyncSession, event_id, message: str) -> None:
    max_retries = get_settings().worker_max_retries
    ev = await session.get(Event, event_id)
    if ev is None:
        return
    ev.retry_count += 1
    ev.error = message[:2000]
    if ev.retry_count >= max_retries:
        ev.status = EventStatus.FAILED
    await session.commit()


async def run_worker_once(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    evaluate: EvaluateFn | None = None,
    batch_size: int | None = None,
) -> int:
    """Process up to `batch_size` events, each in its own session/transaction so
    per-event evaluation is atomic. Returns the number of events attempted."""
    evaluate = await _resolve_evaluate(evaluate)
    limit = batch_size if batch_size is not None else get_settings().worker_batch_size
    seen: set[uuid.UUID] = set()
    for _ in range(limit):
        async with session_factory() as session:
            event_id = await process_next(session, evaluate=evaluate, exclude=seen)
        if event_id is None:
            break
        seen.add(event_id)
    return len(seen)


async def run_forever(evaluate: EvaluateFn | None = None) -> None:  # pragma: no cover
    """Poll loop for the worker process. Survives restarts (all state is in Postgres)."""
    s = get_settings()
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    poll = s.worker_poll_interval_ms / 1000
    while True:
        n = await run_worker_once(factory, evaluate=evaluate, batch_size=s.worker_batch_size)
        if n == 0:
            await asyncio.sleep(poll)
