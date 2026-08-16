import enum


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class EventStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"


class ChallengeType(str, enum.Enum):
    COUNT = "count"
    STREAK = "streak"


class ChallengeStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    ARCHIVED = "archived"


class RewardType(str, enum.Enum):
    POINTS = "points"
    BADGE = "badge"
