from fastapi import status

from app.constants import error_codes as codes
from app.core.errors import AppError


class UnauthorizedError(AppError):
    def __init__(self, message="Not authenticated", code=codes.UNAUTHORIZED):
        super().__init__(code, message, status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(AppError):
    def __init__(self, message="Forbidden"):
        super().__init__(codes.FORBIDDEN, message, status.HTTP_403_FORBIDDEN)


class NotFoundError(AppError):
    def __init__(self, resource: str, resource_id):
        super().__init__(
            f"{resource.upper()}_NOT_FOUND",
            f"{resource.capitalize()} not found",
            status.HTTP_404_NOT_FOUND,
            {"id": str(resource_id)},
        )


class ConflictError(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message, status.HTTP_409_CONFLICT)


class RateLimitedError(AppError):
    def __init__(self, retry_after: int):
        super().__init__(
            codes.RATE_LIMITED,
            "Rate limit exceeded",
            status.HTTP_429_TOO_MANY_REQUESTS,
            headers={"Retry-After": str(retry_after)},
        )
