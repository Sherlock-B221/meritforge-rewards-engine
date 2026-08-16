import uuid

import pytest
from sqlalchemy import select

from app.constants import events
from app.core.exceptions import NotFoundError
from app.models import Event, Post
from app.schemas.forum import CommentCreate
from app.services.forum import comments_service

from app.core.exceptions import ForbiddenError
from app.constants import error_codes as codes
from app.services.forum import posts_service


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


@pytest.mark.asyncio
async def test_owner_marks_solution(db_session, user):
    post = await _post(db_session, user.id)
    answer = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id, data=CommentCreate(body="the answer")
    )
    detail = await comments_service.mark_solution(
        db_session, post_id=post.id, comment_id=answer.id, actor_id=user.id
    )
    assert detail.solution_comment_id == answer.id
    assert detail.comments[0].is_solution is True

    ev = (await db_session.execute(select(Event).where(Event.event_type == events.SOLUTION_MARKED))).scalar_one()
    assert ev.payload == {"post_id": str(post.id), "comment_id": str(answer.id)}


@pytest.mark.asyncio
async def test_non_owner_cannot_mark_solution(db_session, user, other_user):
    post = await _post(db_session, user.id)
    answer = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=other_user.id, data=CommentCreate(body="answer")
    )
    with pytest.raises(ForbiddenError) as exc:
        await comments_service.mark_solution(
            db_session, post_id=post.id, comment_id=answer.id, actor_id=other_user.id
        )
    assert exc.value.code == codes.NOT_POST_OWNER


@pytest.mark.asyncio
async def test_mark_solution_replaces_previous(db_session, user):
    post = await _post(db_session, user.id)
    first = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id, data=CommentCreate(body="first")
    )
    second = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id, data=CommentCreate(body="second")
    )
    await comments_service.mark_solution(db_session, post_id=post.id, comment_id=first.id, actor_id=user.id)
    detail = await comments_service.mark_solution(
        db_session, post_id=post.id, comment_id=second.id, actor_id=user.id
    )
    assert detail.solution_comment_id == second.id
    flags = {c.id: c.is_solution for c in detail.comments}
    assert flags[second.id] is True and flags[first.id] is False


@pytest.mark.asyncio
async def test_get_post_detail_nests_comments(db_session, user):
    post = await _post(db_session, user.id)
    root = await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id, data=CommentCreate(body="root")
    )
    await comments_service.add_comment(
        db_session, post_id=post.id, author_id=user.id,
        data=CommentCreate(body="reply", parent_comment_id=root.id),
    )
    detail = await posts_service.get_post_detail(db_session, post_id=post.id)
    assert len(detail.comments) == 1
    assert detail.comments[0].replies[0].body == "reply"
