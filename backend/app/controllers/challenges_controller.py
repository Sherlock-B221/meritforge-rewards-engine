from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.deps import require_user
from app.core.db import get_session
from app.schemas.engine import ChallengeWithProgressOut, WeeklyChallengeOut
from app.services.auth.security import Principal
from app.services.engine import progress_reads

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("", response_model=list[ChallengeWithProgressOut])
async def list_active_challenges(
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await progress_reads.list_active_with_progress(
        session, user_id=principal.user_id, now=datetime.now(timezone.utc)
    )


@router.get("/weekly", response_model=WeeklyChallengeOut)
async def get_weekly_challenge(
    principal: Principal = Depends(require_user),
    session: AsyncSession = Depends(get_session),
):
    return await progress_reads.get_weekly_with_progress(
        session, user_id=principal.user_id, now=datetime.now(timezone.utc)
    )
