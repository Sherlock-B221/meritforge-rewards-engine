import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, ChallengeProgress
from app.schemas.engine import CountRuleConfig
from app.services.engine.evaluators.base import EvaluationOutcome, Evaluator
from app.services.engine.periods import date_of, period_key_for


class CountEvaluator(Evaluator):
    async def evaluate(
        self, session: AsyncSession, *, challenge: Challenge, user_id: uuid.UUID, now: datetime
    ) -> EvaluationOutcome:
        cfg = CountRuleConfig.model_validate(challenge.rule_config)
        period_key = period_key_for(cfg.window, date_of(now))
        stmt = (
            pg_insert(ChallengeProgress)
            .values(
                id=uuid.uuid4(),
                challenge_id=challenge.id,
                user_id=user_id,
                period_key=period_key,
                current_value=1,
                target_value=cfg.target,
            )
            .on_conflict_do_update(
                index_elements=["challenge_id", "user_id", "period_key"],
                set_={"current_value": ChallengeProgress.current_value + 1},
            )
            .returning(
                ChallengeProgress.id,
                ChallengeProgress.current_value,
                ChallengeProgress.target_value,
            )
        )
        pid, current, target = (await session.execute(stmt)).one()
        return EvaluationOutcome(
            progress_id=pid,
            period_key=period_key,
            current_value=current,
            target_value=target,
            completed=current >= target,
        )
