import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Challenge, RewardLedgerEntry
from app.services.engine.rewards.handlers import build_ledger_values


def disbursal_key_for(challenge_id: uuid.UUID, user_id: uuid.UUID, period_key: str) -> str:
    return f"{challenge_id}:{user_id}:{period_key}"


async def disburse_reward(
    session: AsyncSession, *, user_id: uuid.UUID, challenge: Challenge, period_key: str, now: datetime
) -> bool:
    """Append a reward_ledger row, at most once per (challenge, user, period).
    The unique disbursal_key + ON CONFLICT DO NOTHING guarantees at-most-once even
    under concurrent evaluation. Returns True iff a new row was written."""
    key = disbursal_key_for(challenge.id, user_id, period_key)
    values = build_ledger_values(
        challenge.reward, user_id=user_id, challenge_id=challenge.id, disbursal_key=key, now=now
    )
    stmt = (
        pg_insert(RewardLedgerEntry)
        .values(**values)
        .on_conflict_do_nothing(index_elements=["disbursal_key"])
        .returning(RewardLedgerEntry.id)
    )
    return (await session.execute(stmt)).first() is not None
