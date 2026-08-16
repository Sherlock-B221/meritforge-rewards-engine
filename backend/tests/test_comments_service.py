import uuid

import pytest
from sqlalchemy import select

from app.constants import events
from app.core.exceptions import NotFoundError
from app.models import Event, Post
from app.schemas.forum import CommentCreate
from app.services.forum import comments_service


async def _post(session, author_id):
    post = Post(author_id=author_id, title="A thread to answer", body="b")
    session.add(post)
    await session.commit()
    await session.refresh(post)
    return post


@pytest.mark.asyncio
async def test_add_comment_increments_counter_and_emits_event(db_session, user):
    post = await _post(db_session, user.id)
    out = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id, data=CommentCreate(body="nice")
    )
    assert out.body == "nice" and out.author.username == "ria" and out.parent_comment_id is None

    await db_session.refresh(post)
    assert post.comment_count == 1

    ev = (await db_session.execute(select(Event).where(Event.event_type == events.COMMENT_POSTED))).scalar_one()
    assert ev.payload == {"post_id": str(post.id), "comment_id": str(out.id)}


@pytest.mark.asyncio
async def test_add_nested_comment(db_session, user):
    post = await _post(db_session, user.id)
    root = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id, data=CommentCreate(body="root")
    )
    child = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id,
        data=CommentCreate(body="reply", parent_comment_id=root.id),
    )
    assert child.parent_comment_id == root.id


@pytest.mark.asyncio
async def test_add_comment_missing_post_raises(db_session, user):
    with pytest.raises(NotFoundError):
        await comments_service.add_comment(
            db_session, post_id=uuid.uuid4(), author_id=user.id, data=CommentCreate(body="x")
        )


@pytest.mark.asyncio
async def test_parent_from_other_post_raises(db_session, user):
    p1 = await _post(db_session, user.id)
    p2 = await _post(db_session, user.id)
    stray = await comments_service.add_comment(
        db_session, post_id=p2.id, author_id=user.id, data=CommentCreate(body="on p2")
    )
    with pytest.raises(NotFoundError):
        await comments_service.add_comment(
            db_session, post_id=p1.id, author_id=user.id,
            data=CommentCreate(body="bad parent", parent_comment_id=stray.id),
        )
