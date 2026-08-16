import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge


@dataclass(frozen=True)
class EvaluationOutcome:
    progress_id: uuid.UUID
    period_key: str
    current_value: int
    target_value: int
    completed: bool  # current_value >= target at this evaluation


class Evaluator(ABC):
    @abstractmethod
    async def evaluate(
        self, session: AsyncSession, *, challenge: Challenge, user_id: uuid.UUID, now: datetime
    ) -> EvaluationOutcome:
        """Update challenge_progress for this (challenge, user, period) and report
        whether the target is now met. Must not disburse rewards."""
        ...
