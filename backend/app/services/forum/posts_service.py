import uuid

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.constants import events
from app.core.exceptions import NotFoundError
from app.models import Comment, Post, PostUpvote
from app.schemas.common import Page
from app.schemas.forum import PostCreate, PostDetailOut, PostSummaryOut, UpvoteResponse
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


async def view_post(
    session: AsyncSession, *, post_id: uuid.UUID, viewer_id: uuid.UUID | None
) -> PostDetailOut:
    post = await session.get(Post, post_id)
    if post is None:
        raise NotFoundError("post", post_id)
    # Anonymous views can't be attributed to a user, so they emit no event and
    # don't bump the counter — the read stays side-effect-free for logged-out
    # visitors (and can't feed any challenge). A logged-in view is unchanged.
    if viewer_id is not None:
        newly_viewed = await publish_event(
            session,
            event_id=events.deterministic_event_id(events.POST_VIEWED, post_id, viewer_id),
            user_id=viewer_id,
            event_type=events.POST_VIEWED,
            payload={"post_id": str(post_id)},
        )
        if newly_viewed:
            await session.execute(
                update(Post).where(Post.id == post_id).values(view_count=Post.view_count + 1)
            )
        await session.commit()
    return await get_post_detail(session, post_id=post_id)


async def upvote_post(session: AsyncSession, *, post_id: uuid.UUID, user_id: uuid.UUID) -> UpvoteResponse:
    post = await session.get(Post, post_id)
    if post is None:
        raise NotFoundError("post", post_id)
    insert_stmt = (
        pg_insert(PostUpvote)
        .values(post_id=post_id, user_id=user_id)
        .on_conflict_do_nothing(index_elements=["post_id", "user_id"])
        .returning(PostUpvote.post_id)
    )
    newly_upvoted = (await session.execute(insert_stmt)).first() is not None
    if newly_upvoted:
        await session.execute(
            update(Post).where(Post.id == post_id).values(upvote_count=Post.upvote_count + 1)
        )
        await publish_event(
            session,
            event_id=events.deterministic_event_id(events.POST_UPVOTED, post_id, user_id),
            user_id=user_id,
            event_type=events.POST_UPVOTED,
            payload={"post_id": str(post_id)},
        )
    await session.commit()
    await session.refresh(post)
    return UpvoteResponse(post_id=post_id, upvote_count=post.upvote_count, upvoted=True)
