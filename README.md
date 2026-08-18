# meritforge

**meritforge** is a Developer Community Forum wired to a decoupled **Challenge & Rewards
Engine**. Users register, browse and create threads, comment (with nesting), mark accepted
solutions, and upvote posts. In the background, an engine watches those actions as a stream of
events, evaluates them against admin-configured challenges (one-shot counts, weekly counts,
day streaks), and disburses points/badges the moment a challenge completes — visible in the UI
within a 30-second poll, no page refresh required.

## Why two decoupled halves

The forum and the engine are two logically separate halves of one application: the forum knows
nothing about challenges, and the engine knows nothing about posts or comments — it only knows
**events**, **challenges**, **progress**, and **rewards**. The forum's job ends the moment it
writes a row to the `events` table; the engine's job starts there.

That boundary is deliberately a **module boundary, not a network boundary**. meritforge ships as
a single FastAPI **modular monolith** with `auth` / `forum` / `engine` as strictly-bounded
internal Python packages — the `engine` package never imports forum models or logic, and the
forum never reaches into engine internals. This gets the decoupling the brief asks for (the
engine "stays decoupled from the forum") without paying for microservices — one deployable, one
Postgres, dramatically simpler to run and reason about — while leaving the seam clean enough to
extract the engine into its own service later if that's ever needed. See
[`mind-map/05-architecture-decisions.md`](./mind-map/05-architecture-decisions.md) (AD-1) for the
full rationale.

This is an original, independent implementation, designed first-principles from an assignment
brief. The full design rationale — requirements, schema, API contract, UX spec, and every
architecture decision — lives under [`mind-map/`](./mind-map/) and is the source of truth for
*why* things are built the way they are.

## Stack

- **Backend:** Python, FastAPI, SQLAlchemy (async, `asyncpg`), Alembic, PostgreSQL, JWT
  (role-based: `user` / `admin`).
- **Frontend:** TypeScript, Next.js (App Router), Tailwind, shadcn/base-ui, SWR, Recharts,
  Zustand.
- **Infra:** Docker Compose (Postgres + backend API + background worker + Next.js frontend), no
  Redis, no Celery, no message broker.

---

## Implemented features

### Auth
JWT (HS256), role-based (`user` / `admin`). Register, login, `GET /api/auth/me`. Stateless —
no session store.

### Forum
- Threads: create, list (paginated, `sort=latest|trending`, search), thread detail.
- Comments: create, **nested replies** (self-referencing `parent_comment_id`), **mark solution**
  (post-owner only).
- **Upvotes** (extension beyond the base contract): `POST /api/posts/:id/upvote`, one vote per
  `(post, user)`.
- Every write that matters to the engine (`post_created`, `comment_posted`, `solution_marked`,
  `post_upvoted`) is emitted **server-side** as a durable event in the same transaction as the
  forum write — the frontend never calls `/api/events` directly.

### Challenge & Rewards Engine
- Two challenge shapes: **count** (target occurrences of an event type, one-shot `window=total`
  or **weekly**, reset via ISO-week `period_key`) and **streak** (consecutive UTC-day activity,
  target days).
- Admin CRUD + lifecycle (`draft → active → expired/archived`) via `/api/admin/challenges`.
- Durable, idempotent async evaluation (see [Design decisions](#design-decisions) below).
- Rewards: **points** and **badges**, disbursed at-most-once into an append-only `reward_ledger`.
- Leaderboard: ranked by total points over the ledger, paginated.
- Rate limiting on `POST /api/events` (per-user fixed window, config-driven) — see the
  [rate-limit proof](#bonus-proof-rate-limiting-on-postapievents) below.

### Frontend — all 5 pages + Leaderboard
**Feed** (`/feed`), **Post Detail** (`/posts/[id]`), **Create Post** (`/posts/new`),
**Challenges** (`/challenges`), **Profile** (`/u/[username]`), **Leaderboard** (`/leaderboard`) —
plus Login/Register and the authenticated app shell (sidebar + persistent weekly-challenge
widget).

Every graded cross-cutting behavior ships:
- **Optimistic UI** on post creation and commenting (instant UI update + rollback on failure).
- **30-second polling** (SWR `refreshInterval`) on the weekly-challenge widget and the
  Challenges page.
- **URL-encoded feed state** — sort/search/page live in the query string, so the feed is
  shareable and back-button-safe.
- **Skeleton loading states** everywhere (no spinners).
- **Error boundaries** (`SectionBoundary`) on every fetch surface (8 of them) — one broken
  section degrades gracefully instead of taking down the page.
- 10 single-responsibility custom hooks (data + URL-state + countdown, etc.).
- Real charting-library visualization: **Recharts** radial progress rings (challenge
  current/target) + a contribution streak heatmap.
- Persistent weekly-challenge widget that resets every Monday (via the engine's ISO-week
  `period_key`, not a client-side timer).

`npm run typecheck`, `lint`, and `build` are all green (all 11 routes compile).

---

## Setup

### Primary path: Docker Compose

This is the supported, verified path. Migrations run automatically and healthchecks gate
startup order, so a clean-slate `docker compose up` needs no manual steps.

```bash
docker compose up
```

This brings up 4 services in dependency order:

1. `db` — Postgres 16, healthchecked with `pg_isready`.
2. `backend` — waits for `db` to be healthy, runs `alembic upgrade head` (idempotent — safe on
   every restart), then serves the API at `http://localhost:8000/api` with a healthcheck against
   `/api/health`.
3. `worker` — waits for **both** `db` and `backend` to be healthy (so it never races `backend`'s
   migration on a fresh volume), then runs the Postgres-queue worker loop.
4. `web` — waits for `backend` to be healthy, then serves the frontend at
   `http://localhost:3000`.

To run only pieces of the stack (e.g. tests, or just the API):

```bash
docker compose up -d db                          # Postgres only
docker compose run --rm backend uv run pytest -v # backend test suite
docker compose up backend                        # API only
docker compose up web                             # frontend only
```

### Local dev without Docker

Realistic for both halves, since each has its own package manager already wired up.

**Backend** (uses [`uv`](https://docs.astral.sh/uv/) per `backend/pyproject.toml`):

```bash
cd backend
cp .env.example .env                 # then point DATABASE_URL at a local Postgres
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run the worker alongside it in a second terminal:

```bash
cd backend
uv run python -m app.scripts.run_worker
```

Run tests: `uv run pytest -v`. You'll need a reachable Postgres for both `DATABASE_URL` and
`TEST_DATABASE_URL` (the docker-compose `db` service exposes `5432` on the host, so pointing
local dev at `docker compose up -d db` works too).

**Frontend** (npm, per `frontend/package.json`):

```bash
cd frontend
cp .env.example .env.local           # NEXT_PUBLIC_API_URL, defaults to http://localhost:8000/api
npm install
npm run dev        # dev server
npm run build && npm run start   # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

Note: `NEXT_PUBLIC_API_URL` is inlined at **build time** by Next.js, so if you build a
production bundle for a non-default API URL, set it before `npm run build`, not just at runtime
(the Docker image passes it as a build arg for the same reason).

### Demo data

`backend/app/scripts/seed.py` runs **automatically** on `docker compose up` (as the one-shot
`seed` service — see `docker-compose.yml`) and is **idempotent**: it no-ops if
`admin@meritforge.dev` already exists, so re-running `up` against an already-seeded volume, or
re-running the script directly, is always safe.

It creates an admin (`admin@meritforge.dev` / `admin12345`) + 7 demo users (`ria`, `arjun`,
`kavya`, `sam`, `neha`, `toml`, `vultr_sa`, all `<username>@meritforge.dev` / `demo12345`), 5
challenges (one of each shape plus the upvote-driven one: a one-shot count, a weekly count, a
streak, and the actor-credited "Get 5 Upvotes" count — see D17 above), and 4 cloud-infra forum
threads with tags, a 12-comment thread with a real accepted solution, and real upvotes cast
through the actual `POST /posts/:id/upvote` endpoint — all generated through the real
`posts_service`/`comments_service`, so events flow through the normal event/outbox path and are
then drained synchronously through the real worker (`run_worker_once`), so progress and rewards
are visible immediately rather than waiting on the polling worker. It also backdates a real
21-day-best / 14-day-current contribution streak for the hero user (`ria`) by replaying ordered
synthetic events through the real evaluator, and backfills a few historical weekly-challenge
completions (past ISO weeks) directly so the reward ledger and leaderboard have real depth.

To run it manually (e.g. against a non-local database):

```bash
docker compose run --rm backend uv run python -m app.scripts.seed
```

---

## Environment variables

There are exactly two `.env.example` files in this repo, and the split between them is
deliberate (see `mind-map/07-decision-log-open-questions.md`, D10):

- **`.env.example` files hold only per-environment / secret values** — the things that must
  differ between your machine, CI, and a real deployment, or that should never be committed with
  a real value.
- **Everything else — non-secret tunables** (rate limits, page sizes, trending-score weights,
  worker poll interval, heatmap window, JWT expiry, etc.) — **lives committed in
  `backend/app/config/defaults.toml`** with sensible defaults, so they're visible, diffable, and
  don't require touching env files to discover or reason about.

Under the hood every field on `backend/app/config/settings.py`'s `Settings` class is a
`pydantic-settings` field, and **any of them can be overridden by a same-named uppercase
environment variable** — the precedence order is `env var > .env file > defaults.toml > code
default`. `.env.example` simply documents the subset that's expected to vary; `defaults.toml`
documents the subset that's expected to stay fixed unless you have a specific reason to change
it.

### `backend/.env.example`

```
DATABASE_URL=postgresql://meritforge:meritforge@localhost:5432/meritforge
TEST_DATABASE_URL=postgresql://meritforge:meritforge@localhost:5432/meritforge_test
JWT_SECRET=dev-secret-change-me
```

| Var | Meaning |
| --- | --- |
| `DATABASE_URL` | Main Postgres connection string (sync form; the app derives the async `asyncpg` URL from it). |
| `TEST_DATABASE_URL` | Separate database used by the test suite, so tests never touch dev data. |
| `JWT_SECRET` | HMAC signing secret for JWTs. The example value is a placeholder — set a real secret for anything beyond local dev. |

### `frontend/.env.example`

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

| Var | Meaning |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL the single frontend API client talks to. `NEXT_PUBLIC_*` vars are inlined into the client bundle at build time by Next.js. |

### `backend/app/config/defaults.toml` (committed, overridable via env)

| Key | Default | Meaning |
| --- | --- | --- |
| `jwt_algorithm` | `HS256` | JWT signing algorithm. |
| `jwt_expires_minutes` | `1440` | JWT lifetime (24h). |
| `default_page_size` / `max_page_size` | `20` / `100` | Pagination defaults/cap across list endpoints. |
| `frontend_origin` | `http://localhost:3000` | Allowed CORS origin. |
| `trending_upvote_weight` / `trending_comment_weight` / `trending_gravity` | `2.0` / `1.5` / `1.5` | Knobs for the feed's trending-score formula (engagement decayed by age). |
| `events_rate_limit_times` / `events_rate_limit_seconds` | `60` / `60` | Per-user rate limit on `POST /api/events` — N requests per window. |
| `worker_poll_interval_ms` | `500` | How often the background worker polls for pending events. |
| `worker_batch_size` | `20` | Max events claimed per worker poll cycle. |
| `worker_max_retries` | `5` | Retries before an event is marked `failed` instead of re-queued. |
| `heatmap_days` | `180` | Window (days) the contribution streak heatmap queries. |

Any of these can be overridden per-run without editing the file — e.g. the rate-limit proof
below uses `-e EVENTS_RATE_LIMIT_TIMES=3` to make the limiter trip in a handful of requests
instead of 60.

---

## Provisioning challenges via the admin API

There is **no admin-promotion API** — by design, the only way to create an admin is a direct
database write (the same pattern `app/scripts/seed.py` itself uses). Here's a full walkthrough,
with real commands verified end-to-end against the running stack.

**1. Register a regular user and an admin:**

```bash
curl -sS -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"rewarduser","email":"rewarduser@example.com","password":"password123"}'

curl -sS -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"rewardadmin","email":"rewardadmin@example.com","password":"password123"}'
```

**2. Promote the second user to admin directly in Postgres:**

```bash
docker compose exec -T db psql -U meritforge -d meritforge \
  -c "UPDATE users SET role='admin' WHERE username='rewardadmin' RETURNING id, username, role;"
```

**3. Log in again as the now-admin user** (the JWT embeds the role, so a token minted before the
promotion is stale — you need a fresh one):

```bash
ADMIN_TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rewardadmin","password":"password123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
```

**4. Create a challenge.** `rule_config` shape depends on `type` (per
[`mind-map/03-data-model-and-engine.md`](./mind-map/03-data-model-and-engine.md)):
`count` → `{"target": N, "window": "total"|"weekly"}`; `streak` → `{"target_days": N}`.
`start_at`/`end_at` (ISO-8601 UTC) are **required** — a challenge only matches events while
`now` falls inside that window.

Count-type example (points reward):

```bash
curl -sS -X POST http://localhost:8000/api/admin/challenges \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Verify Points Reward",
    "description": "Post 3 comments to earn points",
    "type": "count",
    "event_type": "verify_points_evt",
    "rule_config": {"target": 3, "window": "total"},
    "reward": {"type": "points", "amount": 250},
    "start_at": "2026-08-17T00:00:00Z",
    "end_at": "2026-09-16T00:00:00Z"
  }'
```

Streak-type example (badge reward):

```bash
curl -sS -X POST http://localhost:8000/api/admin/challenges \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "3-Day Streak Badge",
    "description": "Be active 3 UTC days in a row",
    "type": "streak",
    "event_type": "contribution",
    "rule_config": {"target_days": 3},
    "reward": {"type": "badge", "badge_code": "verify_badge"},
    "start_at": "2026-08-17T00:00:00Z",
    "end_at": "2026-09-16T00:00:00Z"
  }'
```

Both are created in `draft` status. Capture the `id` from each response, then activate:

```bash
curl -sS -X PATCH http://localhost:8000/api/admin/challenges/$CHALLENGE_ID \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"status":"active"}'
```

---

## Triggering and verifying the full flow

This reuses the exact working proof from the P7 stack-hardening verification pass (real events,
real worker, real Postgres — no synchronous seed-drain shortcuts).

**1. Log in as the regular user, then emit events with unique `event_id`s:**

```bash
TOKEN=$(curl -sS -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rewarduser","password":"password123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

for i in 1 2 3; do
  EID=$(python3 -c "import uuid; print(uuid.uuid4())")
  curl -sS -X POST http://localhost:8000/api/events \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"event_id\":\"$EID\",\"event_type\":\"verify_points_evt\",\"payload\":{}}" \
    -w "\nHTTP_STATUS:%{http_code}\n"
done
```

Each call returns `202 {"event_id": "...", "status": "pending"}` immediately — ingestion never
waits on evaluation.

**2. Poll for the result** (`GET /api/challenges` shows live per-user progress; the widget/UI
does this automatically every 30s):

```bash
curl -sS http://localhost:8000/api/challenges -H "Authorization: Bearer $TOKEN"
```

**3. Watch the reward land** via the reward ledger once the background worker has processed the
events (real run: landed within one ~500ms poll cycle):

```bash
curl -sS http://localhost:8000/api/users/me/rewards -H "Authorization: Bearer $TOKEN"
```

Real output from this exact flow (3× `verify_points_evt` + 2× `verify_badge_evt` against two
active challenges):

```json
{
  "items": [
    {"id": "2c65a6b2-...", "challenge_id": "480fa874-...", "challenge_name": "Verify Badge Reward",
     "reward_type": "badge", "amount": null, "badge_code": "verify_badge",
     "created_at": "2026-08-17T10:21:55.147174Z"},
    {"id": "0a62b682-...", "challenge_id": "1c57c600-...", "challenge_name": "Verify Points Reward",
     "reward_type": "points", "amount": 250, "badge_code": null,
     "created_at": "2026-08-17T10:21:54.619345Z"}
  ],
  "page": 1, "limit": 20, "total": 2, "has_next": false
}
```

Both **points** and **badge** rewards were confirmed disbursed by the real, continuously-running
`worker` service (not a synchronous drain), and cross-checked directly against
`reward_ledger`/`events` in Postgres to rule out an API-layer artifact.

**4. Check the leaderboard:**

```bash
curl -sS http://localhost:8000/api/leaderboard -H "Authorization: Bearer $TOKEN"
```

### Bonus proof: rate limiting on `POST /api/events`

The shipped default is 60 requests / 60 seconds per user — deliberately production-shaped, so
it won't trip in normal manual testing. To demonstrate the 429 path without touching the shipped
default, run a disposable second backend instance against the same database with the limit
overridden just for that container:

```bash
docker compose run --rm -d -p 8001:8000 -e EVENTS_RATE_LIMIT_TIMES=3 \
  --name meritforge-ratelimit-test backend \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
TOKEN=$(curl -sS -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"ratelimuser","email":"ratelimuser@example.com","password":"password123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

for i in 1 2 3 4 5; do
  EID=$(python3 -c "import uuid; print(uuid.uuid4())")
  curl -sS -X POST http://localhost:8001/api/events \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d "{\"event_id\":\"$EID\",\"event_type\":\"comment_posted\",\"payload\":{}}" \
    -w "\nHTTP_STATUS:%{http_code}\n"
done
```

Real output — requests 1-3 succeed, 4-5 are rejected:

```
request 1: {"event_id":"49fd50af-...","status":"pending"}          HTTP_STATUS:202
request 2: {"event_id":"e0ecf2b4-...","status":"pending"}          HTTP_STATUS:202
request 3: {"event_id":"ff37bf27-...","status":"pending"}          HTTP_STATUS:202
request 4: {"error":{"code":"RATE_LIMITED","message":"Rate limit exceeded","details":{}}}  HTTP_STATUS:429
request 5: {"error":{"code":"RATE_LIMITED","message":"Rate limit exceeded","details":{}}}  HTTP_STATUS:429
```

The `429` response also carries a `Retry-After` header (`retry-after: 59` in the run above).
Clean up the disposable container afterward: `docker stop meritforge-ratelimit-test && docker rm
-f meritforge-ratelimit-test` — the main stack's `backend` (running the shipped 60/60s default)
is never touched by this.

---

## Design decisions

### Schema shape

The schema splits cleanly along the same forum/engine boundary the architecture enforces (full
detail in [`mind-map/03-data-model-and-engine.md`](./mind-map/03-data-model-and-engine.md)):

- **Forum:** `users`, `posts`, `comments` (self-referencing `parent_comment_id` for nested
  threads), `post_upvotes` (composite `(post_id, user_id)` PK — prevents double-upvoting at the
  schema level, not just in application logic).
- **Engine:** `events` (the job queue itself — see below), `challenges` (pure config: `type` +
  `rule_config` + `reward`), `challenge_progress`, `user_daily_activity` (UTC day buckets, feeds
  both streak evaluation and the heatmap), `user_streaks`, `reward_ledger`.

Two schema choices are worth calling out specifically:

- **`reward_ledger` is append-only and is the source of truth for points** — there is no
  "user.points" counter anywhere to drift out of sync. The leaderboard is a live
  `SUM(amount) ... GROUP BY user_id` over the ledger. This trades a small amount of query cost
  for the guarantee that a user's point total can always be reconstructed/audited from history,
  and it composes naturally with idempotent disbursal (see below) — a ledger row either exists
  once or doesn't exist at all.
- **`challenge_progress` is keyed by `(challenge_id, user_id, period_key)`** rather than just
  `(challenge_id, user_id)`. `period_key` is the current ISO week (e.g. `"2026-W33"`) for weekly
  challenges, or an empty string for one-shot/total challenges. This is what makes the weekly
  reset **implicit**: there's no cron job zeroing out counters on Monday — the moment the ISO
  week rolls over, the next matching event naturally targets a brand-new `challenge_progress`
  row (unique per period), so last week's completed row is simply left behind as history rather
  than reset in place.

### Background jobs: Postgres queue, not Redis/Celery

Async challenge evaluation runs off a **transactional outbox** on the `events` table itself —
there is no separate queue technology. The forum inserts a `pending` event row in the *same*
transaction as the forum write it's reporting (so an event can never be silently lost or
duplicated relative to the write that caused it), then returns `202` immediately. A background
worker claims rows with `SELECT ... FOR UPDATE SKIP LOCKED`, evaluates in one transaction, and
marks the row `processed`.

This is deliberately **not** Redis + Celery (see AD-2). The trade-off: a Postgres-backed queue
doesn't scale to the throughput a dedicated broker would, and it puts more load on the primary
database instead of a purpose-built one. What it buys back: one fewer moving part to run, deploy,
and reason about, and it makes the win condition — "the event is processed and the reward is
disbursed" or "none of that happened" — a single ACID transaction instead of a distributed
coordination problem between an app process and a broker. For an app at this scale, that trade
was judged clearly worth it, and it's a deliberate, defensible divergence from the more common
Celery/Redis default.

### Polling interval: 30 seconds

The frontend polls live challenge/weekly-widget data via SWR's `refreshInterval: 30000` rather
than a websocket/SSE push channel (AD-3). Reward disbursal isn't latency-critical — a user
completing a challenge doesn't need sub-second feedback the way, say, a chat message would — so
a short poll gets "feels live" UX without holding open a persistent connection per browser tab.
30 seconds specifically was chosen as the point where the UI feels responsive to a challenge
completing while keeping steady-state request volume low; SWR's `mutate()` (with
`optimisticData`/`rollbackOnError`) covers the truly interactive moments (posting, commenting)
that can't wait even 30 seconds, so the two mechanisms cover different UX needs rather than one
straining to do both jobs.

### Timezones: UTC everywhere

Every stored timestamp is UTC, and every day-bucketing decision in the engine buckets by **UTC
calendar day**, not the user's local day. Two engine rules lean on this directly:

- **Weekly reset** uses the **ISO week** (Monday 00:00 UTC start) as `period_key` — see the
  `challenge_progress` note above. There's no scheduled job that "resets" anything; the reset is
  a side effect of which `period_key` a new event naturally lands in.
- **Streaks** advance/reset based on UTC-day comparisons against `user_streaks.last_activity_date`:
  the same UTC day again is a no-op (a day counts once no matter how many events land in it), the
  very next UTC day extends the streak by one, any gap (or an out-of-order event older than the
  last counted day) resets to `1`, and `best_streak` tracks the historical max.

### Idempotency (three independent layers)

Because the same forum action must never be double-counted, double-processed, or double-paid,
idempotency is enforced at three separate points rather than relying on one mechanism to cover
everything:

1. **Ingest** — `event_id` is a client-generated, deterministic ID (derived from the action +
   entity, so retries of the exact same forum action produce the exact same `event_id`) and is
   the events table's primary key. Re-submitting the same `event_id` is a no-op: ingestion
   returns the original acknowledgement instead of inserting a second row.
2. **Process** — the worker locks the event row (`FOR UPDATE SKIP LOCKED`) and checks its status
   inside the same transaction that evaluates it; an already-`processed` event is skipped
   immediately. This is what makes "claim + evaluate + disburse + mark processed" safe even if a
   worker crashes mid-transaction and another worker picks the row back up later.
3. **Disburse** — `reward_ledger.disbursal_key` (`"{challenge_id}:{user_id}:{period_key}"`) is
   unique. Completion is claimed atomically first (`UPDATE challenge_progress SET
   completed_at = now() WHERE completed_at IS NULL`, so exactly one transaction "wins" a given
   completion), and the ledger insert's unique constraint is a second, independent backstop —
   a reward for a given challenge/user/period can land at most once even under concurrent
   evaluation.

### Upvote reward semantics: actor-credited, not author-credited

The "Get 5 Upvotes" challenge tracks upvotes a user **casts** (`post_upvoted`, evaluated by the
existing generic `CountEvaluator` — no new engine concept), not upvotes a user's own posts
**receive**. This was a deliberate choice, not an oversight: crediting the post *author* when
their content gets upvoted would require a second, separately-attributed event on the same
`upvote_post` action (see `backend/app/services/forum/posts_service.py`), plus new
idempotency/`event_id` reasoning to keep it consistent with the existing at-most-once guarantees.
Actor-attribution is consistent with how every other event type in the system is already
attributed (the user who performs the action is the user who is credited), ships with zero engine
changes, and is worded unambiguously in the seed data ("cast 5 upvotes") to avoid the wireframe's
more ambiguous "Get 5 upvotes" phrasing. See `mind-map/07-decision-log-open-questions.md` (D17)
for the full write-up.

---

## Deployment (Vercel + Render) — live

- **Frontend:** https://frontend-sigma-sand-38.vercel.app (Vercel, stable production alias)
- **Backend API:** https://meritforge-api.onrender.com (Render)

Both are up and wired together — verified end-to-end against the **public** URLs (not just
locally): registered a user, promoted to admin via direct DB write, created one `count`-type
points challenge and one `count`-type badge challenge, activated both, posted matching events as
a regular user, and watched the live worker turn them `pending → processed` and disburse both a
**points** and a **badge** reward — confirmed via `GET /api/users/me/rewards`, `GET
/api/leaderboard`, and directly against Postgres. CORS was verified with a real preflight request
carrying the exact Vercel origin (`Access-Control-Allow-Origin` echoes it back correctly).

**Why this pairing:** Next.js has no closer fit than Vercel (zero-config App Router/RSC support).
For the backend, Render deploys via a **Git-connected Blueprint** ([`render.yaml`](./render.yaml)
at the repo root — Postgres + one Docker-based web service, mirroring `docker-compose.yml`)
applied through the dashboard rather than a CLI upload.

**Two deploy-time issues came up and are worth knowing about if you redeploy this yourself:**

1. **Railway was the original pick** (see `mind-map/07`'s O3) — architecturally the closer fit,
   with no sleep-on-idle. Its CLI's code-upload got a `403 Forbidden` independent of account,
   billing, or email-verification state (isolated by testing on a second Railway account),
   consistent with a network-level policy blocking that specific upload path in the environment
   this was built in. Render's Blueprint flow is git-connected rather than a CLI upload, so it
   didn't hit the same wall.
2. **Render's Background Worker service type has no free instance type** (starts at $7/mo) — a
   separate worker service defined in an earlier version of `render.yaml` silently never got
   created under the free plan, leaving every ingested event stuck `pending` forever (caught by
   querying the live `events` table directly, not by assuming the deploy worked). Fixed by adding
   an opt-in `RUN_WORKER_INLINE` setting (`backend/app/config/settings.py` + a `lifespan` handler
   in `backend/app/main.py`, default **off**) that runs the same worker loop as a background task
   inside the API process — only `render.yaml` sets it; `docker-compose.yml` never does, so local
   dev keeps the real separate `worker` container exactly as designed. The trade-off: the worker
   only runs while the API process is awake, which on Render's free tier means it sleeps after 15
   minutes idle (~30-50s cold-start wake) alongside the API — acceptable for a review-window demo,
   worth knowing if the URL goes quiet for a while. (Render's free Postgres also expires after a
   time window, same caveat.)

To redeploy from scratch: apply the [`render.yaml`](./render.yaml) Blueprint via Render's
dashboard (**New +** → **Blueprint** → connect the repo → select branch → **Apply**) — Postgres
and the API service (with `DATABASE_URL` auto-wired via `fromDatabase` and `JWT_SECRET`
auto-generated) come up together — then point the Vercel project's `NEXT_PUBLIC_API_URL` at the
resulting `onrender.com` URL (build-time env var — see the [env vars](#environment-variables)
section) and redeploy the frontend.

---

## Known limitations / non-blocking opens

- **Single-process rate limiter.** The per-user fixed-window limiter on `POST /api/events` keeps
  its counters in the `backend` process's memory. This is correct for the single `backend`
  replica this stack runs, but a horizontally-scaled multi-instance deployment would need a
  shared backing store for the limiter to stay accurate across instances — an accepted,
  documented trade-off given the "no Redis/Celery" architectural constraint, not a defect.
- **Worker runs inline on the deployed backend, not as a separate process.** See the
  [deployment section](#deployment-vercel--render---live) above — this only affects the Render
  deploy; `docker-compose.yml`'s real separate `worker` container is unaffected.
