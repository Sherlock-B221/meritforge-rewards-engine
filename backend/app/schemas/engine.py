import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.constants.enums import ChallengeType, EventStatus


class CountRuleConfig(BaseModel):
    target: int = Field(ge=1, le=100000)
    window: Literal["total", "weekly"] = "total"


class StreakRuleConfig(BaseModel):
    target_days: int = Field(ge=1, le=366)


class PointsReward(BaseModel):
    type: Literal["points"] = "points"
    amount: int = Field(ge=0, le=1000000)


class BadgeReward(BaseModel):
    type: Literal["badge"] = "badge"
    badge_code: str = Field(min_length=1, max_length=50)


class EventIn(BaseModel):
    event_id: uuid.UUID
    event_type: str = Field(min_length=1, max_length=100)
    payload: dict = Field(default_factory=dict)
    occurred_at: datetime | None = None


class EventAccepted(BaseModel):
    event_id: uuid.UUID
    status: EventStatus


def parse_rule_config(
    challenge_type: ChallengeType, data: dict
) -> CountRuleConfig | StreakRuleConfig:
    """Validate a challenge's rule_config JSON against its type."""
    if challenge_type == ChallengeType.COUNT:
        return CountRuleConfig.model_validate(data)
    return StreakRuleConfig.model_validate(data)


def parse_reward(data: dict) -> PointsReward | BadgeReward:
    """Validate a challenge's reward JSON, dispatching on its `type` field."""
    if data.get("type") == "badge":
        return BadgeReward.model_validate(data)
    return PointsReward.model_validate(data)
