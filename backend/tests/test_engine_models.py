from datetime import date, datetime, timezone

import pytest
from sqlalchemy import select

from app.constants.enums import ChallengeStatus, ChallengeType, RewardType
from app.models import (
    Challenge,
    ChallengeProgress,
    RewardLedgerEntry,
    UserDailyActivity,
    UserStreak,
)


@pytest.mark.asyncio
async def test_challenge_and_progress_round_trip(db_session, user):
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name="Answer 5",
        type=ChallengeType.COUNT,
        event_type="comment_posted",
        rule_config={"target": 5, "window": "total"},
        reward={"type": "points", "amount": 50},
        status=ChallengeStatus.ACTIVE,
        start_at=now,
        end_at=now,
        created_by=user.id,
    )
    db_session.add(ch)
    await db_session.flush()
    db_session.add(
        ChallengeProgress(
            challenge_id=ch.id, user_id=user.id, period_key="", current_value=1, target_value=5
        )
    )
    await db_session.commit()
    row = (await db_session.execute(select(Challenge).where(Challenge.id == ch.id))).scalar_one()
    assert row.rule_config == {"target": 5, "window": "total"}
    assert row.status == ChallengeStatus.ACTIVE


@pytest.mark.asyncio
async def test_daily_activity_and_streak_and_ledger(db_session, user):
    db_session.add(
        UserDailyActivity(
            user_id=user.id, activity_date=date(2026, 8, 16), event_type="contribution", event_count=2
        )
    )
    db_session.add(
        UserStreak(
            user_id=user.id,
            event_type="contribution",
            current_streak=3,
            best_streak=5,
            last_activity_date=date(2026, 8, 16),
        )
    )
    now = datetime.now(timezone.utc)
    ch = Challenge(
        name="x", type=ChallengeType.STREAK, event_type="contribution",
        rule_config={"target_days": 7}, reward={"type": "badge", "badge_code": "week_streak"},
        status=ChallengeStatus.ACTIVE, start_at=now, end_at=now, created_by=user.id,
    )
    db_session.add(ch)
    await db_session.flush()
    db_session.add(
        RewardLedgerEntry(
            user_id=user.id, challenge_id=ch.id, reward_type=RewardType.BADGE,
            badge_code="week_streak", disbursal_key=f"{ch.id}:{user.id}:",
        )
    )
    await db_session.commit()
    led = (await db_session.execute(select(RewardLedgerEntry))).scalars().all()
    assert len(led) == 1 and led[0].badge_code == "week_streak"
