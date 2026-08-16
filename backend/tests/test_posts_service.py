import uuid as _uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.constants import events
from app.core.exceptions import NotFoundError as _NotFoundError
from app.models import Event, Post, PostUpvote
from app.schemas.forum import PostCreate
from app.services.forum import posts_service


@pytest.mark.asyncio
async def test_create_post_returns_summary_and_emits_event(db_session, user):
    out = await posts_service.create_post(
        db_session, author_id=user.id, data=PostCreate(title="My first thread", body="hello", tags=["q"])
    )
    assert out.title == "My first thread"
    assert out.author.username == "ria"
    assert out.comment_count == 0 and out.upvote_count == 0

    ev = (await db_session.execute(select(Event).where(Event.event_type == events.POST_CREATED))).scalar_one()
    assert ev.user_id == user.id
    assert ev.payload == {"post_id": str(out.id)}
    assert ev.event_id == events.deterministic_event_id(events.POST_CREATED, out.id)


async def _make_post(session, author_id, title, *, upvotes=0, comments=0, created_at=None):
    post = Post(author_id=author_id, title=title, body="b", upvote_count=upvotes, comment_count=comments)
    if created_at is not None:
        post.created_at = created_at
    session.add(post)
    await session.commit()
    await session.refresh(post)
    return post


@pytest.mark.asyncio
async def test_feed_latest_orders_newest_first(db_session, user):
    await _make_post(db_session, user.id, "old", created_at=datetime(2026, 1, 1, tzinfo=timezone.utc))
    await _make_post(db_session, user.id, "new", created_at=datetime(2026, 6, 1, tzinfo=timezone.utc))
    page = await posts_service.get_feed(db_session, sort="latest")
    assert [p.title for p in page.items] == ["new", "old"]
    assert page.total == 2 and page.has_next is False


@pytest.mark.asyncio
async def test_feed_trending_orders_by_engagement(db_session, user):
    now = datetime(2026, 6, 1, tzinfo=timezone.utc)
    await _make_post(db_session, user.id, "cold", upvotes=0, created_at=now)
    await _make_post(db_session, user.id, "hot", upvotes=100, created_at=now)
    page = await posts_service.get_feed(db_session, sort="trending")
    assert page.items[0].title == "hot"


@pytest.mark.asyncio
async def test_feed_pagination(db_session, user):
    for i in range(3):
        await _make_post(db_session, user.id, f"post {i}", created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc))
    page = await posts_service.get_feed(db_session, sort="latest", page=1, limit=2)
    assert len(page.items) == 2 and page.total == 3 and page.has_next is True
    page2 = await posts_service.get_feed(db_session, sort="latest", page=2, limit=2)
    assert len(page2.items) == 1 and page2.has_next is False


@pytest.mark.asyncio
async def test_view_post_counts_distinct_viewer_once(db_session, user):
    post = await _make_post(db_session, user.id, "viewed thread")
    await posts_service.view_post(db_session, post_id=post.id, viewer_id=user.id)
    detail = await posts_service.view_post(db_session, post_id=post.id, viewer_id=user.id)
    assert detail.view_count == 1  # same viewer twice → counted once

    ev_count = (
        await db_session.execute(select(func.count()).select_from(Event).where(Event.event_type == events.POST_VIEWED))
    ).scalar_one()
    assert ev_count == 1


@pytest.mark.asyncio
async def test_view_post_counts_each_distinct_viewer(db_session, user, other_user):
    post = await _make_post(db_session, user.id, "popular thread")
    await posts_service.view_post(db_session, post_id=post.id, viewer_id=user.id)
    detail = await posts_service.view_post(db_session, post_id=post.id, viewer_id=other_user.id)
    assert detail.view_count == 2


@pytest.mark.asyncio
async def test_view_missing_post_raises(db_session, user):
    with pytest.raises(_NotFoundError):
        await posts_service.view_post(db_session, post_id=_uuid.uuid4(), viewer_id=user.id)


@pytest.mark.asyncio
async def test_upvote_increments_once_per_user(db_session, user):
    post = await _make_post(db_session, user.id, "upvote me")
    r1 = await posts_service.upvote_post(db_session, post_id=post.id, user_id=user.id)
    r2 = await posts_service.upvote_post(db_session, post_id=post.id, user_id=user.id)
    assert r1.upvote_count == 1 and r2.upvote_count == 1  # double upvote is a no-op
    assert r2.upvoted is True

    rows = (await db_session.execute(select(func.count()).select_from(PostUpvote))).scalar_one()
    ev = (
        await db_session.execute(select(func.count()).select_from(Event).where(Event.event_type == events.POST_UPVOTED))
    ).scalar_one()
    assert rows == 1 and ev == 1


@pytest.mark.asyncio
async def test_upvote_counts_each_user(db_session, user, other_user):
    post = await _make_post(db_session, user.id, "two upvoters")
    await posts_service.upvote_post(db_session, post_id=post.id, user_id=user.id)
    r = await posts_service.upvote_post(db_session, post_id=post.id, user_id=other_user.id)
    assert r.upvote_count == 2


@pytest.mark.asyncio
async def test_upvote_missing_post_raises(db_session, user):
    with pytest.raises(_NotFoundError):
        await posts_service.upvote_post(db_session, post_id=_uuid.uuid4(), user_id=user.id)


@pytest.mark.asyncio
async def test_create_post_rolls_back_post_when_event_fails(db_session, user, monkeypatch):
    async def _boom(*args, **kwargs):
        raise RuntimeError("event publish failed")

    monkeypatch.setattr("app.services.forum.posts_service.publish_event", _boom)
    with pytest.raises(RuntimeError):
        await posts_service.create_post(
            db_session, author_id=user.id, data=PostCreate(title="Atomic thread", body="b")
        )
    await db_session.rollback()
    posts = (await db_session.execute(select(func.count()).select_from(Post))).scalar_one()
    events = (await db_session.execute(select(func.count()).select_from(Event))).scalar_one()
    assert posts == 0 and events == 0
