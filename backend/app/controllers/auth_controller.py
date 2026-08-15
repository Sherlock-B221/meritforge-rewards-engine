from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.deps import require_user
from app.core.db import get_session
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserOut
from app.services.auth import auth_service
from app.services.auth.security import Principal

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    return await auth_service.register(session, body)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    return await auth_service.authenticate(session, body)


@router.get("/me", response_model=UserOut)
async def me(principal: Principal = Depends(require_user), session: AsyncSession = Depends(get_session)):
    return UserOut.model_validate(await auth_service.get_user(session, principal.user_id))
