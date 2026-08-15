from fastapi import Depends, Header

from app.constants.enums import UserRole
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.services.auth.security import Principal, decode_token


async def get_current_principal(authorization: str | None = Header(default=None)) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing bearer token")
    return decode_token(authorization.split(" ", 1)[1])


async def require_user(p: Principal = Depends(get_current_principal)) -> Principal:
    return p


async def require_admin(p: Principal = Depends(get_current_principal)) -> Principal:
    if p.role != UserRole.ADMIN:
        raise ForbiddenError("Admin role required")
    return p
