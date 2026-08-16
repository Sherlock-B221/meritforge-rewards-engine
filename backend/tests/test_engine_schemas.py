import uuid

import pytest
from pydantic import ValidationError

from app.constants.enums import ChallengeType
from app.schemas.engine import (
    BadgeReward,
    CountRuleConfig,
    EventIn,
    PointsReward,
    StreakRuleConfig,
    parse_reward,
    parse_rule_config,
)


def test_count_rule_defaults_window_total():
    cfg = CountRuleConfig.model_validate({"target": 5})
    assert cfg.target == 5 and cfg.window == "total"


def test_count_rule_rejects_zero_target():
    with pytest.raises(ValidationError):
        CountRuleConfig.model_validate({"target": 0})


def test_parse_rule_config_dispatches_on_type():
    assert isinstance(parse_rule_config(ChallengeType.COUNT, {"target": 3}), CountRuleConfig)
    assert isinstance(
        parse_rule_config(ChallengeType.STREAK, {"target_days": 7}), StreakRuleConfig
    )


def test_parse_reward_dispatches_on_type():
    assert isinstance(parse_reward({"type": "points", "amount": 50}), PointsReward)
    assert isinstance(parse_reward({"type": "badge", "badge_code": "first"}), BadgeReward)
    # defaults to points when type omitted
    assert isinstance(parse_reward({"amount": 10}), PointsReward)


def test_event_in_requires_event_id_and_type():
    ev = EventIn.model_validate({"event_id": str(uuid.uuid4()), "event_type": "post_created"})
    assert ev.payload == {} and ev.occurred_at is None
    with pytest.raises(ValidationError):
        EventIn.model_validate({"event_type": "x"})  # missing event_id
