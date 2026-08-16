import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.constants.enums import EventStatus
from app.models import Comment, Event, Post, PostUpvote


@pytest.mark.asyncio
async def test_post_defaults(db_session, user):
    post = Post(author_id=user.id, title="Hello world thread", body="body text", tags=["python"])
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    assert post.id is not None
    assert post.comment_count == 0 and post.upvote_count == 0 and post.view_count == 0
    assert post.solution_comment_id is None
    assert post.tags == ["python"]
    assert post.created_at is not None


@pytest.mark.asyncio
async def test_nested_comment(db_session, user):
    post = Post(author_id=user.id, title="A question thread", body="b")
    db_session.add(post)
    await db_session.flush()
    root = Comment(post_id=post.id, author_id=user.id, body="root")
    db_session.add(root)
    await db_session.flush()
    child = Comment(post_id=post.id, author_id=user.id, body="reply", parent_comment_id=root.id)
    db_session.add(child)
    await db_session.commit()
    await db_session.refresh(child)
    assert child.parent_comment_id == root.id
    assert child.is_solution is False


@pytest.mark.asyncio
async def test_post_upvote_composite_pk_dedupes(db_session, user):
    post = Post(author_id=user.id, title="Upvote target thread", body="b")
    db_session.add(post)
    await db_session.flush()
    for _ in range(2):
        await db_session.execute(
            pg_insert(PostUpvote)
            .values(post_id=post.id, user_id=user.id)
            .on_conflict_do_nothing(index_elements=["post_id", "user_id"])
        )
    await db_session.commit()
    count = (await db_session.execute(select(func.count()).select_from(PostUpvote))).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_event_row(db_session, user):
    event = Event(
        event_id=uuid.uuid4(),
        user_id=user.id,
        event_type="post_created",
        payload={"post_id": "abc"},
        occurred_at=func.now(),
    )
    db_session.add(event)
    await db_session.commit()
    await db_session.refresh(event)
    assert event.status == EventStatus.PENDING
    assert event.received_at is not None
    assert event.processed_at is None
