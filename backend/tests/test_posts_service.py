from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.constants import events
from app.models import Event, Post
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
