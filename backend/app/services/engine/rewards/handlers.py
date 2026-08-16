import uuid
from datetime import datetime

from app.constants.enums import RewardType
from app.schemas.engine import BadgeReward, PointsReward, parse_reward


def build_ledger_values(
    reward: dict, *, user_id: uuid.UUID, challenge_id: uuid.UUID, disbursal_key: str, now: datetime
) -> dict:
    """Turn a challenge's reward config into a reward_ledger row's column values,
    dispatching on reward type. Add a reward type = new enum value + a branch here."""
    parsed = parse_reward(reward)
    base = {
        "id": uuid.uuid4(),
        "user_id": user_id,
        "challenge_id": challenge_id,
        "disbursal_key": disbursal_key,
    }
    if isinstance(parsed, BadgeReward):
        return {**base, "reward_type": RewardType.BADGE, "amount": None, "badge_code": parsed.badge_code}
    assert isinstance(parsed, PointsReward)
    return {**base, "reward_type": RewardType.POINTS, "amount": parsed.amount, "badge_code": None}
