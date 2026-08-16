import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants.enums import ChallengeStatus, ChallengeType, EventStatus, RewardType


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


class ChallengeCreate(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    type: ChallengeType
    event_type: str = Field(min_length=1, max_length=100)
    rule_config: dict
    reward: dict
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def _validate(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        try:
            parse_rule_config(self.type, self.rule_config)
            parse_reward(self.reward)
        except Exception as e:
            raise ValueError(f"invalid rule_config/reward for type {self.type.value}: {e}") from e
        return self


class ChallengeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    rule_config: dict | None = None
    reward: dict | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: ChallengeStatus | None = None
    # `type` is immutable after creation — changing it would orphan existing
    # challenge_progress rows evaluated under the old evaluator. Not settable here.


class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str
    type: ChallengeType
    event_type: str
    rule_config: dict
    reward: dict
    status: ChallengeStatus
    start_at: datetime
    end_at: datetime
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ChallengeProgressOut(BaseModel):
    period_key: str
    current_value: int
    target_value: int
    completed: bool


class ChallengeWithProgressOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    type: ChallengeType
    event_type: str
    rule_config: dict
    reward: dict
    start_at: datetime
    end_at: datetime
    progress: ChallengeProgressOut


class WeeklyChallengeOut(ChallengeWithProgressOut):
    resets_at: datetime


class ProgressEntryOut(BaseModel):
    challenge_id: uuid.UUID
    challenge_name: str
    type: ChallengeType
    event_type: str
    period_key: str
    current_value: int
    target_value: int
    completed: bool
    completed_at: datetime | None


class StreakOut(BaseModel):
    event_type: str
    current_streak: int
    best_streak: int
    last_activity_date: date | None


class HeatmapDayOut(BaseModel):
    activity_date: date
    event_count: int


class UserStreaksOut(BaseModel):
    streaks: list[StreakOut]
    heatmap: list[HeatmapDayOut]


class RewardOut(BaseModel):
    id: uuid.UUID
    challenge_id: uuid.UUID
    challenge_name: str
    reward_type: RewardType
    amount: int | None
    badge_code: str | None
    created_at: datetime


class LeaderboardEntryOut(BaseModel):
    rank: int
    user_id: uuid.UUID
    username: str
    total_points: int
    badge_count: int


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
