import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus
from app.models import Challenge, Event
from app.services.auth.security import create_access_token
from app.services.engine.evaluation_service import evaluate_event


def _token_for(user):
    return create_access_token(user.id, user.role)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _active_challenge(session, user, *, ctype, rule, event_type, reward=None, name="c"):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name=name, type=ctype, event_type=event_type, rule_config=rule,
        reward=reward or {"type": "points", "amount": 10}, status=ChallengeStatus.ACTIVE,
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
async def test_progress_endpoints_require_auth(async_client):
    assert (await async_client.get("/api/users/me/progress")).status_code == 401
    assert (await async_client.get("/api/users/me/streaks")).status_code == 401
    assert (await async_client.get("/api/users/me/rewards")).status_code == 401


@pytest.mark.asyncio
async def test_my_progress_reflects_real_progress_after_evaluating_event(async_client, db_session, user):
    token = _token_for(user)
    ch = await _active_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 5, "window": "total"}, event_type=ev_const.POST_CREATED, name="progressed",
    )
    await db_session.commit()

    # No progress row yet → empty list.
    before = await async_client.get("/api/users/me/progress", headers=_auth(token))
    assert before.status_code == 200
    assert before.json() == []

    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()

    after = await async_client.get("/api/users/me/progress", headers=_auth(token))
    assert after.status_code == 200
    body = after.json()
    assert len(body) == 1
    entry = body[0]
    assert entry["challenge_id"] == str(ch.id)
    assert entry["challenge_name"] == "progressed"
    assert entry["type"] == "count"
    assert entry["event_type"] == ev_const.POST_CREATED
    assert entry["current_value"] == 1
    assert entry["target_value"] == 5
    assert entry["completed"] is False
    assert entry["completed_at"] is None


@pytest.mark.asyncio
async def test_my_streaks_heatmap_contains_day_after_contribution_event(async_client, db_session, user):
    token = _token_for(user)
    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()

    r = await async_client.get("/api/users/me/streaks", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()

    streak_types = {s["event_type"]: s for s in body["streaks"]}
    assert ev_const.CONTRIBUTION in streak_types
    assert streak_types[ev_const.CONTRIBUTION]["current_streak"] == 1
    assert streak_types[ev_const.POST_CREATED]["current_streak"] == 1

    assert len(body["heatmap"]) == 1
    assert body["heatmap"][0]["event_count"] == 1


@pytest.mark.asyncio
async def test_my_rewards_is_paginated_and_reflects_disbursed_reward(async_client, db_session, user):
    token = _token_for(user)
    ch = await _active_challenge(
        db_session, user, ctype=ChallengeType.COUNT,
        rule={"target": 1, "window": "total"}, event_type=ev_const.POST_CREATED,
        reward={"type": "points", "amount": 50}, name="rewarded",
    )
    await db_session.commit()

    empty = await async_client.get("/api/users/me/rewards", headers=_auth(token))
    assert empty.status_code == 200
    assert empty.json()["total"] == 0

    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()

    r = await async_client.get("/api/users/me/rewards?page=1&limit=10", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["has_next"] is False
    reward = body["items"][0]
    assert reward["challenge_id"] == str(ch.id)
    assert reward["challenge_name"] == "rewarded"
    assert reward["reward_type"] == "points"
    assert reward["amount"] == 50
    assert reward["badge_code"] is None
