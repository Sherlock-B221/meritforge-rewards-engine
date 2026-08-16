from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.deps import PageParams, paginate, require_user
from app.core.db import get_session
from app.schemas.common import Page
from app.schemas.engine import ProgressEntryOut, RewardOut, UserStreaksOut
from app.services.auth.security import Principal
from app.services.engine import progress_service

router = APIRouter(prefix="/users/me", tags=["progress"])


@router.get("/progress", response_model=list[ProgressEntryOut])
async def get_my_progress(
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await progress_service.get_my_progress(session, user_id=principal.user_id)


@router.get("/streaks", response_model=UserStreaksOut)
async def get_my_streaks(
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await progress_service.get_my_streaks(session, user_id=principal.user_id)


@router.get("/rewards", response_model=Page[RewardOut])
async def get_my_rewards(
    pg: PageParams = Depends(paginate),
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await progress_service.get_my_rewards(
        session, user_id=principal.user_id, page=pg.page, limit=pg.limit
    )
