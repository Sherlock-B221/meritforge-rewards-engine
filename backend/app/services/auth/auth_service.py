import uuid
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, UserOut
from app.services.auth.security import hash_password, verify_password, create_access_token
from app.core.exceptions import ConflictError, UnauthorizedError, NotFoundError
from app.constants import error_codes as codes


async def register(session: AsyncSession, data: RegisterRequest) -> AuthResponse:
    existing = (await session.execute(
        select(User).where(or_(User.username == data.username, User.email == data.email)))).scalars().first()
    if existing:
        if existing.username == data.username:
            raise ConflictError(codes.USERNAME_TAKEN, "Username already taken")
        raise ConflictError(codes.EMAIL_TAKEN, "Email already registered")
    user = User(username=data.username, email=data.email, password_hash=hash_password(data.password))
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return AuthResponse(token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


async def authenticate(session: AsyncSession, data: LoginRequest) -> AuthResponse:
    user = (await session.execute(select(User).where(User.username == data.username))).scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise UnauthorizedError("Invalid username or password", code=codes.INVALID_CREDENTIALS)
    return AuthResponse(token=create_access_token(user.id, user.role), user=UserOut.model_validate(user))


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError("user", user_id)
    return user
