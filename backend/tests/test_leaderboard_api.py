import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus
from app.models import Challenge, Event, User
from app.services.auth.security import create_access_token
from app.services.engine.evaluation_service import evaluate_event


def _token_for(user):
    return create_access_token(user.id, user.role)


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _active_challenge(session, owner, *, event_type, target, reward, name):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name=name, type=ChallengeType.COUNT, event_type=event_type,
        rule_config={"target": target, "window": "total"}, reward=reward,
        status=ChallengeStatus.ACTIVE,
        start_at=now - timedelta(days=1), end_at=now + timedelta(days=1), created_by=owner.id,
    )
    session.add(ch)
    await session.flush()
    return ch


async def _pending_event(session, actor, event_type):
    e = Event(
        event_id=uuid.uuid4(), user_id=actor.id, event_type=event_type, payload={},
        status=EventStatus.PENDING, occurred_at=datetime.now(timezone.utc),
    )
    session.add(e)
    await session.flush()
    return e


@pytest.mark.asyncio
async def test_leaderboard_requires_auth(async_client):
    assert (await async_client.get("/api/leaderboard")).status_code == 401


@pytest.mark.asyncio
async def test_leaderboard_ranks_by_points_and_excludes_zero_reward_users(async_client, db_session, user, other_user):
    # `user` earns 100 points (2 events x 50), `other_user` earns 50, a third
    # user (no rewards at all) must be absent from the leaderboard.
    zero_user = User(username="zero", email="zero@example.com", password_hash="x")
    db_session.add(zero_user)
    await db_session.commit()
    await db_session.refresh(zero_user)

    ch_big = await _active_challenge(
        db_session, user, event_type=ev_const.POST_CREATED, target=1,
        reward={"type": "points", "amount": 50}, name="big",
    )
    ch_small = await _active_challenge(
        db_session, other_user, event_type=ev_const.COMMENT_POSTED, target=1,
        reward={"type": "points", "amount": 50}, name="small",
    )
    await db_session.commit()

    # user completes ch_big twice is impossible (COUNT total, target=1 completes once) —
    # instead give `user` two separate challenges' worth of points via two events on ch_big
    # plus a badge challenge, so total_points ends up strictly greater than other_user's.
    ch_big2 = await _active_challenge(
        db_session, user, event_type=ev_const.SOLUTION_MARKED, target=1,
        reward={"type": "points", "amount": 50}, name="big2",
    )
    await db_session.commit()

    e1 = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e1)
    await db_session.commit()
    e2 = await _pending_event(db_session, user, ev_const.SOLUTION_MARKED)
    await evaluate_event(db_session, event=e2)
    await db_session.commit()

    e3 = await _pending_event(db_session, other_user, ev_const.COMMENT_POSTED)
    await evaluate_event(db_session, event=e3)
    await db_session.commit()

    token = _token_for(user)
    r = await async_client.get("/api/leaderboard", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    usernames = [item["username"] for item in body["items"]]
    assert "zero" not in usernames
    assert body["total"] == 2

    assert body["items"][0]["username"] == user.username
    assert body["items"][0]["rank"] == 1
    assert body["items"][0]["total_points"] == 100

    assert body["items"][1]["username"] == other_user.username
    assert body["items"][1]["rank"] == 2
    assert body["items"][1]["total_points"] == 50

    assert ch_big.id and ch_small.id and ch_big2.id  # sanity: challenges were created


@pytest.mark.asyncio
async def test_leaderboard_badge_count_and_pagination(async_client, db_session, user):
    ch = await _active_challenge(
        db_session, user, event_type=ev_const.POST_CREATED, target=1,
        reward={"type": "badge", "badge_code": "first"}, name="badge-challenge",
    )
    await db_session.commit()
    e = await _pending_event(db_session, user, ev_const.POST_CREATED)
    await evaluate_event(db_session, event=e)
    await db_session.commit()

    token = _token_for(user)
    r = await async_client.get("/api/leaderboard?page=1&limit=1", headers=_auth(token))
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["has_next"] is False
    assert body["items"][0]["badge_count"] == 1
    assert body["items"][0]["total_points"] == 0
    assert ch.id
