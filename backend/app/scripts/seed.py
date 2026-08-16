# Run: docker compose -p meritforge run --rm backend uv run python -m app.scripts.seed
#
# Populates a FRESH `meritforge` database with demo users, challenges, forum
# activity, and drains the event queue so progress/rewards are visible
# immediately. Not idempotent — do not run against a database that already
# has seed data (out of scope for a demo seed script).
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.constants.enums import ChallengeStatus, ChallengeType, UserRole
from app.core.db import engine
from app.core.worker import run_worker_once
from app.models import Challenge, Event, User
from app.schemas.forum import CommentCreate, PostCreate
from app.services.auth.security import hash_password
from app.services.forum import comments_service, posts_service

DEMO_USERNAMES = ["ria", "arjun", "kavya", "sam", "neha"]


async def _create_admin(session: AsyncSession) -> User:
    admin = User(
        username="admin",
        email="admin@meritforge.dev",
        password_hash=hash_password("admin12345"),
        role=UserRole.ADMIN,
    )
    session.add(admin)
    await session.commit()
    await session.refresh(admin)
    return admin


async def _create_demo_users(session: AsyncSession) -> dict[str, User]:
    users: dict[str, User] = {}
    for username in DEMO_USERNAMES:
        u = User(
            username=username,
            email=f"{username}@meritforge.dev",
            password_hash=hash_password("demo12345"),
            role=UserRole.USER,
        )
        session.add(u)
        users[username] = u
    await session.commit()
    for u in users.values():
        await session.refresh(u)
    return users


async def _create_challenges(session: AsyncSession, *, admin_id: uuid.UUID) -> list[Challenge]:
    now = datetime.now(timezone.utc)
    challenges = [
        Challenge(
            name="First Solution",
            description="Get your first comment marked as the accepted solution.",
            type=ChallengeType.COUNT,
            event_type="solution_marked",
            rule_config={"target": 1, "window": "total"},
            reward={"type": "badge", "badge_code": "first_solution"},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
        Challenge(
            name="10 Answers",
            description="Post 10 comments helping other developers.",
            type=ChallengeType.COUNT,
            event_type="comment_posted",
            rule_config={"target": 10, "window": "total"},
            reward={"type": "badge", "badge_code": "ten_answers"},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
        Challenge(
            name="Weekly: 5 Comments",
            description="Post 5 comments this week.",
            type=ChallengeType.COUNT,
            event_type="comment_posted",
            rule_config={"target": 5, "window": "weekly"},
            reward={"type": "points", "amount": 150},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=90),
            created_by=admin_id,
        ),
        Challenge(
            name="Week Streak",
            description="Contribute to the forum 7 days in a row.",
            type=ChallengeType.STREAK,
            event_type="contribution",
            rule_config={"target_days": 7},
            reward={"type": "badge", "badge_code": "week_streak"},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
    ]
    session.add_all(challenges)
    await session.commit()
    for c in challenges:
        await session.refresh(c)
    return challenges


async def _create_forum_activity(session: AsyncSession, users: dict[str, User]) -> int:
    """Creates posts/comments/a marked solution via the real services (so events
    flow through the normal outbox path). Returns the number of posts created."""
    post_specs = [
        (
            "ria",
            "How do I debug a memory leak in a long-running Node service?",
            "Our service's RSS keeps climbing over a few days. Heap snapshots aren't "
            "showing an obvious culprit. What's your process for narrowing this down?",
        ),
        (
            "arjun",
            "Best way to structure a monorepo with shared TypeScript configs?",
            "Trying to avoid config drift across packages. Curious what tooling "
            "(Turborepo, Nx, plain workspaces) people have had the least pain with.",
        ),
        (
            "kavya",
            "Postgres SELECT ... FOR UPDATE SKIP LOCKED — any gotchas at scale?",
            "Building a job queue on top of Postgres and considering this pattern "
            "instead of a separate broker. What breaks when throughput gets high?",
        ),
        (
            "sam",
            "How are people handling feature flags for a default-off rollout?",
            "Want to ship behind a flag and progressively enable it. Looking for a "
            "lightweight approach that doesn't require a new infra dependency.",
        ),
    ]

    commenters = ["arjun", "kavya", "sam", "neha", "ria"]
    posts = []
    for author_username, title, body in post_specs:
        author = users[author_username]
        post = await posts_service.create_post(
            session, author_id=author.id, data=PostCreate(title=title, body=body, tags=["dev"])
        )
        posts.append((author_username, post))

    first_comment_id = None
    for author_username, post in posts:
        pool = [u for u in commenters if u != author_username]
        for i in range(2):
            commenter = users[pool[i % len(pool)]]
            comment = await comments_service.add_comment(
                session,
                post_id=post.id,
                author_id=commenter.id,
                data=CommentCreate(body=f"Have you tried checking the {['profiler', 'config', 'logs'][i % 3]}?"),
            )
            if first_comment_id is None:
                first_comment_id = (post.id, comment.id, users[author_username].id)

    if first_comment_id is not None:
        post_id, comment_id, author_id = first_comment_id
        await comments_service.mark_solution(
            session, post_id=post_id, comment_id=comment_id, actor_id=author_id
        )

    return len(posts)


async def _drain_events(session_factory: async_sessionmaker[AsyncSession]) -> int:
    total_processed = 0
    while True:
        processed = await run_worker_once(session_factory, batch_size=50)
        total_processed += processed
        if processed == 0:
            break
    return total_processed


async def main() -> None:
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as session:
        admin = await _create_admin(session)
        demo_users = await _create_demo_users(session)
        challenges = await _create_challenges(session, admin_id=admin.id)
        post_count = await _create_forum_activity(session, demo_users)

    events_processed = await _drain_events(session_factory)

    async with session_factory() as session:
        event_count = (await session.execute(select(Event))).scalars().all()

    print("Seed complete:")
    print(f"  users: {1 + len(demo_users)} (1 admin + {len(demo_users)} demo)")
    print(f"  challenges: {len(challenges)}")
    print(f"  posts: {post_count}")
    print(f"  events emitted: {len(event_count)}")
    print(f"  events processed by worker: {events_processed}")


if __name__ == "__main__":
    asyncio.run(main())
