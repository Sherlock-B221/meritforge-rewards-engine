import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event
from app.schemas.engine import EventAccepted, EventIn
from app.services.events.publisher import publish_event


async def ingest_event(
    session: AsyncSession, *, user_id: uuid.UUID, data: EventIn
) -> EventAccepted:
    """Accept an event for async evaluation. Idempotent on event_id: a repeat
    submit stages nothing new and echoes the original row's status. Returns the
    acknowledgement the controller serialises with 202."""
    await publish_event(
        session,
        event_id=data.event_id,
        user_id=user_id,
        event_type=data.event_type,
        payload=data.payload,
        occurred_at=data.occurred_at,
    )
    await session.commit()
    row = await session.get(Event, data.event_id)
    return EventAccepted(event_id=data.event_id, status=row.status)
