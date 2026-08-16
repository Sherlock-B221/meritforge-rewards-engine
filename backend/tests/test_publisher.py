import uuid

import pytest
from sqlalchemy import func, select

from app.constants.enums import EventStatus
from app.models import Event
from app.services.events.publisher import publish_event


async def _count(session):
    return (await session.execute(select(func.count()).select_from(Event))).scalar_one()


@pytest.mark.asyncio
async def test_publish_event_stages_pending_row(db_session, user):
    eid = uuid.uuid4()
    inserted = await publish_event(
        db_session, event_id=eid, user_id=user.id, event_type="post_created", payload={"post_id": "abc"}
    )
    await db_session.commit()
    assert inserted is True
    row = (await db_session.execute(select(Event).where(Event.event_id == eid))).scalar_one()
    assert row.status == EventStatus.PENDING
    assert row.payload == {"post_id": "abc"}
    assert row.occurred_at is not None


@pytest.mark.asyncio
async def test_publish_event_is_idempotent(db_session, user):
    eid = uuid.uuid4()
    first = await publish_event(db_session, event_id=eid, user_id=user.id, event_type="x", payload={})
    second = await publish_event(db_session, event_id=eid, user_id=user.id, event_type="x", payload={})
    await db_session.commit()
    assert first is True and second is False
    assert await _count(db_session) == 1


@pytest.mark.asyncio
async def test_publish_event_does_not_commit(db_session, user):
    # Rides the caller's transaction: a rollback discards the staged event.
    await publish_event(db_session, event_id=uuid.uuid4(), user_id=user.id, event_type="x", payload={})
    await db_session.rollback()
    assert await _count(db_session) == 0
