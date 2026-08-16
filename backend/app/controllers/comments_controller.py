import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.deps import require_user
from app.core.db import get_session
from app.schemas.forum import CommentCreate, CommentOut, PostDetailOut
from app.services.auth.security import Principal
from app.services.forum import comments_service

router = APIRouter(prefix="/posts", tags=["forum"])


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def add_comment(
    post_id: uuid.UUID,
    body: CommentCreate,
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await comments_service.add_comment(
        session, post_id=post_id, author_id=principal.user_id, data=body
    )


@router.patch("/{post_id}/solution/{comment_id}", response_model=PostDetailOut)
async def mark_solution(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await comments_service.mark_solution(
        session, post_id=post_id, comment_id=comment_id, actor_id=principal.user_id
    )
