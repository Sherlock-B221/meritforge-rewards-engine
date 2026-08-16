import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, ChallengeProgress, UserStreak
from app.schemas.engine import StreakRuleConfig
from app.services.engine.evaluators.base import EvaluationOutcome, Evaluator


class StreakEvaluator(Evaluator):
    async def evaluate(
        self, session: AsyncSession, *, challenge: Challenge, user_id: uuid.UUID, now: datetime
    ) -> EvaluationOutcome:
        cfg = StreakRuleConfig.model_validate(challenge.rule_config)
        streak = await session.get(UserStreak, (user_id, challenge.event_type))
        current = streak.current_streak if streak is not None else 0
        stmt = (
            pg_insert(ChallengeProgress)
            .values(
                id=uuid.uuid4(),
                challenge_id=challenge.id,
                user_id=user_id,
                period_key="",
                current_value=current,
                target_value=cfg.target_days,
            )
            .on_conflict_do_update(
                index_elements=["challenge_id", "user_id", "period_key"],
                set_={"current_value": current},
            )
            .returning(ChallengeProgress.id)
        )
        pid = (await session.execute(stmt)).scalar_one()
        return EvaluationOutcome(
            progress_id=pid,
            period_key="",
            current_value=current,
            target_value=cfg.target_days,
            completed=current >= cfg.target_days,
        )
