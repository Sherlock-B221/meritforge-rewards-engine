import uuid

import pytest
from sqlalchemy import select

from app.constants.enums import UserRole
from app.models import User
from app.services.auth.security import create_access_token


async def _register(client, username="ria"):
    r = await client.post(
        "/api/auth/register",
        json={"username": username, "email": f"{username}@e.com", "password": "pw123456"},
    )
    assert r.status_code == 201
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


async def _make_admin_token(db_session, username="admin1"):
    r_user = User(username=username, email=f"{username}@e.com", password_hash="x", role=UserRole.ADMIN)
    db_session.add(r_user)
    await db_session.commit()
    await db_session.refresh(r_user)
    return create_access_token(r_user.id, r_user.role)


def _valid_challenge_payload(**overrides):
    payload = {
        "name": "Post 5 threads",
        "description": "Create five threads this week",
        "type": "count",
        "event_type": "post_created",
        "rule_config": {"target": 5, "window": "total"},
        "reward": {"type": "points", "amount": 50},
        "start_at": "2026-01-01T00:00:00Z",
        "end_at": "2026-12-31T00:00:00Z",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_non_admin_forbidden_on_every_route(async_client, db_session):
    token = await _register(async_client)
    payload = _valid_challenge_payload()

    r1 = await async_client.post("/api/admin/challenges", json=payload, headers=_auth(token))
    assert r1.status_code == 403

    r2 = await async_client.get("/api/admin/challenges", headers=_auth(token))
    assert r2.status_code == 403

    fake_id = uuid.uuid4()
    r3 = await async_client.patch(
        f"/api/admin/challenges/{fake_id}", json={"name": "x"}, headers=_auth(token)
    )
    assert r3.status_code == 403

    r4 = await async_client.delete(f"/api/admin/challenges/{fake_id}", headers=_auth(token))
    assert r4.status_code == 403


@pytest.mark.asyncio
async def test_full_lifecycle_create_list_patch_transition_delete(async_client, db_session):
    admin_token = await _make_admin_token(db_session)

    created = await async_client.post(
        "/api/admin/challenges", json=_valid_challenge_payload(), headers=_auth(admin_token)
    )
    assert created.status_code == 201
    body = created.json()
    assert body["status"] == "draft"
    challenge_id = body["id"]

    listed = await async_client.get("/api/admin/challenges", headers=_auth(admin_token))
    assert listed.status_code == 200
    assert any(c["id"] == challenge_id for c in listed.json())

    filtered = await async_client.get(
        "/api/admin/challenges?status=draft", headers=_auth(admin_token)
    )
    assert filtered.status_code == 200
    assert all(c["status"] == "draft" for c in filtered.json())

    patched_config = await async_client.patch(
        f"/api/admin/challenges/{challenge_id}",
        json={"rule_config": {"target": 10, "window": "total"}},
        headers=_auth(admin_token),
    )
    assert patched_config.status_code == 200
    assert patched_config.json()["rule_config"]["target"] == 10

    activated = await async_client.patch(
        f"/api/admin/challenges/{challenge_id}",
        json={"status": "active"},
        headers=_auth(admin_token),
    )
    assert activated.status_code == 200
    assert activated.json()["status"] == "active"

    invalid_transition = await async_client.patch(
        f"/api/admin/challenges/{challenge_id}",
        json={"status": "draft"},
        headers=_auth(admin_token),
    )
    assert invalid_transition.status_code == 409
    assert invalid_transition.json()["error"]["code"] == "INVALID_STATUS_TRANSITION"

    deleted = await async_client.delete(
        f"/api/admin/challenges/{challenge_id}", headers=_auth(admin_token)
    )
    assert deleted.status_code == 204

    deleted_again = await async_client.delete(
        f"/api/admin/challenges/{challenge_id}", headers=_auth(admin_token)
    )
    assert deleted_again.status_code == 204

    from app.models import Challenge

    row = (
        await db_session.execute(select(Challenge).where(Challenge.id == uuid.UUID(challenge_id)))
    ).scalar_one()
    assert row.status.value == "archived"


@pytest.mark.asyncio
async def test_rule_config_type_mismatch_is_422(async_client, db_session):
    admin_token = await _make_admin_token(db_session)
    bad_payload = _valid_challenge_payload(
        type="streak", rule_config={"target": 5, "window": "total"}
    )
    r = await async_client.post("/api/admin/challenges", json=bad_payload, headers=_auth(admin_token))
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_not_found_is_404(async_client, db_session):
    admin_token = await _make_admin_token(db_session)
    r = await async_client.patch(
        f"/api/admin/challenges/{uuid.uuid4()}", json={"name": "whatever"}, headers=_auth(admin_token)
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_missing_challenge_is_404(async_client, db_session):
    admin_token = await _make_admin_token(db_session)
    r = await async_client.delete(
        f"/api/admin/challenges/{uuid.uuid4()}", headers=_auth(admin_token)
    )
    assert r.status_code == 404
