import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants import events
from app.core.exceptions import NotFoundError
from app.models import Comment, Post
from app.schemas.forum import CommentCreate, CommentOut
from app.services.events.publisher import publish_event
from app.services.forum.comment_tree import to_comment_out


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
