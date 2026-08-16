import pytest


async def _register(client, username):
    r = await client.post(
        "/api/auth/register",
        json={"username": username, "email": f"{username}@e.com", "password": "pw123456"},
    )
    assert r.status_code == 201
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_comment_and_mark_solution_flow(async_client):
    owner = await _register(async_client, "owner")
    post_id = (await async_client.post(
        "/api/posts", json={"title": "Need help here", "body": "b"}, headers=_auth(owner)
    )).json()["id"]

    comment = await async_client.post(
        f"/api/posts/{post_id}/comments", json={"body": "here is the answer"}, headers=_auth(owner)
    )
    assert comment.status_code == 201
    comment_id = comment.json()["id"]

    marked = await async_client.patch(
        f"/api/posts/{post_id}/solution/{comment_id}", headers=_auth(owner)
    )
    assert marked.status_code == 200
    assert marked.json()["solution_comment_id"] == comment_id
    assert marked.json()["comments"][0]["is_solution"] is True


@pytest.mark.asyncio
async def test_nested_reply_shows_in_detail(async_client):
    token = await _register(async_client, "ria")
    post_id = (await async_client.post(
        "/api/posts", json={"title": "Threaded discussion", "body": "b"}, headers=_auth(token)
    )).json()["id"]
    root_id = (await async_client.post(
        f"/api/posts/{post_id}/comments", json={"body": "root"}, headers=_auth(token)
    )).json()["id"]
    await async_client.post(
        f"/api/posts/{post_id}/comments",
        json={"body": "reply", "parent_comment_id": root_id},
        headers=_auth(token),
    )
    detail = await async_client.get(f"/api/posts/{post_id}", headers=_auth(token))
    assert detail.json()["comments"][0]["replies"][0]["body"] == "reply"


@pytest.mark.asyncio
async def test_non_owner_mark_solution_is_403(async_client):
    owner = await _register(async_client, "owner")
    stranger = await _register(async_client, "stranger")
    post_id = (await async_client.post(
        "/api/posts", json={"title": "Owner only action", "body": "b"}, headers=_auth(owner)
    )).json()["id"]
    comment_id = (await async_client.post(
        f"/api/posts/{post_id}/comments", json={"body": "ans"}, headers=_auth(stranger)
    )).json()["id"]
    r = await async_client.patch(
        f"/api/posts/{post_id}/solution/{comment_id}", headers=_auth(stranger)
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "NOT_POST_OWNER"
