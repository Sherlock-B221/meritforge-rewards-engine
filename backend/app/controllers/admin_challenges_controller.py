import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.enums import ChallengeStatus
from app.controllers.deps import require_admin
from app.core.db import get_session
from app.schemas.engine import ChallengeCreate, ChallengeOut, ChallengeUpdate
from app.services.auth.security import Principal
from app.services.engine import challenges_service

router = APIRouter(prefix="/admin/challenges", tags=["admin"])


@router.post("", response_model=ChallengeOut, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    body: ChallengeCreate,
    principal: Principal = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await challenges_service.create_challenge(session, created_by=principal.user_id, data=body)


@router.get("", response_model=list[ChallengeOut])
async def list_challenges(
    status: ChallengeStatus | None = None,
    principal: Principal = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await challenges_service.list_challenges(session, status=status)


@router.patch("/{challenge_id}", response_model=ChallengeOut)
async def update_challenge(
    challenge_id: uuid.UUID,
    body: ChallengeUpdate,
    principal: Principal = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    return await challenges_service.update_challenge(session, challenge_id=challenge_id, data=body)


@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_challenge(
    challenge_id: uuid.UUID,
    principal: Principal = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    await challenges_service.archive_challenge(session, challenge_id=challenge_id)
