from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.enums import RewardType
from app.models import RewardLedgerEntry, User
from app.schemas.common import Page
from app.schemas.engine import LeaderboardEntryOut


async def get_leaderboard(session: AsyncSession, *, page: int = 1, limit: int = 20) -> Page[LeaderboardEntryOut]:
    total = (
        await session.execute(
            select(func.count(func.distinct(RewardLedgerEntry.user_id)))
        )
    ).scalar_one()

    total_points = func.coalesce(
        func.sum(RewardLedgerEntry.amount).filter(RewardLedgerEntry.reward_type == RewardType.POINTS),
        0,
    ).label("total_points")
    badge_count = func.count().filter(RewardLedgerEntry.reward_type == RewardType.BADGE).label("badge_count")

    stmt = (
        select(RewardLedgerEntry.user_id, User.username, total_points, badge_count)
        .join(User, RewardLedgerEntry.user_id == User.id)
        .group_by(RewardLedgerEntry.user_id, User.username)
        .order_by(total_points.desc(), User.username.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    items = [
        LeaderboardEntryOut(
            rank=(page - 1) * limit + i + 1,
            user_id=row.user_id,
            username=row.username,
            total_points=row.total_points,
            badge_count=row.badge_count,
        )
        for i, row in enumerate(rows)
    ]
    return Page[LeaderboardEntryOut](
        items=items, page=page, limit=limit, total=total, has_next=(page * limit) < total
    )
