import uuid
from typing import Literal

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.deps import PageParams, get_optional_principal, paginate, require_user
from app.core.db import get_session
from app.schemas.common import Page
from app.schemas.forum import PostCreate, PostDetailOut, PostSummaryOut, UpvoteResponse
from app.services.auth.security import Principal
from app.services.forum import posts_service

router = APIRouter(prefix="/posts", tags=["forum"])


@router.get("", response_model=Page[PostSummaryOut])
async def list_posts(
    sort: Literal["latest", "trending"] = "latest",
    pg: PageParams = Depends(paginate),
    principal: Principal | None = Depends(get_optional_principal),
    session: AsyncSession = Depends(get_session),
):
    # Public read: the feed is browsable + crawlable without a token.
    return await posts_service.get_feed(session, sort=sort, page=pg.page, limit=pg.limit)


@router.post("", response_model=PostSummaryOut, status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await posts_service.create_post(session, author_id=principal.user_id, data=body)


@router.get("/{post_id}", response_model=PostDetailOut)
async def get_post(
    post_id: uuid.UUID,
    principal: Principal | None = Depends(get_optional_principal),
    session: AsyncSession = Depends(get_session),
):
    # Public read: a thread + its comments render for anonymous visitors. A
    # logged-in view still emits `post_viewed`; an anonymous one is side-effect-free.
    return await posts_service.view_post(
        session, post_id=post_id, viewer_id=principal.user_id if principal else None
    )


@router.post("/{post_id}/upvote", response_model=UpvoteResponse)
async def upvote_post(
    post_id: uuid.UUID,
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await posts_service.upvote_post(session, post_id=post_id, user_id=principal.user_id)
