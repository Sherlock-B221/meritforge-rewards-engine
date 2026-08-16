import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.enums import ChallengeStatus
from app.core.exceptions import InvalidStatusTransitionError, NotFoundError, ValidationError
from app.models import Challenge
from app.schemas.engine import ChallengeCreate, ChallengeOut, ChallengeUpdate, parse_reward, parse_rule_config

ALLOWED_TRANSITIONS: dict[ChallengeStatus, set[ChallengeStatus]] = {
    ChallengeStatus.DRAFT: {ChallengeStatus.ACTIVE, ChallengeStatus.ARCHIVED},
    ChallengeStatus.ACTIVE: {ChallengeStatus.EXPIRED, ChallengeStatus.ARCHIVED},
    ChallengeStatus.EXPIRED: {ChallengeStatus.ARCHIVED},
    ChallengeStatus.ARCHIVED: set(),
}


async def create_challenge(
    session: AsyncSession, *, created_by: uuid.UUID, data: ChallengeCreate
) -> ChallengeOut:
    challenge = Challenge(
        name=data.name,
        description=data.description,
        type=data.type,
        event_type=data.event_type,
        rule_config=data.rule_config,
        reward=data.reward,
        status=ChallengeStatus.DRAFT,
        start_at=data.start_at,
        end_at=data.end_at,
        created_by=created_by,
    )
    session.add(challenge)
    await session.commit()
    await session.refresh(challenge)
    return ChallengeOut.model_validate(challenge)


async def list_challenges(
    session: AsyncSession, *, status: ChallengeStatus | None
) -> list[ChallengeOut]:
    stmt = select(Challenge).order_by(Challenge.created_at.desc())
    if status is not None:
        stmt = stmt.where(Challenge.status == status)
    rows = (await session.execute(stmt)).scalars().all()
    return [ChallengeOut.model_validate(c) for c in rows]


async def update_challenge(
    session: AsyncSession, *, challenge_id: uuid.UUID, data: ChallengeUpdate
) -> ChallengeOut:
    challenge = await session.get(Challenge, challenge_id)
    if challenge is None:
        raise NotFoundError("challenge", challenge_id)

    if data.status is not None and data.status != challenge.status:
        if data.status not in ALLOWED_TRANSITIONS[challenge.status]:
            raise InvalidStatusTransitionError(challenge.status, data.status)
        challenge.status = data.status

    if data.rule_config is not None:
        try:
            parse_rule_config(challenge.type, data.rule_config)
        except Exception as e:
            raise ValidationError(str(e)) from e
        challenge.rule_config = data.rule_config

    if data.reward is not None:
        try:
            parse_reward(data.reward)
        except Exception as e:
            raise ValidationError(str(e)) from e
        challenge.reward = data.reward

    if data.name is not None:
        challenge.name = data.name
    if data.description is not None:
        challenge.description = data.description
    if data.start_at is not None:
        challenge.start_at = data.start_at
    if data.end_at is not None:
        challenge.end_at = data.end_at

    if data.start_at is not None or data.end_at is not None:
        if challenge.end_at <= challenge.start_at:
            raise ValidationError("end_at must be after start_at")

    await session.commit()
    await session.refresh(challenge)
    return ChallengeOut.model_validate(challenge)


async def archive_challenge(session: AsyncSession, *, challenge_id: uuid.UUID) -> None:
    challenge = await session.get(Challenge, challenge_id)
    if challenge is None:
        raise NotFoundError("challenge", challenge_id)
    if challenge.status == ChallengeStatus.ARCHIVED:
        return
    challenge.status = ChallengeStatus.ARCHIVED
    await session.commit()
