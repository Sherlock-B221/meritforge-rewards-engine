# meritforge — project context

**meritforge** is a full-stack app: a **Developer Community Forum** (frontend) wired to a
decoupled **Challenge & Rewards Engine** (backend). Users browse/create threads, comment,
mark solutions, and earn points/badges through data-driven challenges the engine evaluates
asynchronously.

This is an **original, independent implementation** built first-principles from the assignment
brief. Everything we need is captured under [`mind-map/`](./mind-map/) — read it at the start of
every session instead of re-deriving context.

---

## Read first — the mind-map (persistent context store)

| File | What's in it |
| --- | --- |
| [`mind-map/00-overview.md`](./mind-map/00-overview.md) | The 30-second picture + how these docs fit together (index) |
| [`mind-map/01-backend-requirements.md`](./mind-map/01-backend-requirements.md) | Part A — engine: auth/roles, challenge config, event ingestion, async evaluation, rewards |
| [`mind-map/02-api-contract.md`](./mind-map/02-api-contract.md) | Every endpoint (method/path/auth/notes) + error-envelope shape |
| [`mind-map/03-data-model-and-engine.md`](./mind-map/03-data-model-and-engine.md) | Proposed schema + the engine's evaluation/idempotency/streak/reward semantics |
| [`mind-map/04-frontend-ux.md`](./mind-map/04-frontend-ux.md) | The 5 pages, the weekly-challenge widget, and every graded cross-cutting behavior |
| [`mind-map/05-architecture-decisions.md`](./mind-map/05-architecture-decisions.md) | **Our** architecture + the rationale that makes it original |
| [`mind-map/06-evaluation-rubric.md`](./mind-map/06-evaluation-rubric.md) | Scoring weights + a bonus checklist — what we optimize for |
| [`mind-map/07-decision-log-open-questions.md`](./mind-map/07-decision-log-open-questions.md) | Decisions made, and what's still open |
| [`mind-map/08-backend-structure.md`](./mind-map/08-backend-structure.md) | Monolith layout: controllers/services/models split, config-file, constants, exception strategy |
| [`mind-map/09-frontend-structure.md`](./mind-map/09-frontend-structure.md) | App Router screens pattern, SSR/SEO-ready, SWR, barrels |

---

## Hard rules / invariants (do not violate)

1. **Stack is mandated by the brief** — do not swap it: Python + **FastAPI** · TypeScript +
   **Next.js** + **Tailwind** · **PostgreSQL** · **JWT, role-based** auth · **shadcn / base-ui**.
2. **Our architecture** (see `05-architecture-decisions.md`, `08-…`, `09-…`):
   - Backend = **modular monolith** (single FastAPI app; `auth` / `forum` / `engine` as
     strictly-bounded internal domains). The engine stays decoupled from the forum — it knows only
     events, challenges, progress, rewards. Layered **controllers → services → models**, with
     parallel `schemas/` (types), `constants/`, `config/`, `core/`. **Config-file-driven**
     (`config/defaults.toml` + env); constants never inlined; exceptions via one `AppError`
     hierarchy → one envelope.
   - Async challenge evaluation = **Postgres-backed job queue** (transactional outbox on the
     `events` table + a worker using `SELECT … FOR UPDATE SKIP LOCKED`). **No Redis / Celery.**
   - Frontend = **screens pattern** (routing-only `app/`; `screens/<Name>/` = Screen + `useScreen`
     + constants + types + local components + `index.ts` barrels; logic in hooks; promote to
     shared only on 2nd use). **SSR/SEO-ready**: public pages = RSC + `generateMetadata`;
     authenticated pages = client + **SWR** (`refreshInterval` polling + optimistic `mutate`).
     Data-viz via **Recharts**. Single API client (one base URL).
   - Single **monorepo**; submission is one public GitHub repo.
3. **Originality** — keep the design ours, derived from the requirements in `mind-map/`. Do not
   model our structure, naming, or schema on any other implementation.
4. **Every graded cross-cutting behavior must ship**: optimistic UI (post + comment), 30s
   polling, URL-encoded feed state (shareable + back-button), skeletons (no spinners), error
   boundaries on every fetch surface, ≥1 single-responsibility custom hook, persistent weekly
   widget resetting Monday, and a real charting-lib visualization.
5. **The core flow must work end-to-end**: forum action → event emitted (idempotent `event_id`,
   `202`) → background job evaluates → progress updates → reward disbursed at-most-once → UI
   reflects it via polling.

---

## Current status

- ✅ Requirements, API contract, data model, UX, and engine semantics captured in `mind-map/`.
- ✅ Architecture directions chosen (see rules above).
- ✅ **FE + BE folder structures designed** → `08-backend-structure.md`, `09-frontend-structure.md`.
- ✅ **O7 resolved (D15): all forum reads require auth** (brief-literal); SSR/SEO on landing + auth
  pages only (architecture stays SSR-ready). **O2 resolved (D16):** Recharts rings + streak heatmap.
- ✅ **P3 (engine core) done:** ingestion (202/idempotent/rate-limited), durable Postgres-queue
  worker (FOR UPDATE SKIP LOCKED), count+streak evaluators + registry, UTC/ISO-week periods,
  streak logic, at-most-once reward disbursal, single all-or-nothing evaluation transaction. Full
  flow proven by tests.
- ✅ **P4 (engine read/admin APIs + leaderboard + seed) done:** admin challenge CRUD + lifecycle,
  `GET /challenges` + `/challenges/weekly`, `GET /users/me/{progress,streaks,rewards}`,
  `GET /leaderboard` (ranked over the reward ledger), and `app/scripts/seed.py` (demo users,
  challenges, forum activity, drained through the real worker). Fixed a pre-existing enum
  binding bug (`values_callable`) uncovered while running the seed against a real migrated DB.
- ✅ **P5 (frontend foundation) done:** Next.js/Tailwind/shadcn(Base UI)/SWR scaffold, typed API
  client + `AppError`, Zustand auth store (localStorage-persisted), Login/Register screens (screens
  pattern), the authenticated `(app)` shell (`Sidebar` + `RightRail`, auth-gated via
  `useRequireAuth`), feedback primitives (`Skeletons`, `SectionBoundary` on `react-error-boundary`),
  `useUrlState`/`useCountdown` hooks, and the persistent `WeeklyChallengeWidget` (30s polling via
  `GET /challenges/weekly`, graceful "no active challenge" + error-boundary degradation). Verified
  end-to-end against the real API + Postgres (register → shell → live widget data → refresh keeps
  session → unauth redirect). `docker compose build web` green.
- ✅ **P6 (frontend pages) done:** all 5 pages + Leaderboard on the screens pattern — **Feed**
  (`/feed`, latest/trending/search/pagination in URL-encoded shareable state, skeleton rows,
  optimistic new-post via shared `useCreatePost` + rollback + toast), **Post Detail**
  (`/posts/[id]`, nested comments, owner-only mark-solution, optimistic comment), **Create Post**
  (`/posts/new`, tag chips + toolbar, optimistic publish), **Challenges** (`/challenges`, 30s
  polling, **Recharts** progress rings + streak heatmap [recharts@3.10.1 pinned], per-section error
  boundaries), **Profile** (`/u/[username]`, points/badges/paginated reward ledger composed from
  `me()`+leaderboard+streaks+rewards) and **Leaderboard** (`/leaderboard`, paginated, self-row
  highlight). Every graded behavior ships (optimistic UI, 30s polling, URL feed state, skeletons
  not spinners, `SectionBoundary` on all 8 fetch surfaces, 10 single-responsibility hooks,
  charting-lib viz). FE never emits `/events` (backend forum layer emits engine events
  server-side). No `any`; `npm run typecheck` + `lint` + `build` all green (all 11 routes compile).
- ✅ **P7 (ship) done:** hardened `docker-compose.yml` so a clean-slate `docker compose up` runs
  the full stack (db + backend + worker + web) with zero manual steps — `backend` now runs
  `alembic upgrade head` on startup and exposes an `/api/health` healthcheck; `worker` and `web`
  gate on `backend: service_healthy` instead of "container started." Proved the two bonuses live
  against the real running stack (not unit tests): rate limiting on `POST /api/events` returns
  `429`/`RATE_LIMITED` once a user exceeds the configured window, and both **points** and **badge**
  reward types are disbursed end-to-end by the real, continuously-running `worker`. Added a
  comprehensive root [`README.md`](./README.md) — overview, implemented features, Docker + local
  setup, every env var (`.env.example` × 2 plus the `defaults.toml`/env-override split), an admin
  API challenge-provisioning walkthrough (count + streak shapes), a full trigger-and-verify-the-flow
  walkthrough reusing the real verified commands/output above, and the design-decisions writeup
  (schema rationale, Postgres-queue-vs-Redis/Celery trade-off, 30s polling rationale, UTC/ISO-week
  handling, three-layer idempotency) sourced from `mind-map/03,05,07`.
- ✅ **Deployed and verified live:** frontend on Vercel
  (https://frontend-sigma-sand-38.vercel.app), backend API on Render
  (https://meritforge-api.onrender.com), wired together and verified end-to-end against the
  **public** URLs — register → promote to admin → provision a points challenge + a badge
  challenge → emit events → live worker disburses both reward types → confirmed via
  `/api/users/me/rewards`, `/api/leaderboard`, and direct Postgres checks. CORS verified with a
  real preflight from the exact Vercel origin. Two real deploy-time issues surfaced and got fixed
  along the way (see [`README.md`](./README.md#deployment-vercel--render---live)): Railway's CLI
  upload was blocked by network policy in the build environment (pivoted to Render's
  git-connected Blueprint); Render's Background Worker has no free instance type, so the worker
  now runs inline in the API process on Render only (`RUN_WORKER_INLINE`, off by default —
  `docker-compose.yml`'s real separate worker container is untouched).
- ⬜ Other remaining opens are non-blocking (rich-text editor, trending formula).

## Plans

Implementation is planned in phases under [`docs/plans/`](./docs/plans/):
- [`2026-08-16-meritforge-roadmap.md`](./docs/plans/2026-08-16-meritforge-roadmap.md) — the 7-phase roadmap (P1–P7), deliverables + dependencies.
- [`GOALS.md`](./docs/plans/GOALS.md) — **copy-paste `/goal` per phase** + the token-lean execution recipe (batch subagents, targeted reads, model tiering, lean-plan-except-P3). **Start here each new session.**
- [`2026-08-16-01-backend-foundation.md`](./docs/plans/2026-08-16-01-backend-foundation.md) — P1 detailed TDD plan.

**Progress:** ✅ P1 done · ✅ P2 done · ✅ P3 done · ✅ P4 done · ✅ P5 done · ✅ P6 done · ✅ **P7
done — shipped** (deployed + verified live, see above).

_Last updated: 2026-08-18_
