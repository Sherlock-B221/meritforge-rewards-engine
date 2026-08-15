import pytest

@pytest.mark.asyncio
async def test_register_login_me_flow(async_client):
    r = await async_client.post("/api/auth/register",
        json={"username": "ria", "email": "r@e.com", "password": "pw123456"})
    assert r.status_code == 201
    token = r.json()["token"]

    me = await async_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "ria"

@pytest.mark.asyncio
async def test_me_without_token_is_401(async_client):
    resp = await async_client.get("/api/auth/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] in ("UNAUTHORIZED", "INVALID_TOKEN")
