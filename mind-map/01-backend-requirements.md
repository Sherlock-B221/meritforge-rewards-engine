# 01 · Backend requirements (Part A — Challenge & Rewards Engine)

Functional spec for the engine. The engine is **decoupled** from the forum: it knows only about
events, challenges, progress, and rewards. Base path for all endpoints: `/api`.

---

## 1. Authentication & roles

- `register` and `login` return a **JWT** (role-based). `me` returns the current user + role.
- Two roles: **`user`** and **`admin`**.
- **All non-auth endpoints require authentication.**
- **Admin endpoints return `403` for non-admin** callers.

## 2. Challenge configuration (data-driven)

Challenges are **data-driven** — *no hardcoded logic per challenge type*. An admin creates a
challenge by POSTing a config object; the engine evaluates every challenge generically from that
config.

**Required config fields:** `name`, `description`, `type`, `rule_config`, `event_type`,
`start_at`, `end_at`, `reward`.

**Challenge types (support at least these two):**
- **Count-based** — complete `event_type` a total of **N** times within the window.
- **Streak-based** — complete `event_type` on **N consecutive days**.

**Lifecycle:** `draft → active → expired → archived`.
- `draft` — created, not yet evaluated against events.
- `active` — live; matches incoming events within `[start_at, end_at)`.
- `expired` — time window passed.
- `archived` — retired by admin (DELETE archives; it does not hard-delete).

**Validation:** validate all inputs; handle missing/optional fields with sensible defaults.
`rule_config` shape is validated per `type` (e.g. count → target/window; streak → target days).

## 3. Event ingestion & evaluation

- **All forum actions are emitted as events** through a **single ingestion endpoint**.
- Every event carries a **client-generated `event_id`**. **Re-submitting the same `event_id`
  returns the original response without reprocessing** (idempotency).
- **Evaluation is asynchronous** — a background job, *not* synchronous on ingestion. The endpoint
  returns **`202 Accepted`** immediately.
- We must **document how the background job works and why** we chose it. (Our choice: a
  Postgres-backed queue — see `05-architecture-decisions.md`.)

**Event types emitted by the forum** (from the API contract):
`post_created`, `post_viewed`, `comment_posted`, `solution_marked`.
(We may add more, e.g. `post_upvoted`, to power richer challenges — see data model.)

## 4. Rewards

- A challenge **grants a reward on completion**.
- **Disbursal is idempotent** — a challenge rewards a user **at most once per qualifying
  completion**.
- Maintain a **per-user reward ledger** recording: **reward type, amount, source challenge,
  timestamp**.
- Support **at least one** reward type. **Multiple types (points, badges) are in scope** (bonus)
  with distinct disbursal handling.

## 5. Cross-cutting engine invariants (design intent)

- **Idempotency at every layer** — client `event_id` as a natural key on ingest; a single
  all-or-nothing transaction per event; a unique disbursal key so a reward lands at most once.
- **Async, durable evaluation** — an event accepted (`202`) is guaranteed to be evaluated
  eventually, surviving worker restarts (durable queue in Postgres).
- **Time is UTC everywhere** — streak "days" are UTC buckets; weekly windows key off ISO weeks;
  weekly reset is implicit via the period key (no cron needed).
- **Config-driven extensibility** — adding a new challenge type or reward type should not require
  changing event ingestion or the forum; a new evaluator/reward-handler plugs into a registry.

## 6. Documentation obligations (graded — 10%)

The README must cover: project overview + implemented features; setup + all env vars
(`.env.example`); how to provision challenges via the admin API; how to trigger + verify the full
flow (emit event → job evaluates → progress updates → reward disbursed); and design decisions for
**DB schema rationale, background-job implementation, polling interval choice, timezone handling,
idempotency approach**.

## 7. Bonus (all in scope)

Unit tests (streak / idempotency / disbursal) · leaderboard endpoint · rate limiting on
`/api/events` · multiple reward types with distinct handling · deployment.
