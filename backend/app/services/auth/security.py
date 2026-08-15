import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings
from app.constants import error_codes as codes
from app.constants.enums import UserRole
from app.core.exceptions import UnauthorizedError


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    role: UserRole


def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()


def verify_password(raw: str, hashed: str) -> bool:
    return bcrypt.checkpw(raw.encode(), hashed.encode())


def create_access_token(user_id: uuid.UUID, role: UserRole) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role.value,
        "iat": now,
        "exp": now + timedelta(minutes=s.jwt_expires_minutes),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> Principal:
    s = get_settings()
    try:
        data = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token expired", code=codes.TOKEN_EXPIRED)
    except jwt.PyJWTError:
        raise UnauthorizedError("Invalid token", code=codes.INVALID_TOKEN)
    return Principal(user_id=uuid.UUID(data["sub"]), role=UserRole(data["role"]))
