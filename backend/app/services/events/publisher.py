import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.enums import EventStatus
from app.models import Event


async def publish_event(
    session: AsyncSession,
    *,
    event_id: uuid.UUID,
    user_id: uuid.UUID,
    event_type: str,
    payload: dict,
    occurred_at: datetime | None = None,
) -> bool:
    """Transactional outbox: stage an event row in the CALLER's transaction.

    Idempotent on event_id (ON CONFLICT DO NOTHING). Returns True when a new row
    was inserted, False when the event_id already existed. Never commits — the
    caller commits the forum write and this event atomically.
    """
    stmt = (
        pg_insert(Event)
        .values(
            event_id=event_id,
            user_id=user_id,
            event_type=event_type,
            payload=payload,
            status=EventStatus.PENDING,
            occurred_at=occurred_at or datetime.now(timezone.utc),
        )
        .on_conflict_do_nothing(index_elements=["event_id"])
        .returning(Event.event_id)
    )
    result = await session.execute(stmt)
    return result.first() is not None
