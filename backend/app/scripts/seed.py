# Run: docker compose -p meritforge run --rm backend uv run python -m app.scripts.seed
# (or, against Render prod, with DATABASE_URL pointed at the prod Postgres instance).
#
# Populates a `meritforge` database with demo users, challenges, forum activity,
# upvotes, and a backdated streak history for the hero user, then drains the
# event queue so progress/rewards are visible immediately.
#
# Idempotent: exits immediately if `admin@meritforge.dev` already exists, so it
# is safe to run on every `docker compose up` and safe to re-run against a
# partially-seeded prod database.
#
# Demo-realism note: the wireframes this seed reproduces show illustrative
# upvote counts (e.g. ▲48) and point totals in the thousands. With only 7 demo
# personas, per-user-unique upvotes cap out in the single digits (an upvote is
# unique per (post, user)), and there simply aren't enough seeded challenges to
# organically accumulate thousands of points. Rather than inflate the roster
# with dozens of throwaway accounts purely to pad numbers, this seed reproduces
# the *shape* of the wireframe data (ordered upvote counts, a mixed
# points+badge reward ledger, a leaderboard spread where the hero user is
# solidly mid-pack rather than #1) at a scale the real event-driven engine can
# organically produce.
import asyncio
import uuid
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.constants import events as ev_const
from app.constants.enums import ChallengeStatus, ChallengeType, UserRole
from app.core.db import engine
from app.core.worker import run_worker_once
from app.models import Challenge, ChallengeProgress, Event, RewardLedgerEntry, User
from app.schemas.engine import CountRuleConfig
from app.schemas.forum import CommentCreate, PostCreate
from app.services.auth.security import hash_password
from app.services.engine.evaluation_service import evaluate_event
from app.services.engine.periods import date_of, period_key_for, utc_today
from app.services.engine.rewards.disbursal import disbursal_key_for
from app.services.engine.rewards.handlers import build_ledger_values
from app.services.events.publisher import publish_event
from app.services.forum import comments_service, posts_service

ADMIN_EMAIL = "admin@meritforge.dev"
DEMO_USERNAMES = ["ria", "arjun", "kavya", "sam", "neha", "toml", "vultr_sa"]

POST_SPECS = [
    (
        "gpu",
        "ria",
        "How do I autoscale Cloud GPU workloads for batch inference?",
        "Our batch inference queue spikes hard during business hours and idles overnight. "
        "Looking for a sane autoscaling setup on GPU nodes that doesn't eat the whole budget "
        "keeping warm capacity around just in case. What's worked for you?",
        ["gpu", "kubernetes"],
    ),
    (
        "storage",
        "arjun",
        "Object Storage vs Block Storage for a media pipeline?",
        "Building a transcode pipeline that ingests raw uploads and outputs multiple "
        "renditions. Trying to decide how much should live on object storage vs a block "
        "volume mounted to the workers.",
        ["storage"],
    ),
    (
        "networking",
        "toml",
        "Best region pairing for low-latency EU + US traffic?",
        "Serving both EU and US users from two regions and trying to pick a pairing that "
        "keeps cross-region replication latency low without overpaying for transit.",
        ["networking"],
    ),
    (
        "db",
        "neha",
        "Managed Postgres backups — how do point-in-time restores actually work?",
        "Before I trust point-in-time recovery for a production database, I want to "
        "understand what's actually happening under the hood between the base backup and "
        "the WAL stream.",
        ["db"],
    ),
]

# post_key -> ordered list of (commenter_username, body, is_reply_to_first)
THREAD1_COMMENTS = [
    (
        "vultr_sa",
        "We handle this with a KEDA ScaledObject watching the inference queue depth, plus a "
        "min-replica floor so you're not eating cold starts on every burst. Happy to share "
        "the manifest if useful.",
    ),
    (
        "arjun",
        "Are you bin-packing multiple models onto the same GPU or one model per node?",
    ),
    (
        "kavya",
        "We had good luck with a custom metric (queue depth / GPU) instead of raw utilization "
        "for the scaler.",
    ),
    (
        "sam",
        "Curious if you're on spot/preemptible GPU nodes — that changes the autoscaling story "
        "quite a bit.",
    ),
    (
        "neha",
        "What's your batch size doing to memory headroom when you scale out?",
    ),
    (
        "toml",
        "Following — we're about to hit this exact wall with our own inference pipeline.",
    ),
    (
        "arjun",
        "Also check your node auto-provisioner's scale-down delay — we saw premature "
        "evictions mid-batch.",
    ),
    (
        "kavya",
        "Cold start on the driver init was our biggest tax — worth pre-warming a small pool.",
    ),
    (
        "sam",
        "We ended up mixing on-demand + spot with a priority class to protect the batch "
        "queue.",
    ),
    (
        "neha",
        "We track OOMKilled events on the inference pods as an early warning signal.",
    ),
]
THREAD1_RIA_REPLY_TO_SOLUTION = (
    "This is exactly what I needed, thank you! The min-replica floor fixed our cold-start "
    "latency spikes."
)
THREAD1_RIA_FOLLOWUP = (
    "Update: rolled this out and inference latency during traffic spikes dropped ~40%. "
    "Thanks all!"
)

OTHER_THREAD_COMMENTS = {
    "storage": [
        (
            "kavya",
            "Object storage every time for the raw media — block storage doesn't buy you "
            "much unless you need POSIX semantics for the transcode step.",
        ),
        (
            "sam",
            "We mount block storage as scratch for the transcode job, then push the output "
            "straight to object storage.",
        ),
    ],
    "networking": [
        (
            "neha",
            "We pair fra1 with ewr1 and it's been solid — single-digit ms difference vs a "
            "dedicated line.",
        ),
        (
            "vultr_sa",
            "If you're doing active-active, watch your replication lag between regions more "
            "than the raw network RTT.",
        ),
    ],
    "db": [
        (
            "arjun",
            "PITR replays WAL segments from your last base backup up to the target "
            "timestamp — make sure your WAL retention window covers your actual RTO.",
        ),
        (
            "toml",
            "We test our restore path monthly in a throwaway environment. Untested backups "
            "are just wishful thinking.",
        ),
    ],
}

# post_key -> usernames who cast a real upvote (order doesn't matter, count does)
UPVOTE_MATRIX = {
    "gpu": ["arjun", "kavya", "sam", "neha", "toml", "vultr_sa"],  # 6 — most upvoted, ✓ solved
    "storage": ["ria", "kavya", "sam", "neha", "toml"],  # 5
    "db": ["ria", "arjun", "kavya", "sam"],  # 4
    "networking": ["ria", "arjun", "kavya"],  # 3
}

# username -> ISO weeks back each already-completed weekly challenge instance sits in.
# Gives the leaderboard/reward ledger a real history without ria (the hero) sitting at #1.
WEEKLY_HISTORY_PLAN = {
    "arjun": [1, 2, 3],
    "kavya": [1, 2],
    "vultr_sa": [1, 2],
    "ria": [1],
    "sam": [1],
    "toml": [2],
}

RIA_STREAK_BEST_BLOCK_DAYS = range(-40, -19)  # 21 consecutive days -> best_streak = 21
RIA_STREAK_CURRENT_BLOCK_DAYS = range(-13, 1)  # 14 consecutive days ending today -> current = 14


async def _already_seeded(session: AsyncSession) -> bool:
    existing = (
        await session.execute(select(User).where(User.email == ADMIN_EMAIL))
    ).scalar_one_or_none()
    return existing is not None


async def _create_admin(session: AsyncSession) -> User:
    admin = User(
        username="admin",
        email=ADMIN_EMAIL,
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


async def _create_challenges(session: AsyncSession, *, admin_id: uuid.UUID) -> dict[str, Challenge]:
    now = datetime.now(timezone.utc)
    specs = {
        "first_solution": Challenge(
            name="First Solution",
            description="Get your first comment marked as the accepted solution.",
            type=ChallengeType.COUNT,
            event_type=ev_const.SOLUTION_MARKED,
            rule_config={"target": 1, "window": "total"},
            reward={"type": "badge", "badge_code": "first_solution"},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
        "ten_answers": Challenge(
            name="10 Answers",
            description="Post 10 comments helping other developers.",
            type=ChallengeType.COUNT,
            event_type=ev_const.COMMENT_POSTED,
            rule_config={"target": 10, "window": "total"},
            reward={"type": "badge", "badge_code": "ten_answers"},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
        "weekly": Challenge(
            name="Post 3 Answers This Week",
            description="Post 3 comments this week to earn bonus points.",
            type=ChallengeType.COUNT,
            event_type=ev_const.COMMENT_POSTED,
            rule_config={"target": 3, "window": "weekly"},
            reward={"type": "points", "amount": 150},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=90),
            created_by=admin_id,
        ),
        "upvote5": Challenge(
            name="Get 5 Upvotes",
            description="Cast 5 upvotes on other developers' posts.",
            type=ChallengeType.COUNT,
            event_type=ev_const.POST_UPVOTED,
            rule_config={"target": 5, "window": "total"},
            reward={"type": "points", "amount": 100},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
        "week_streak": Challenge(
            name="Week Streak",
            description="Contribute to the forum 7 days in a row.",
            type=ChallengeType.STREAK,
            event_type=ev_const.CONTRIBUTION,
            rule_config={"target_days": 7},
            reward={"type": "badge", "badge_code": "week_streak"},
            status=ChallengeStatus.ACTIVE,
            start_at=now - timedelta(days=1),
            end_at=now + timedelta(days=30),
            created_by=admin_id,
        ),
    }
    session.add_all(specs.values())
    await session.commit()
    for c in specs.values():
        await session.refresh(c)
    return specs


async def _seed_ria_streak_history(session_factory: async_sessionmaker[AsyncSession], *, ria_id: uuid.UUID) -> None:
    """Directly replays backdated `contribution` events, oldest first, so ria's
    streak ends up at current=14 / best=21. Each event is evaluated immediately
    (rather than left for the worker's received_at-ordered drain) because the
    streak math is order-sensitive: an out-of-order day is silently ignored."""
    today = utc_today()
    day_offsets = [*RIA_STREAK_BEST_BLOCK_DAYS, *RIA_STREAK_CURRENT_BLOCK_DAYS]
    for offset in day_offsets:
        occurred_at = datetime.combine(today + timedelta(days=offset), time(hour=12), tzinfo=timezone.utc)
        event_id = ev_const.deterministic_event_id("seed_streak", ria_id, offset)
        async with session_factory() as session:
            inserted = await publish_event(
                session,
                event_id=event_id,
                user_id=ria_id,
                event_type=ev_const.CONTRIBUTION,
                payload={"seed": True, "day_offset": offset},
                occurred_at=occurred_at,
            )
            if inserted:
                event = await session.get(Event, event_id)
                await evaluate_event(session, event=event)
            await session.commit()


async def _create_forum_activity(session: AsyncSession, users: dict[str, User]) -> dict[str, object]:
    """Creates the 4 posts + comments + the accepted solution via the real
    services (so events flow through the normal outbox path). Returns
    {post_key: post} for use by upvote seeding."""
    posts: dict[str, object] = {}
    for key, author_username, title, body, tags in POST_SPECS:
        author = users[author_username]
        post = await posts_service.create_post(
            session, author_id=author.id, data=PostCreate(title=title, body=body, tags=tags)
        )
        posts[key] = post

    for username, body in OTHER_THREAD_COMMENTS["storage"]:
        await comments_service.add_comment(
            session, post_id=posts["storage"].id, author_id=users[username].id, data=CommentCreate(body=body)
        )
    for username, body in OTHER_THREAD_COMMENTS["networking"]:
        await comments_service.add_comment(
            session, post_id=posts["networking"].id, author_id=users[username].id, data=CommentCreate(body=body)
        )
    for username, body in OTHER_THREAD_COMMENTS["db"]:
        await comments_service.add_comment(
            session, post_id=posts["db"].id, author_id=users[username].id, data=CommentCreate(body=body)
        )

    # Thread 1: vultr_sa's answer, ria's nested thank-you reply on it, the rest
    # of the pool, then ria's own follow-up — 12 comments total.
    solution_comment = await comments_service.add_comment(
        session,
        post_id=posts["gpu"].id,
        author_id=users["vultr_sa"].id,
        data=CommentCreate(body=THREAD1_COMMENTS[0][1]),
    )
    await comments_service.add_comment(
        session,
        post_id=posts["gpu"].id,
        author_id=users["ria"].id,
        data=CommentCreate(body=THREAD1_RIA_REPLY_TO_SOLUTION, parent_comment_id=solution_comment.id),
    )
    for username, body in THREAD1_COMMENTS[1:]:
        await comments_service.add_comment(
            session, post_id=posts["gpu"].id, author_id=users[username].id, data=CommentCreate(body=body)
        )
    await comments_service.add_comment(
        session, post_id=posts["gpu"].id, author_id=users["ria"].id, data=CommentCreate(body=THREAD1_RIA_FOLLOWUP)
    )
    await comments_service.mark_solution(
        session, post_id=posts["gpu"].id, comment_id=solution_comment.id, actor_id=users["ria"].id
    )
    return posts


async def _cast_upvotes(session: AsyncSession, users: dict[str, User], posts: dict[str, object]) -> int:
    total = 0
    for post_key, usernames in UPVOTE_MATRIX.items():
        for username in usernames:
            await posts_service.upvote_post(session, post_id=posts[post_key].id, user_id=users[username].id)
            total += 1
    return total


async def _drain_events(session_factory: async_sessionmaker[AsyncSession]) -> int:
    total_processed = 0
    while True:
        processed = await run_worker_once(session_factory, batch_size=50)
        total_processed += processed
        if processed == 0:
            break
    return total_processed


async def _seed_weekly_history(
    session: AsyncSession, *, weekly_challenge: Challenge, users: dict[str, User]
) -> int:
    """Backfills already-completed instances of the weekly challenge for past
    ISO weeks (direct writes — the live event window can't reach past periods)
    so the reward ledger and leaderboard have real history, not just the
    current in-progress week."""
    now = datetime.now(timezone.utc)
    target = CountRuleConfig.model_validate(weekly_challenge.rule_config).target
    count = 0
    for username, weeks_back_list in WEEKLY_HISTORY_PLAN.items():
        user = users[username]
        for weeks_back in weeks_back_list:
            past_moment = now - timedelta(weeks=weeks_back)
            period_key = period_key_for("weekly", date_of(past_moment))
            await session.execute(
                pg_insert(ChallengeProgress)
                .values(
                    id=uuid.uuid4(),
                    challenge_id=weekly_challenge.id,
                    user_id=user.id,
                    period_key=period_key,
                    current_value=target,
                    target_value=target,
                    completed_at=past_moment,
                )
                .on_conflict_do_nothing(index_elements=["challenge_id", "user_id", "period_key"])
            )
            key = disbursal_key_for(weekly_challenge.id, user.id, period_key)
            values = build_ledger_values(
                weekly_challenge.reward,
                user_id=user.id,
                challenge_id=weekly_challenge.id,
                disbursal_key=key,
                now=past_moment,
            )
            result = await session.execute(
                pg_insert(RewardLedgerEntry).values(**values).on_conflict_do_nothing(index_elements=["disbursal_key"])
            )
            if result.rowcount:
                count += 1
    await session.commit()
    return count


async def main() -> None:
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with session_factory() as session:
        if await _already_seeded(session):
            print(f"Already seeded ({ADMIN_EMAIL} exists) — skipping.")
            return

        admin = await _create_admin(session)
        demo_users = await _create_demo_users(session)
        challenges = await _create_challenges(session, admin_id=admin.id)

    await _seed_ria_streak_history(session_factory, ria_id=demo_users["ria"].id)

    async with session_factory() as session:
        posts = await _create_forum_activity(session, demo_users)
        upvotes_cast = await _cast_upvotes(session, demo_users, posts)

    events_processed = await _drain_events(session_factory)

    async with session_factory() as session:
        historical_rewards = await _seed_weekly_history(
            session, weekly_challenge=challenges["weekly"], users=demo_users
        )
        event_count = (await session.execute(select(Event))).scalars().all()

    print("Seed complete:")
    print(f"  users: {1 + len(demo_users)} (1 admin + {len(demo_users)} demo)")
    print(f"  challenges: {len(challenges)}")
    print(f"  posts: {len(posts)}")
    print(f"  upvotes cast: {upvotes_cast}")
    print(f"  events emitted: {len(event_count)}")
    print(f"  events processed by worker: {events_processed}")
    print(f"  backfilled historical weekly completions: {historical_rewards}")


if __name__ == "__main__":
    asyncio.run(main())
