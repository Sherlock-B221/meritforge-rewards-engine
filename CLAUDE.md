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
- ⬜ Remaining opens are non-blocking (deploy target, rich-text editor, trending formula).

## Plans

Implementation is planned in phases under [`docs/plans/`](./docs/plans/):
- [`2026-08-16-meritforge-roadmap.md`](./docs/plans/2026-08-16-meritforge-roadmap.md) — the 7-phase roadmap (P1–P7), deliverables + dependencies.
- [`GOALS.md`](./docs/plans/GOALS.md) — **copy-paste `/goal` per phase** + the token-lean execution recipe (batch subagents, targeted reads, model tiering, lean-plan-except-P3). **Start here each new session.**
- [`2026-08-16-01-backend-foundation.md`](./docs/plans/2026-08-16-01-backend-foundation.md) — P1 detailed TDD plan.

**Progress:** ✅ P1 done · ✅ P2 done · ✅ P3 done · ✅ P4 done · ▶️ next **P5**. Run one phase per
fresh session (see `GOALS.md`). Non-blocking opens (deploy target, rich-text editor, trending
formula) get decided as we build.

_Last updated: 2026-08-17_
