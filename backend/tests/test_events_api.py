import uuid

import pytest

from app.services.auth.security import create_access_token
from app.constants.enums import UserRole
from app.core.rate_limit import events_limiter


@pytest.fixture(autouse=True)
def _clear_limiter():
    events_limiter.reset()
    yield
    events_limiter.reset()


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.id, UserRole.USER)}"}


@pytest.mark.asyncio
async def test_post_event_returns_202_and_echoes(async_client, user):
    eid = str(uuid.uuid4())
    resp = await async_client.post(
        "/api/events",
        headers=_auth(user),
        json={"event_id": eid, "event_type": "post_created", "payload": {"post_id": "p1"}},
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["event_id"] == eid
    assert body["status"] == "pending"


@pytest.mark.asyncio
async def test_post_event_is_idempotent(async_client, user):
    eid = str(uuid.uuid4())
    payload = {"event_id": eid, "event_type": "post_created", "payload": {}}
    first = await async_client.post("/api/events", headers=_auth(user), json=payload)
    second = await async_client.post("/api/events", headers=_auth(user), json=payload)
    assert first.status_code == 202 and second.status_code == 202
    assert second.json()["event_id"] == eid  # same ack, no error


@pytest.mark.asyncio
async def test_post_event_requires_auth(async_client):
    resp = await async_client.post(
        "/api/events", json={"event_id": str(uuid.uuid4()), "event_type": "x"}
    )
    assert resp.status_code == 401
