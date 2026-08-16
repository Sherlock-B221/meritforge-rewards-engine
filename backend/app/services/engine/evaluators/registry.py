from app.constants.enums import ChallengeType
from app.services.engine.evaluators.base import Evaluator
from app.services.engine.evaluators.count import CountEvaluator
from app.services.engine.evaluators.streak import StreakEvaluator

# Add a challenge type = new enum value + new Evaluator + one line here.
_REGISTRY: dict[ChallengeType, Evaluator] = {
    ChallengeType.COUNT: CountEvaluator(),
    ChallengeType.STREAK: StreakEvaluator(),
}


def get_evaluator(challenge_type: ChallengeType) -> Evaluator:
    return _REGISTRY[challenge_type]
