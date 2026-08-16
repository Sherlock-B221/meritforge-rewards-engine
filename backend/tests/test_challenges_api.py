import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus
from app.models import Challenge, Event
from app.services.auth.security import create_access_token
from app.services.engine.evaluation_service import evaluate_event
from app.services.engine.periods import next_monday_utc


def _token_for(user):
    return create_access_token(user.id, user.role)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _active_challenge(session, user, *, ctype, rule, event_type, name="c"):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name=name, type=ctype, event_type=event_type, rule_config=rule,
        reward={"type": "points", "amount": 10}, status=ChallengeStatus.ACTIVE,
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
async def test_challenges_require_auth(async_client):
    assert (await async_client.get("/api/challenges")).status_code == 401
    assert (await async_client.get("/api/challenges/weekly")).status_code == 401


@pytest.mark.asyncio
async def test_list_only_returns_active_and_defaults_progress_to_zero(async_client, db_session, user):
    token = _token_for(user)
    # ACTIVE challenge with no progress row yet.
    await _active_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 3, "window": "total"}, event_type=ev_const.POST_CREATED, name="active-one",
    )
    # DRAFT challenge should be excluded.
    draft = Challenge(
        name="draft-one", type=ChallengeType.COUNT, event_type=ev_const.POST_CREATED,
        rule_config={"target": 1, "window": "total"}, reward={"type": "points", "amount": 5},
        status=ChallengeStatus.DRAFT,
        start_at=datetime.now(timezone.utc) - timedelta(days=1),
        end_at=datetime.now(timezone.utc) + timedelta(days=1), created_by=user.id,
    )
    db_session.add(draft)
    await db_session.commit()

    r = await async_client.get("/api/challenges", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    names = {c["name"] for c in body}
    assert "active-one" in names
    assert "draft-one" not in names

    active = next(c for c in body if c["name"] == "active-one")
    assert active["progress"] == {
        "period_key": "", "current_value": 0, "target_value": 3, "completed": False
    }


@pytest.mark.asyncio
async def test_list_reflects_real_progress_after_evaluating_event(async_client, db_session, user):
    token = _token_for(user)
    ch = await _active_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 5, "window": "total"}, event_type=ev_const.POST_CREATED, name="progressed",
    )
    await db_session.commit()

    before = await async_client.get("/api/challenges", headers=_auth(token))
    before_progress = next(c for c in before.json() if c["id"] == str(ch.id))["progress"]
    assert before_progress["current_value"] == 0

    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()

    after = await async_client.get("/api/challenges", headers=_auth(token))
    after_progress = next(c for c in after.json() if c["id"] == str(ch.id))["progress"]
    assert after_progress["current_value"] == 1
    assert after_progress["completed"] is False


@pytest.mark.asyncio
async def test_weekly_returns_404_when_none_active(async_client, db_session, user):
    token = _token_for(user)
    r = await async_client.get("/api/challenges/weekly", headers=_auth(token))
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_weekly_returns_challenge_with_future_monday_reset(async_client, db_session, user):
    token = _token_for(user)
    ch = await _active_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 5, "window": "weekly"}, event_type=ev_const.POST_CREATED, name="weekly-one",
    )
    await db_session.commit()

    r = await async_client.get("/api/challenges/weekly", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == str(ch.id)
    resets_at = datetime.fromisoformat(body["resets_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    assert resets_at > now
    assert resets_at.weekday() == 0 and resets_at.hour == 0 and resets_at.minute == 0
    assert resets_at == next_monday_utc(resets_at - timedelta(days=1))
