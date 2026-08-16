# P4 — engine read/admin APIs + leaderboard + seed (lean checklist)

Source: `mind-map/02-api-contract.md`, `mind-map/03-data-model-and-engine.md`,
`mind-map/08-backend-structure.md`. This is a short in-session checklist, not a full plan doc — P3
already has the heavy-rigor plan; P4 is lean per `docs/plans/GOALS.md`.

## Global constraints (apply to both tasks — copy into every dispatch)

- Stack/layering already established: `controllers/` (thin FastAPI routers) → `services/<domain>/`
  (business logic) → `models/` (SQLAlchemy). Request/response types live in `schemas/`. Never put
  business logic in a controller or response-shaping in a service.
- Auth deps already exist in `app/controllers/deps.py`: `require_user`, `require_admin` (raises
  `ForbiddenError` → 403), `paginate` → `PageParams(page, limit)` (clamps to
  `settings.default_page_size` / `max_page_size`). Reuse them; do not reinvent.
- Error envelope is `{"error": {"code", "message", "details"}}`, produced by `AppError` subclasses
  in `app/core/exceptions.py` (see `NotFoundError`, `ForbiddenError`, `ConflictError`,
  `RateLimitedError` for the pattern). Error code strings live in `app/constants/error_codes.py`.
- Timestamps: SQLAlchemy `DateTime(timezone=True)` + Pydantic `datetime` already serialize as
  ISO-8601 UTC — nothing extra needed.
- **Pagination rule for this phase:** the API contract only says "paginated" for
  `GET /users/me/rewards` and `GET /leaderboard` — paginate only those two (reuse the `Page[T]`
  schema in `app/schemas/common.py` + the `paginate` dependency, exactly like
  `posts_controller.list_posts`). `GET /admin/challenges`, `GET /challenges`, and
  `GET /challenges/weekly` are NOT paginated in the contract — return plain arrays/objects.
- New schemas go in `app/schemas/engine.py` (append to the existing file — it already has
  `CountRuleConfig`, `StreakRuleConfig`, `PointsReward`, `BadgeReward`, `EventIn`,
  `EventAccepted`, `parse_rule_config`, `parse_reward`). New controllers get registered in
  `app/controllers/__init__.py` (`api_router.include_router(...)`, same pattern as the existing
  four).
- Run tests with `docker compose -p meritforge run --rm backend uv run pytest -q` and
  `docker compose -p meritforge run --rm backend uv run ruff check .` from the repo root (the `db`
  container is already up). Both must be green before you report done.
- Test fixtures already in `backend/tests/conftest.py`: `async_client`, `db_session`,
  `session_factory`, `user`, `other_user` (both plain `User` rows). There is no `admin_user`
  fixture yet — create an admin inline in your own tests via
  `User(username=..., email=..., password_hash="x", role=UserRole.ADMIN)` (see
  `app/constants/enums.UserRole`) and mint its bearer token with
  `create_access_token(user.id, user.role)` from `app.services.auth.security` (same helper the
  app uses internally) — do not go through `/auth/register` for admins since that endpoint always
  creates `role=user`.
- Follow existing code style exactly (see `posts_controller.py` / `posts_service.py` /
  `comments_service.py` for the shape of a controller+service pair, and `test_posts_api.py` for the
  API-test shape: `_register`/`_auth` helpers, `@pytest.mark.asyncio`).
- Commit each task's work as its own commit (conventional-commit style, matching this repo's
  history, e.g. `feat(backend): admin challenge CRUD + lifecycle + user challenge reads`).

---

# Task 1: Admin challenge CRUD + lifecycle + GET /challenges + /challenges/weekly

**Endpoints (from `mind-map/02-api-contract.md`):**
- `POST /api/admin/challenges` (admin) — create.
- `GET /api/admin/challenges?status=` (admin) — list, optional status filter, NOT paginated.
- `PATCH /api/admin/challenges/:id` (admin) — update config and/or status transition.
- `DELETE /api/admin/challenges/:id` (admin) — archives (soft), idempotent, `204`.
- `GET /api/challenges` (user) — active challenges + current user's progress, NOT paginated.
- `GET /api/challenges/weekly` (user) — the current weekly challenge + user's progress + `resets_at`.

**New error plumbing** — add to `app/constants/error_codes.py`:
```python
INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION"
```
Add to `app/core/exceptions.py`:
```python
class ValidationError(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(codes.VALIDATION_ERROR, message, status.HTTP_422_UNPROCESSABLE_ENTITY, details)

class InvalidStatusTransitionError(AppError):
    def __init__(self, from_status, to_status):
        super().__init__(
            codes.INVALID_STATUS_TRANSITION,
            f"Cannot transition challenge from {from_status} to {to_status}",
            status.HTTP_409_CONFLICT,
            {"from": str(from_status), "to": str(to_status)},
        )
```

**Schemas** — append to `app/schemas/engine.py` (imports you'll need:
`from app.constants.enums import ChallengeStatus, ChallengeType`, `model_validator` from pydantic):
```python
class ChallengeCreate(BaseModel):
    name: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=2000)
    type: ChallengeType
    event_type: str = Field(min_length=1, max_length=100)
    rule_config: dict
    reward: dict
    start_at: datetime
    end_at: datetime

    @model_validator(mode="after")
    def _validate(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        try:
            parse_rule_config(self.type, self.rule_config)
            parse_reward(self.reward)
        except Exception as e:
            raise ValueError(f"invalid rule_config/reward for type {self.type.value}: {e}") from e
        return self

class ChallengeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    rule_config: dict | None = None
    reward: dict | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    status: ChallengeStatus | None = None
    # `type` is immutable after creation — changing it would orphan existing
    # challenge_progress rows evaluated under the old evaluator. Not settable here.

class ChallengeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str
    type: ChallengeType
    event_type: str
    rule_config: dict
    reward: dict
    status: ChallengeStatus
    start_at: datetime
    end_at: datetime
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

class ChallengeProgressOut(BaseModel):
    period_key: str
    current_value: int
    target_value: int
    completed: bool

class ChallengeWithProgressOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    type: ChallengeType
    event_type: str
    rule_config: dict
    reward: dict
    start_at: datetime
    end_at: datetime
    progress: ChallengeProgressOut

class WeeklyChallengeOut(ChallengeWithProgressOut):
    resets_at: datetime
```
(`ConfigDict` is already imported at the top of `schemas/engine.py`'s siblings like `schemas/forum.py`
— add the import to `schemas/engine.py` if not already present.)

**Periods helper** — add to `app/services/engine/periods.py`:
```python
from datetime import time  # add to the existing datetime import line

def next_monday_utc(now: datetime) -> datetime:
    """The next UTC Monday 00:00 strictly after `now` — the weekly reset instant."""
    d = date_of(now)
    days_ahead = (7 - d.weekday()) % 7 or 7
    return datetime.combine(d + timedelta(days=days_ahead), time.min, tzinfo=timezone.utc)
```
(`timedelta` needs adding to the existing `datetime` import too.)

**Service** — new file `app/services/engine/challenges_service.py`:
- `ALLOWED_TRANSITIONS: dict[ChallengeStatus, set[ChallengeStatus]]`:
  `DRAFT -> {ACTIVE, ARCHIVED}`, `ACTIVE -> {EXPIRED, ARCHIVED}`, `EXPIRED -> {ARCHIVED}`,
  `ARCHIVED -> {}` (terminal).
- `create_challenge(session, *, created_by, data: ChallengeCreate) -> ChallengeOut` — insert with
  `status=ChallengeStatus.DRAFT` always (admins activate it via a separate PATCH — this keeps
  "create" and "go live" as distinct, auditable actions). Commit, return `ChallengeOut`.
- `list_challenges(session, *, status: ChallengeStatus | None) -> list[ChallengeOut]` — optional
  status filter, order by `created_at.desc()`.
- `update_challenge(session, *, challenge_id, data: ChallengeUpdate) -> ChallengeOut`:
  1. Load challenge or `NotFoundError("challenge", challenge_id)`.
  2. If `data.status is not None` and `data.status != challenge.status`: if
     `data.status not in ALLOWED_TRANSITIONS[challenge.status]`, raise
     `InvalidStatusTransitionError(challenge.status, data.status)`; else set it.
  3. If `data.rule_config is not None`: validate via
     `try: parse_rule_config(challenge.type, data.rule_config) except Exception as e: raise ValidationError(str(e)) from e`,
     then assign.
  4. If `data.reward is not None`: same pattern with `parse_reward`.
  5. Assign `name`/`description`/`start_at`/`end_at` if provided. If both `start_at`/`end_at` end
     up set, re-check `end_at > start_at` (raise `ValidationError` if not — reuse whichever of the
     two changed plus the existing other value).
  6. Commit, return `ChallengeOut`.
- `archive_challenge(session, *, challenge_id) -> None` — load or `NotFoundError`; if already
  `ARCHIVED`, no-op (idempotent); else must have `ARCHIVED` in `ALLOWED_TRANSITIONS[status]` (true
  for all three other statuses) — set `status=ARCHIVED`, commit.

**Service** — new file `app/services/engine/progress_reads.py` (shared by this task's user-facing
reads; Task 2 will add its own `progress_service.py` for `/users/me/*` — keep these separate files,
they serve different endpoints):
- `_period_key_for_challenge(challenge, now) -> str` — for `ChallengeType.COUNT`, parse
  `CountRuleConfig` and call `period_key_for(cfg.window, date_of(now))`; for `STREAK`, return `""`
  (mirrors exactly what the evaluators do — see `app/services/engine/evaluators/count.py` and
  `streak.py` for reference, but this is a **read-only** lookup: do NOT upsert `challenge_progress`
  here, only `SELECT`).
- `_progress_for(session, challenge, user_id, now) -> ChallengeProgressOut` — compute the period
  key, `SELECT` the matching `ChallengeProgress` row (`challenge_id`, `user_id`, `period_key`); if
  none exists yet, default `current_value=0`, `target_value` from the challenge's own rule_config
  (`target` for count, `target_days` for streak), `completed=False`. If a row exists,
  `completed = row.completed_at is not None`.
- `list_active_with_progress(session, *, user_id, now) -> list[ChallengeWithProgressOut]` — all
  challenges with `status == ChallengeStatus.ACTIVE`, each with `_progress_for`.
- `get_weekly_with_progress(session, *, user_id, now) -> WeeklyChallengeOut` — the single ACTIVE
  challenge with `type == ChallengeType.COUNT` and `rule_config->>'window' == 'weekly'`
  (Postgres JSONB `->>` via SQLAlchemy: `Challenge.rule_config["window"].astext == "weekly"`), most
  recently created first (`order_by(Challenge.created_at.desc())`, take the first); if none,
  `raise NotFoundError("weekly_challenge", "current")`. Attach `resets_at = next_monday_utc(now)`.

**Controllers:**
- New `app/controllers/admin_challenges_controller.py`, `router = APIRouter(prefix="/admin/challenges", tags=["admin"])`,
  all routes `Depends(require_admin)`:
  - `POST ""` → 201, `ChallengeOut`.
  - `GET ""` → `status: ChallengeStatus | None = None` query param → `list[ChallengeOut]`.
  - `PATCH "/{challenge_id}"` → `ChallengeOut`.
  - `DELETE "/{challenge_id}"` → `204` (`status_code=status.HTTP_204_NO_CONTENT`, no response body).
- New `app/controllers/challenges_controller.py`, `router = APIRouter(prefix="/challenges", tags=["challenges"])`,
  both routes `Depends(require_user)`:
  - `GET ""` → `list[ChallengeWithProgressOut]`.
  - `GET "/weekly"` → `WeeklyChallengeOut`.
  - Use `datetime.now(timezone.utc)` for `now` in both.
- Register both routers in `app/controllers/__init__.py`.

**Tests** (new `backend/tests/test_admin_challenges_api.py` and
`backend/tests/test_challenges_api.py`), cover at least:
- Non-admin gets `403` on every `/admin/challenges` route.
- Create → list → patch (config change) → patch (valid status transition draft→active) → patch
  with an invalid transition (e.g. active→draft) returns `409` with code
  `INVALID_STATUS_TRANSITION` → delete (archive) → delete again is idempotent (`204` both times).
- `rule_config`/`type` mismatch on create is `422`.
- `GET /challenges` only returns `ACTIVE` challenges, and progress defaults to `current_value=0`
  when no `challenge_progress` row exists yet, and reflects real progress after evaluating an event
  (reuse `app.services.engine.evaluation_service.evaluate_event` directly in the test the same way
  `tests/test_evaluators.py` builds a challenge — call it once and assert the count went from 0 to 1).
- `GET /challenges/weekly` returns `404` when no weekly challenge is active, and returns
  `resets_at` as a future UTC Monday when one is.

---

# Task 2: GET /users/me/{progress,streaks,rewards} + GET /leaderboard + seed script

**Endpoints (from `mind-map/02-api-contract.md`):**
- `GET /api/users/me/progress` (user) — all challenge progress for current user, NOT paginated.
- `GET /api/users/me/streaks` (user) — streak history + current streak (feeds the heatmap), NOT
  paginated.
- `GET /api/users/me/rewards` (user) — paginated reward ledger.
- `GET /api/leaderboard` (user) — users ranked by total points, paginated.
- `backend/app/scripts/seed.py` — demo data (see below).

**Config addition** — add to `app/config/settings.py` `Settings` class (one new field, alongside
the other tunables): `heatmap_days: int = 180`, and to `app/config/defaults.toml`:
`heatmap_days = 180`. This is the lookback window for the streak/contribution heatmap — config-
driven per this repo's convention (see the `trending_*` knobs for the pattern), not a hardcoded
magic number in the service.

**Schemas** — append to `app/schemas/engine.py`:
```python
class ProgressEntryOut(BaseModel):
    challenge_id: uuid.UUID
    challenge_name: str
    type: ChallengeType
    event_type: str
    period_key: str
    current_value: int
    target_value: int
    completed: bool
    completed_at: datetime | None

class StreakOut(BaseModel):
    event_type: str
    current_streak: int
    best_streak: int
    last_activity_date: date | None

class HeatmapDayOut(BaseModel):
    activity_date: date
    event_count: int

class UserStreaksOut(BaseModel):
    streaks: list[StreakOut]
    heatmap: list[HeatmapDayOut]

class RewardOut(BaseModel):
    id: uuid.UUID
    challenge_id: uuid.UUID
    challenge_name: str
    reward_type: RewardType
    amount: int | None
    badge_code: str | None
    created_at: datetime

class LeaderboardEntryOut(BaseModel):
    rank: int
    user_id: uuid.UUID
    username: str
    total_points: int
    badge_count: int
```
(needs `from datetime import date` added to the existing `datetime` import, and
`from app.constants.enums import RewardType` added to the existing enums import line.)

**Service** — new file `app/services/engine/progress_service.py`:
- `get_my_progress(session, *, user_id) -> list[ProgressEntryOut]` — `SELECT ChallengeProgress
  JOIN Challenge ON challenge_id`, `WHERE ChallengeProgress.user_id == user_id`, order by
  `ChallengeProgress.updated_at.desc()`. `completed = row.completed_at is not None`.
- `get_my_streaks(session, *, user_id) -> UserStreaksOut`:
  - `streaks`: all `UserStreak` rows for this user (`SELECT ... WHERE user_id == user_id`), mapped
    to `StreakOut`.
  - `heatmap`: `UserDailyActivity` rows for this user where
    `event_type == app.constants.events.CONTRIBUTION` (the synthetic aggregate — see
    `app/constants/events.py`) and `activity_date >= utc_today() - timedelta(days=settings.heatmap_days)`
    (use `app.services.engine.periods.utc_today` and `get_settings()`), ordered by
    `activity_date.asc()`, mapped to `HeatmapDayOut`.
- `get_my_rewards(session, *, user_id, page, limit) -> Page[RewardOut]` — `SELECT RewardLedgerEntry
  JOIN Challenge ON challenge_id WHERE user_id == user_id ORDER BY created_at DESC`, paginate
  exactly like `posts_service.get_feed` (count query + `offset`/`limit`), wrap in
  `Page[RewardOut]`.

**Service** — new file `app/services/engine/leaderboard_service.py`:
- `get_leaderboard(session, *, page, limit) -> Page[LeaderboardEntryOut]`. Aggregate over
  `RewardLedgerEntry` joined to `User`:
  `SUM(amount) FILTER (WHERE reward_type = 'points')` as `total_points`, and
  `COUNT(*) FILTER (WHERE reward_type = 'badge')` as `badge_count`, `GROUP BY user_id, username`,
  `ORDER BY total_points DESC, username ASC`. This naturally only includes users with at least one
  `reward_ledger` row — that is the intended scope (a leaderboard of users who have earned
  something; `reward_ledger` is the sole source of truth for points per `mind-map/03`). Paginate
  with a separate `COUNT(DISTINCT user_id)` for `total`. Assign `rank = (page - 1) * limit + i + 1`
  for the i-th row (0-indexed) in the returned page.

**Controller** — new `app/controllers/progress_controller.py`,
`router = APIRouter(prefix="/users/me", tags=["progress"])`, all routes `Depends(require_user)`:
- `GET "/progress"` → `list[ProgressEntryOut]`.
- `GET "/streaks"` → `UserStreaksOut`.
- `GET "/rewards"` → `Page[RewardOut]`, `pg: PageParams = Depends(paginate)`.

**Controller** — new `app/controllers/leaderboard_controller.py`,
`router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])`, `Depends(require_user)`:
- `GET ""` → `Page[LeaderboardEntryOut]`, `pg: PageParams = Depends(paginate)`.

Register both routers in `app/controllers/__init__.py`.

**Tests** (new `backend/tests/test_progress_api.py`, `backend/tests/test_leaderboard_api.py`),
cover at least:
- All four endpoints `401` without a token.
- `/users/me/progress` reflects a real `ChallengeProgress` row after evaluating one event (same
  pattern as Task 1's evaluator-driven test).
- `/users/me/streaks` heatmap contains a day entry after a `contribution`-type event is evaluated
  (use `app.services.engine.streaks.record_activity` + `advance_streak` directly, or run a full
  event through `evaluate_event`, matching `tests/test_engine_flow.py`'s style).
- `/users/me/rewards` is paginated and reflects a disbursed reward (drive a challenge to completion
  through `evaluate_event` the way `tests/test_evaluation_service.py` does, then hit the endpoint).
- `/leaderboard` ranks two users by total points correctly and only includes users with a
  `reward_ledger` row (a third user with zero rewards is absent).

**Seed script** — `backend/app/scripts/seed.py`, a `main()` entrypoint runnable via
`docker compose -p meritforge run --rm backend uv run python -m app.scripts.seed` (add this exact
command as a comment at the top of the file, mirroring `run_worker.py`'s header style). Use
`async_sessionmaker(engine, ...)` from `app.core.db` directly (see `app/scripts/run_worker.py` for
the bootstrap pattern), and reuse `app.services.auth.security.hash_password`.

1. Truncate is NOT required — the script should be safe to run on a fresh (empty) database only;
   don't add upsert/idempotency logic here (out of scope for a demo seed).
2. Create one admin: `username="admin"`, `email="admin@meritforge.dev"`,
   `password_hash=hash_password("admin12345")`, `role=UserRole.ADMIN`.
3. Create 5 demo users (plain `role=UserRole.USER`): usernames `ria`, `arjun`, `kavya`, `sam`,
   `neha`, emails `{username}@meritforge.dev`, password `demo12345` for all (hashed).
4. Create 4 challenges, `created_by=admin.id`, `status=ChallengeStatus.ACTIVE`,
   `start_at=now - 1 day`, `end_at=now + 30 days` (the weekly one: `end_at=now + 90 days` — the
   30/90-day window is just the challenge's overall lifecycle bound, unrelated to the weekly
   reset, which is driven by `period_key` rolling over):
   - "First Solution" — `type=COUNT`, `event_type="solution_marked"`,
     `rule_config={"target": 1, "window": "total"}`,
     `reward={"type": "badge", "badge_code": "first_solution"}`.
   - "10 Answers" — `type=COUNT`, `event_type="comment_posted"`,
     `rule_config={"target": 10, "window": "total"}`,
     `reward={"type": "badge", "badge_code": "ten_answers"}`.
   - "Weekly: 5 Comments" — `type=COUNT`, `event_type="comment_posted"`,
     `rule_config={"target": 5, "window": "weekly"}`, `reward={"type": "points", "amount": 150}`
     — this is the one `/challenges/weekly` will surface.
   - "Week Streak" — `type=STREAK`, `event_type="contribution"`,
     `rule_config={"target_days": 7}`, `reward={"type": "badge", "badge_code": "week_streak"}`.
5. Create 4 posts (one per non-admin user except `neha`, who only comments) via
   `app.services.forum.posts_service.create_post` (reuse the real service so events are emitted
   through the normal outbox path — do not hand-insert `Post` rows), realistic dev-forum titles/
   bodies of your choosing (e.g. debugging, tooling, architecture questions). Add 2-3 comments per
   post from other demo users via `comments_service.add_comment`, and mark one comment as the
   solution on one post via `comments_service.mark_solution`.
6. After all forum actions, drain the event queue synchronously so the demo shows real progress/
   rewards immediately: loop calling
   `await app.core.worker.run_worker_once(session_factory, batch_size=50)` until it returns `0`
   (same helper the real worker process uses — see `app/core/worker.py`).
7. Print a short summary to stdout (counts of users/challenges/posts/events processed).

Add a short section to `backend/README.md` if one exists, else skip — not required for this task.

---

## Done criteria (both tasks)

- Every engine endpoint in `mind-map/02-api-contract.md`'s "Challenges — Admin", "Challenges —
  User", "Progress & streaks", "Rewards", and "Leaderboard" sections exists and matches its auth
  requirement.
- `docker compose -p meritforge run --rm backend uv run pytest -q` green (all old + new tests).
- `docker compose -p meritforge run --rm backend uv run ruff check .` clean.
- `docker compose -p meritforge run --rm backend uv run python -m app.scripts.seed` runs
  successfully against a fresh `meritforge` database (not `meritforge_test`) without errors.
- Each task is its own commit.
