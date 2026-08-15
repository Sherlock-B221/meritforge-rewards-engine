# 08 · Backend folder structure (monolith)

**One FastAPI application (modular monolith).** Layered, config-file-driven, with a clean
**models / controllers / services** split, parallel **constants** + **schemas (types)** modules,
and first-class exception handling. The `engine` domain stays decoupled from `forum` — it consumes
events and exposes challenge/progress/reward APIs only.

> Direction + rationale. Exact names are ours to tweak while building; the shape below satisfies
> every stated backend requirement (monolith · models/controllers split · config-driven ·
> modular/non-redundant · great exceptions · parallel constants + types).

## Layering (the rule)

```
HTTP request
  → controllers/   (thin route handlers: validate input, call a service, shape the response)
    → services/    (ALL business logic; no FastAPI, no HTTP — unit-testable in isolation)
      → models/    (SQLAlchemy ORM; the only layer that talks to the DB)
schemas/  = Pydantic request/response types crossing the controller boundary (never leak ORM)
constants/ config/ core/ = cross-cutting, imported by any layer
```

**Non-redundancy:** logic exists once, in a service. Controllers never duplicate business rules;
models never contain request/response shaping. Shared helpers (comment-tree, period keys, token
utils) are their own small modules.

## Tree

```
backend/
├── app/
│   ├── main.py                     # create_app(): factory — mounts /api router, middleware,
│   │                               #   error handlers, CORS, lifespan (db, worker hooks)
│   │
│   ├── controllers/                # HTTP layer = "controllers" (thin FastAPI routers)
│   │   ├── __init__.py             # builds ONE APIRouter(prefix="/api") from all sub-routers
│   │   ├── deps.py                 # shared deps: get_session, require_user, require_admin, paginate
│   │   ├── auth_controller.py      # /auth/register, /auth/login, /auth/me
│   │   ├── posts_controller.py     # /posts (list/create/detail)
│   │   ├── comments_controller.py  # /posts/:id/comments, PATCH /posts/:id/solution/:commentId
│   │   ├── events_controller.py    # POST /events  → 202, idempotent, rate-limited
│   │   ├── admin_challenges_controller.py  # /admin/challenges (CRUD, admin-only)
│   │   ├── challenges_controller.py        # /challenges, /challenges/weekly
│   │   ├── progress_controller.py          # /users/me/progress, /streaks, /rewards
│   │   └── leaderboard_controller.py       # /leaderboard
│   │
│   ├── services/                   # business logic (the brains) — grouped by domain
│   │   ├── auth/
│   │   │   ├── auth_service.py      # register/login/me, issue tokens
│   │   │   └── security.py          # JWT encode/decode, bcrypt, Principal
│   │   ├── forum/
│   │   │   ├── posts_service.py
│   │   │   ├── comments_service.py
│   │   │   ├── comment_tree.py      # pure helper: flat rows → nested tree
│   │   │   └── trending.py          # trending score formula (documented)
│   │   ├── engine/
│   │   │   ├── ingestion_service.py # accept event (idempotent insert), the durable-queue write
│   │   │   ├── evaluation_service.py# per-event evaluation transaction (worker calls this)
│   │   │   ├── challenges_service.py# CRUD + lifecycle draft→active→expired→archived
│   │   │   ├── progress_service.py  # progress/streaks/rewards reads
│   │   │   ├── leaderboard_service.py
│   │   │   ├── streaks.py           # advance_streak / record_activity (UTC-day logic)
│   │   │   ├── evaluators/          # REGISTRY: add a type w/o touching core
│   │   │   │   ├── base.py          # Evaluator ABC + EvaluationOutcome
│   │   │   │   ├── count.py
│   │   │   │   ├── streak.py
│   │   │   │   └── registry.py      # {ChallengeType: Evaluator}
│   │   │   └── rewards/
│   │   │       ├── disbursal.py     # idempotent ledger insert (unique disbursal_key)
│   │   │       └── handlers.py      # REGISTRY: {RewardType: handler} (points, badge)
│   │   └── events/
│   │       └── publisher.py         # the decoupled seam: forum services call publish_event();
│   │                               #   writes to the events table (transactional outbox).
│   │                               #   Engine consumes it. Forum never imports engine internals.
│   │
│   ├── models/                     # ORM layer (SQLAlchemy 2.0 async)
│   │   ├── __init__.py             # barrel — re-exports every model
│   │   ├── base.py                 # Base + TimestampMixin
│   │   ├── user.py                 # User
│   │   ├── forum.py                # Post, Comment, PostUpvote
│   │   └── engine.py               # Event, Challenge, ChallengeProgress,
│   │                               #   UserDailyActivity, UserStreak, RewardLedgerEntry
│   │
│   ├── schemas/                    # Pydantic request/response TYPES (own modules, never inlined)
│   │   ├── __init__.py
│   │   ├── common.py               # Page[T], ErrorEnvelope, pagination params
│   │   ├── auth.py                 # RegisterRequest, LoginRequest, AuthResponse, UserOut
│   │   ├── forum.py                # PostCreate, CommentCreate, PostSummaryOut, PostDetailOut, ...
│   │   └── engine.py               # CountRuleConfig, StreakRuleConfig, PointsReward, BadgeReward,
│   │                               #   ChallengeCreate, ChallengeOut, ProgressOut, RewardOut, ...
│   │
│   ├── constants/                  # parallel constants modules (never inline magic values)
│   │   ├── __init__.py
│   │   ├── events.py               # event-type strings, event namespace, contribution set,
│   │   │                           #   deterministic_event_id()
│   │   ├── enums.py                # domain enums shared by models+schemas: UserRole, EventStatus,
│   │   │                           #   ChallengeType, ChallengeStatus, RewardType (neutral module
│   │   │                           #   → no model↔schema circular imports)
│   │   └── error_codes.py          # the machine-readable error CODE strings
│   │
│   ├── config/                     # CONFIG-DRIVEN: obvious tunables come from here, not code
│   │   ├── __init__.py             # get_settings() (lru_cache singleton)
│   │   ├── settings.py             # pydantic-settings; nested groups (Db, Jwt, Forum, Engine,
│   │   │                           #   Cors, Logging) composed into one Settings
│   │   └── defaults.toml           # committed NON-SECRET defaults/tunables (see below);
│   │                               #   env vars override for secrets + per-env
│   │
│   └── core/                       # cross-cutting framework glue
│       ├── db.py                   # async engine, session factory, get_session
│       ├── errors.py               # AppError base + register_error_handlers(app)
│       ├── exceptions.py           # domain exceptions: NotFoundError, ForbiddenError,
│       │                           #   RateLimitedError, InvalidStatusTransitionError, ...
│       ├── middleware.py           # request logging, correlation-id, rate limiting
│       ├── logging.py              # structlog setup (console|json from config)
│       └── worker.py               # background queue loop: claim pending events with
│                                   #   SELECT … FOR UPDATE SKIP LOCKED → evaluation_service
│
├── migrations/                     # Alembic (env.py + versions/)
├── scripts/
│   ├── seed.py                     # demo users, admin, challenges, posts (matches wireframes)
│   └── run_worker.py               # entrypoint that runs core/worker.py as its own process
├── tests/                          # pytest: streak logic, idempotency, disbursal, evaluators
├── pyproject.toml
├── alembic.ini
├── Dockerfile
└── .env.example
```

## Config-driven: what lives in `config/` (from a file, not scattered)

`defaults.toml` (committed, non-secret) + env overrides. "Obvious things come from it":
- **DB / JWT:** `database_url` (env), `jwt_expires_minutes`, `jwt_algorithm`.
- **Pagination:** `default_page_size`, `max_page_size`.
- **Trending:** upvote/comment weights + recency decay factor (the formula's knobs).
- **Rate limiting:** `events_rate_limit_times`, `events_rate_limit_seconds`.
- **Worker:** `poll_interval_ms`, `batch_size`, `max_retries`, `retry_backoff`.
- **Engine bounds:** count target range, streak-days range, points-amount range.
- **CORS / logging:** `frontend_origin`, `log_level`, `log_format`.

Secrets (`jwt_secret`, `database_url`, `sentry_dsn`) come from env only; `.env.example` documents them.

## Exception handling (first-class)

- **`AppError`** base carries `code`, `message`, `status_code`, `details`, optional `headers`.
- Domain subclasses in `core/exceptions.py` decide their own status + code
  (`NotFoundError`→404, `ForbiddenError`→403, `RateLimitedError`→429 with `Retry-After`,
  `InvalidStatusTransitionError`→409, `ValidationError`→422…).
- `register_error_handlers(app)` (called once in `create_app`) maps `AppError`, FastAPI
  `RequestValidationError`, and `StarletteHTTPException` → the single JSON error envelope
  (`{"error":{code,message,details}}`). Error code strings live in `constants/error_codes.py`.
- Services raise domain exceptions; controllers stay clean; the envelope is produced in exactly
  one place.

## Registries (extend without touching core)

`evaluators/registry.py` maps `ChallengeType → Evaluator`; `rewards/handlers.py` maps
`RewardType → handler`. Adding a challenge/reward type = new enum value + new small module + one
registry line. No changes to ingestion, controllers, or existing types.

## The decoupled engine seam (monolith, no Redis)

Forum services never call engine code directly. They call `services/events/publisher.publish_event`
which **inserts a row into the `events` table in the same transaction** as the forum write
(transactional outbox → no lost or phantom events). The `POST /api/events` controller funnels
through the same `ingestion_service`. `core/worker.py` runs as a separate process, claims pending
events with `FOR UPDATE SKIP LOCKED`, and runs `evaluation_service` — the async background job the
brief requires.
