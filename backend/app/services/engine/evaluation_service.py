from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, EventStatus
from app.models import Challenge, ChallengeProgress, Event
from app.services.engine.evaluators.registry import get_evaluator
from app.services.engine.periods import date_of
from app.services.engine.rewards.disbursal import disburse_reward
from app.services.engine.streaks import advance_streak, record_activity


async def evaluate_event(session: AsyncSession, *, event: Event) -> None:
    """Evaluate one event in the caller's (worker's) transaction. All effects —
    activity, streaks, progress, rewards, event status — commit together or not
    at all. Never commits; the worker commits on success or rolls back on error."""
    if event.status != EventStatus.PENDING:
        return  # defensive: worker already locked+claimed a pending row

    now = datetime.now(timezone.utc)
    activity_date = date_of(event.occurred_at)

    # 1. Record activity + advance streaks for the raw type and, for contribution
    #    events, the synthetic "contribution" aggregate (feeds streak challenges
    #    and the heatmap).
    streak_types = [event.event_type]
    if event.event_type in ev_const.CONTRIBUTION_EVENTS:
        streak_types.append(ev_const.CONTRIBUTION)
    for etype in streak_types:
        await record_activity(
            session, user_id=event.user_id, event_type=etype, activity_date=activity_date
        )
        await advance_streak(
            session, user_id=event.user_id, event_type=etype, activity_date=activity_date
        )

    # 2. Find active challenges whose event_type matches this event (directly, or
    #    via the contribution aggregate) and whose window contains `now`.
    candidate_types = list(streak_types)
    challenges = (
        await session.execute(
            select(Challenge).where(
                Challenge.status == ChallengeStatus.ACTIVE,
                Challenge.event_type.in_(candidate_types),
                Challenge.start_at <= now,
                Challenge.end_at > now,
            )
        )
    ).scalars().all()

    # 3. Evaluate each; on completion, claim it atomically then disburse once.
    for challenge in challenges:
        outcome = await get_evaluator(challenge.type).evaluate(
            session, challenge=challenge, user_id=event.user_id, now=now
        )
        if outcome.completed:
            claimed = (
                await session.execute(
                    update(ChallengeProgress)
                    .where(
                        ChallengeProgress.id == outcome.progress_id,
                        ChallengeProgress.completed_at.is_(None),
                    )
                    .values(completed_at=now)
                    .returning(ChallengeProgress.id)
                )
            ).first()
            if claimed is not None:
                await disburse_reward(
                    session,
                    user_id=event.user_id,
                    challenge=challenge,
                    period_key=outcome.period_key,
                    now=now,
                )

    # 4. Mark the event processed.
    event.status = EventStatus.PROCESSED
    event.processed_at = now
