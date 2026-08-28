from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.deps import PageParams, paginate
from app.core.db import get_session
from app.schemas.common import Page
from app.schemas.engine import LeaderboardEntryOut
from app.services.engine import leaderboard_service

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("", response_model=Page[LeaderboardEntryOut])
async def get_leaderboard(
    pg: PageParams = Depends(paginate),
    session: AsyncSession = Depends(get_session),
):
    # Public read: the ranking is a community-facing page, no token required.
    return await leaderboard_service.get_leaderboard(session, page=pg.page, limit=pg.limit)
