import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants import events
from app.core.exceptions import NotFoundError
from app.models import Comment, Post
from app.schemas.common import Page
from app.schemas.forum import PostCreate, PostDetailOut, PostSummaryOut
from app.services.events.publisher import publish_event
from app.services.forum.comment_tree import build_comment_tree, to_comment_out
from app.services.forum.trending import trending_order_expr


async def create_post(session: AsyncSession, *, author_id: uuid.UUID, data: PostCreate) -> PostSummaryOut:
    post = Post(author_id=author_id, title=data.title, body=data.body, tags=data.tags)
    session.add(post)
    await session.flush()  # assign post.id without committing
    await publish_event(
        session,
        event_id=events.deterministic_event_id(events.POST_CREATED, post.id),
        user_id=author_id,
        event_type=events.POST_CREATED,
        payload={"post_id": str(post.id)},
    )
    await session.commit()
    loaded = (
        await session.execute(
            select(Post).options(selectinload(Post.author)).where(Post.id == post.id)
        )
    ).scalar_one()
    return PostSummaryOut.model_validate(loaded)


async def get_feed(
    session: AsyncSession, *, sort: str = "latest", page: int = 1, limit: int = 20
) -> Page[PostSummaryOut]:
    total = (await session.execute(select(func.count()).select_from(Post))).scalar_one()
    stmt = select(Post).options(selectinload(Post.author))
    if sort == "trending":
        stmt = stmt.order_by(trending_order_expr().desc(), Post.created_at.desc())
    else:
        stmt = stmt.order_by(Post.created_at.desc())
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    rows = (await session.execute(stmt)).scalars().all()
    items = [PostSummaryOut.model_validate(p) for p in rows]
    return Page[PostSummaryOut](
        items=items, page=page, limit=limit, total=total, has_next=(page * limit) < total
    )


async def get_post_detail(session: AsyncSession, *, post_id: uuid.UUID) -> PostDetailOut:
    post = (
        await session.execute(
            select(Post).options(selectinload(Post.author)).where(Post.id == post_id)
        )
    ).scalar_one_or_none()
    if post is None:
        raise NotFoundError("post", post_id)
    comments = (
        await session.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.post_id == post_id)
            .order_by(Comment.created_at.asc())
        )
    ).scalars().all()
    tree = build_comment_tree([to_comment_out(c) for c in comments])
    summary = PostSummaryOut.model_validate(post)
    return PostDetailOut(**summary.model_dump(), comments=tree)
