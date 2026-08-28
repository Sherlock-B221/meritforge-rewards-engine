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
async def test_posts_list_is_public(async_client):
    # Public read: the feed is available without a token.
    r = await async_client.get("/api/posts")
    assert r.status_code == 200
    assert r.json()["total"] == 0


@pytest.mark.asyncio
async def test_post_detail_is_public_and_anon_view_is_side_effect_free(async_client, db_session):
    from sqlalchemy import func, select

    from app.constants import events as ev
    from app.models import Event

    token = await _register(async_client)
    post_id = (
        await async_client.post(
            "/api/posts", json={"title": "Public thread", "body": "b"}, headers=_auth(token)
        )
    ).json()["id"]

    async def _viewed_count():
        return (
            await db_session.execute(
                select(func.count()).select_from(Event).where(Event.event_type == ev.POST_VIEWED)
            )
        ).scalar_one()

    # Anonymous detail read works, emits no post_viewed event, and doesn't bump view_count.
    anon = await async_client.get(f"/api/posts/{post_id}")
    assert anon.status_code == 200
    assert anon.json()["view_count"] == 0
    assert await _viewed_count() == 0

    # A logged-in view still emits the event and bumps the counter (unchanged behaviour).
    authed = await async_client.get(f"/api/posts/{post_id}", headers=_auth(token))
    assert authed.status_code == 200
    assert authed.json()["view_count"] == 1
    assert await _viewed_count() == 1


@pytest.mark.asyncio
async def test_forum_writes_still_require_auth(async_client):
    # Every mutating forum endpoint stays gated behind auth.
    fake = "00000000-0000-0000-0000-000000000000"
    assert (await async_client.post("/api/posts", json={"title": "x", "body": "y"})).status_code == 401
    assert (
        await async_client.post(f"/api/posts/{fake}/comments", json={"body": "c"})
    ).status_code == 401
    assert (await async_client.post(f"/api/posts/{fake}/upvote")).status_code == 401
    assert (await async_client.patch(f"/api/posts/{fake}/solution/{fake}")).status_code == 401


@pytest.mark.asyncio
async def test_invalid_sort_is_422(async_client):
    token = await _register(async_client)
    r = await async_client.get("/api/posts?sort=bogus", headers=_auth(token))
    assert r.status_code == 422
