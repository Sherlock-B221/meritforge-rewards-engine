from dataclasses import dataclass

from fastapi import Depends, Header

from app.config import get_settings
from app.constants.enums import UserRole
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.services.auth.security import Principal, decode_token


async def get_current_principal(authorization: str | None = Header(default=None)) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing bearer token")
    return decode_token(authorization.split(" ", 1)[1])


async def get_optional_principal(
    authorization: str | None = Header(default=None),
) -> Principal | None:
    """Auth for public reads: resolve the caller when a valid token is present,
    otherwise fall back to anonymous (``None``) instead of raising. A missing,
    malformed, or expired token degrades to anonymous — a stale token must never
    401 a page that anyone is allowed to read."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return decode_token(authorization.split(" ", 1)[1])
    except UnauthorizedError:
        return None


async def require_user(p: Principal = Depends(get_current_principal)) -> Principal:
    return p


async def require_admin(p: Principal = Depends(get_current_principal)) -> Principal:
    if p.role != UserRole.ADMIN:
        raise ForbiddenError("Admin role required")
    return p


@dataclass(frozen=True)
class PageParams:
    page: int
    limit: int


async def paginate(page: int = 1, limit: int | None = None) -> PageParams:
    s = get_settings()
    resolved = s.default_page_size if limit is None else limit
    resolved = max(1, min(resolved, s.max_page_size))
    return PageParams(page=max(1, page), limit=resolved)
