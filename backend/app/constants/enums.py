import enum


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class EventStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"
