import pytest


async def _register(client, username="ria"):
    r = await client.post(
        "/api/auth/register",
        json={"username": username, "email": f"{username}@e.com", "password": "pw123456"},
    )
    assert r.status_code == 201
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_list_and_detail_flow(async_client):
    token = await _register(async_client)
    created = await async_client.post(
        "/api/posts", json={"title": "My first thread", "body": "hello", "tags": ["q"]}, headers=_auth(token)
    )
    assert created.status_code == 201
    post_id = created.json()["id"]

    feed = await async_client.get("/api/posts?sort=latest&page=1&limit=10", headers=_auth(token))
    assert feed.status_code == 200
    body = feed.json()
    assert body["total"] == 1 and body["items"][0]["id"] == post_id

    detail = await async_client.get(f"/api/posts/{post_id}", headers=_auth(token))
    assert detail.status_code == 200
    assert detail.json()["view_count"] == 1 and detail.json()["comments"] == []


@pytest.mark.asyncio
async def test_upvote_endpoint(async_client):
    token = await _register(async_client)
    post_id = (await async_client.post(
        "/api/posts", json={"title": "Upvote target", "body": "b"}, headers=_auth(token)
    )).json()["id"]
    r = await async_client.post(f"/api/posts/{post_id}/upvote", headers=_auth(token))
    assert r.status_code == 200
    assert r.json() == {"post_id": post_id, "upvote_count": 1, "upvoted": True}


@pytest.mark.asyncio
async def test_posts_require_auth(async_client):
    assert (await async_client.get("/api/posts")).status_code == 401


@pytest.mark.asyncio
async def test_invalid_sort_is_422(async_client):
    token = await _register(async_client)
    r = await async_client.get("/api/posts?sort=bogus", headers=_auth(token))
    assert r.status_code == 422
