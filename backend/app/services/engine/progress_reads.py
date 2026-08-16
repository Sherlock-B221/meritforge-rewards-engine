import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.enums import ChallengeStatus, ChallengeType
from app.core.exceptions import NotFoundError
from app.models import Challenge, ChallengeProgress
from app.schemas.engine import (
    ChallengeProgressOut,
    ChallengeWithProgressOut,
    CountRuleConfig,
    StreakRuleConfig,
    WeeklyChallengeOut,
)
from app.services.engine.periods import date_of, next_monday_utc, period_key_for


def _period_key_for_challenge(challenge: Challenge, now: datetime) -> str:
    if challenge.type == ChallengeType.COUNT:
        cfg = CountRuleConfig.model_validate(challenge.rule_config)
        return period_key_for(cfg.window, date_of(now))
    return ""


async def _progress_for(
    session: AsyncSession, challenge: Challenge, user_id: uuid.UUID, now: datetime
) -> ChallengeProgressOut:
    period_key = _period_key_for_challenge(challenge, now)
    row = (
        await session.execute(
            select(ChallengeProgress).where(
                ChallengeProgress.challenge_id == challenge.id,
                ChallengeProgress.user_id == user_id,
                ChallengeProgress.period_key == period_key,
            )
        )
    ).scalar_one_or_none()

    if row is None:
        if challenge.type == ChallengeType.COUNT:
            target_value = CountRuleConfig.model_validate(challenge.rule_config).target
        else:
            target_value = StreakRuleConfig.model_validate(challenge.rule_config).target_days
        return ChallengeProgressOut(
            period_key=period_key, current_value=0, target_value=target_value, completed=False
        )

    return ChallengeProgressOut(
        period_key=row.period_key,
        current_value=row.current_value,
        target_value=row.target_value,
        completed=row.completed_at is not None,
    )


async def list_active_with_progress(
    session: AsyncSession, *, user_id: uuid.UUID, now: datetime
) -> list[ChallengeWithProgressOut]:
    challenges = (
        await session.execute(select(Challenge).where(Challenge.status == ChallengeStatus.ACTIVE))
    ).scalars().all()
    result = []
    for challenge in challenges:
        progress = await _progress_for(session, challenge, user_id, now)
        result.append(
            ChallengeWithProgressOut(
                id=challenge.id,
                name=challenge.name,
                description=challenge.description,
                type=challenge.type,
                event_type=challenge.event_type,
                rule_config=challenge.rule_config,
                reward=challenge.reward,
                start_at=challenge.start_at,
                end_at=challenge.end_at,
                progress=progress,
            )
        )
    return result


async def get_weekly_with_progress(
    session: AsyncSession, *, user_id: uuid.UUID, now: datetime
) -> WeeklyChallengeOut:
    challenge = (
        await session.execute(
            select(Challenge)
            .where(
                Challenge.status == ChallengeStatus.ACTIVE,
                Challenge.type == ChallengeType.COUNT,
                Challenge.rule_config["window"].astext == "weekly",
            )
            .order_by(Challenge.created_at.desc())
        )
    ).scalars().first()
    if challenge is None:
        raise NotFoundError("weekly_challenge", "current")

    progress = await _progress_for(session, challenge, user_id, now)
    return WeeklyChallengeOut(
        id=challenge.id,
        name=challenge.name,
        description=challenge.description,
        type=challenge.type,
        event_type=challenge.event_type,
        rule_config=challenge.rule_config,
        reward=challenge.reward,
        start_at=challenge.start_at,
        end_at=challenge.end_at,
        progress=progress,
        resets_at=next_monday_utc(now),
    )
