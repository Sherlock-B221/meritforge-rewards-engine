import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants import events
from app.constants import error_codes as error_codes_mod
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models import Comment, Post
from app.schemas.forum import CommentCreate, CommentOut, PostDetailOut
from app.services.events.publisher import publish_event
from app.services.forum.comment_tree import to_comment_out
from app.services.forum import posts_service


async def add_comment(
    session: AsyncSession, *, post_id: uuid.UUID, author_id: uuid.UUID, data: CommentCreate
) -> CommentOut:
    post = await session.get(Post, post_id)
    if post is None:
        raise NotFoundError("post", post_id)
    if data.parent_comment_id is not None:
        parent = await session.get(Comment, data.parent_comment_id)
        if parent is None or parent.post_id != post_id:
            raise NotFoundError("comment", data.parent_comment_id)

    comment = Comment(
        post_id=post_id, author_id=author_id, body=data.body, parent_comment_id=data.parent_comment_id
    )
    session.add(comment)
    await session.flush()  # assign comment.id
    await session.execute(
        update(Post).where(Post.id == post_id).values(comment_count=Post.comment_count + 1)
    )
    await publish_event(
        session,
        event_id=events.deterministic_event_id(events.COMMENT_POSTED, comment.id),
        user_id=author_id,
        event_type=events.COMMENT_POSTED,
        payload={"post_id": str(post_id), "comment_id": str(comment.id)},
    )
    await session.commit()
    loaded = (
        await session.execute(
            select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
        )
    ).scalar_one()
    return to_comment_out(loaded)


async def mark_solution(
    session: AsyncSession, *, post_id: uuid.UUID, comment_id: uuid.UUID, actor_id: uuid.UUID
) -> PostDetailOut:
    post = await session.get(Post, post_id)
    if post is None:
        raise NotFoundError("post", post_id)
    if post.author_id != actor_id:
        raise ForbiddenError("Only the post author can mark a solution", code=error_codes_mod.NOT_POST_OWNER)
    comment = await session.get(Comment, comment_id)
    if comment is None or comment.post_id != post_id:
        raise NotFoundError("comment", comment_id)

    if post.solution_comment_id is not None and post.solution_comment_id != comment_id:
        await session.execute(
            update(Comment).where(Comment.id == post.solution_comment_id).values(is_solution=False)
        )
    comment.is_solution = True
    post.solution_comment_id = comment_id
    await session.flush()
    await publish_event(
        session,
        event_id=events.deterministic_event_id(events.SOLUTION_MARKED, post_id, comment_id),
        user_id=actor_id,
        event_type=events.SOLUTION_MARKED,
        payload={"post_id": str(post_id), "comment_id": str(comment_id)},
    )
    await session.commit()
    return await posts_service.get_post_detail(session, post_id=post_id)
