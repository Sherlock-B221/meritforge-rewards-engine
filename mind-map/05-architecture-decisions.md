# 05 · Architecture decisions (our originality)

The brief **mandates the stack** (FastAPI · Next.js/TS/Tailwind · PostgreSQL · JWT role-based ·
shadcn/base-ui). So originality comes from **architecture & patterns within that stack**, not from
swapping technologies. These are the choices that make meritforge *ours* — each is a deliberate,
defensible decision we can explain in the live review.

> The **exact folder layout** (FE + BE) is now designed per the user's stated rules in
> `08-backend-structure.md` + `09-frontend-structure.md`. This file records direction + rationale.

---

## AD-1 · Backend = modular monolith (not microservices)
**Decision:** one FastAPI application; `auth`, `forum`, and `engine` are **strictly-bounded
internal domains** (separate packages) communicating through an **in-process event bus** +
narrow internal interfaces. One deployable, one Postgres.

**Why:** the brief requires the engine to be *decoupled from the forum* — that's a **logical**
boundary, not necessarily a network one. A modular monolith enforces the boundary via module
seams while being dramatically simpler to run, test, and deploy in a 5-day window. We keep the
door open to extraction later (domains don't import each other's internals).

**Rule:** the `engine` domain must never import forum models/logic — it consumes events and
exposes challenge/progress/reward APIs only.

## AD-2 · Async evaluation = Postgres-backed job queue (no Redis/Celery)
**Decision:** the `events` table **is** the durable queue. Ingestion inserts a `pending` row and
returns `202`. A worker loop claims work with `SELECT … FOR UPDATE SKIP LOCKED` (optionally woken
by `LISTEN/NOTIFY` for low latency), evaluates in one transaction, marks `processed`.

**Why:** removes an entire moving part (no Redis/broker to run or deploy), gives us
transactional exactly-once processing for free (claim + evaluate + disburse commit together), and
is a strong "explain your choice" story. Retries = leave the row `pending`/`failed` and re-claim
with backoff.

**Trade-off noted:** Postgres queues don't scale to millions/sec like a dedicated broker — fine
here, and we document the trade-off.

## AD-3 · Frontend data layer = SWR (not the heavier query stack)
**Decision:** **SWR** for all data fetching. `refreshInterval: 30000` expresses the required
polling declaratively; `mutate()` (with `optimisticData` + `rollbackOnError`) expresses optimistic
post/comment creation and rollback cleanly.

**Why:** lighter, less ceremony for this app's needs, and a clean idiomatic fit for both graded
behaviors (polling + optimistic UI) in one primitive.

## AD-4 · Data-viz = Recharts (proposed: progress rings)
**Decision:** **Recharts** for the required charting-lib visualization. Proposed: radial
**progress rings** for challenges; optionally a **streak heatmap**. *(Confirm exact viz in FE
design.)*

**Why:** satisfies "must use a charting library; component-lib bars don't qualify," is
React-native and Tailwind-friendly, and rings map directly to challenge `current/target`.

## AD-5 · Auth = JWT, role-based, stateless
**Decision:** HS256 JWT issued by the auth domain; verified statelessly by forum/engine.
Bearer token on the client; single 401→login redirect. Roles `user` | `admin`; `@require_admin`
guard on admin endpoints.

**Why:** simplest correct fit for an SPA + decoupled domains; no session store needed.

## AD-6 · One monorepo
**Decision:** single repo with clear `backend/` + `frontend/` (or similar) top-level split.
**Why:** submission is one public repo; simplifies shared docs, `.env.example`s, and CI.

## AD-7 · Idempotency & correctness invariants
Client `event_id` PK (ingest) · locked single-transaction evaluation (process) · unique
`disbursal_key` (reward). UTC everywhere; weekly reset via ISO-week `period_key` (no cron).
See `03-data-model-and-engine.md`.

## AD-8 · Config-driven challenges (registry pattern)
Challenges are pure data (`type` + `rule_config` + `reward`). Evaluators (`count`, `streak`) and
reward handlers (`points`, `badge`) are registered by key so new types plug in without touching
ingestion, the forum, or existing challenges.

## AD-9 · SSR / SEO-ready frontend
Public pages render as **React Server Components** with `generateMetadata` + `sitemap`/`robots`
(fast, crawlable, indexable HTML — server-side data fetch, no client round-trip). Authenticated,
highly-interactive pages hydrate as client components using SWR (polling + optimistic). We design
this in from day one (a bonus + a clean divergence from a fully client-rendered app).
**Scope (D15/O7 = public reads / auth writes):** feed + thread detail are public + SSR; all writes
and engine/challenge/reward/leaderboard endpoints stay auth-gated.

## AD-10 · Layered monolith structure
Backend: **controllers → services → models**, with parallel `schemas/` (types), `constants/`,
`config/`, `core/`. Frontend: **screens pattern** (routing-only `app/`, `screens/<Name>/` with
Screen + `useScreen` + constants + types + local components + barrels), logic-in-hooks. See
`08-backend-structure.md` + `09-frontend-structure.md`.

---

## Originality at a glance (what makes it distinct)
Modular monolith (vs microservices) · **Postgres-native async queue + transactional outbox (vs
Celery/Redis)** · **layered controllers/services/models** (vs logic-in-routers) · **SSR/SEO-ready
RSC** (vs fully-CSR) · **screens pattern + barrels** · SWR (vs a heavier query lib) · Recharts
rings (vs a calendar-heatmap lib) — same mandated stack, a materially different architecture, all
decisions we can defend line-by-line.

## Still open (see `07-decision-log-open-questions.md`)
Non-blocking: deployment target (Vercel FE + a Postgres-friendly API host — Railway/Render/Fly) ·
rich-text editor/format · trending formula. Folder layout (`08`+`09`), SEO scope (D15), and
data-viz (D16) are settled.
