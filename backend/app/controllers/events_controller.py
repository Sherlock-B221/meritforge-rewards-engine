from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.rate_limit import rate_limit_events
from app.schemas.engine import EventAccepted, EventIn
from app.services.auth.security import Principal
from app.services.engine import ingestion_service

router = APIRouter(prefix="/events", tags=["engine"])


@router.post("", response_model=EventAccepted, status_code=status.HTTP_202_ACCEPTED)
async def post_event(
    body: EventIn,
    principal: Principal = Depends(rate_limit_events),
    session: AsyncSession = Depends(get_session),
):
    return await ingestion_service.ingest_event(session, user_id=principal.user_id, data=body)
