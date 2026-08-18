# 07 · Decision log & open questions

## Decisions made (2026-08-15)

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Project name = **meritforge** | Merit (points/reputation) + forge (earning). Ours, not tied to any reference. |
| D2 | Backend = **modular monolith** (one FastAPI app; auth/forum/engine bounded domains + in-process event bus) | Logical decoupling without microservice overhead; easy to run/deploy in 5 days. `AD-1` |
| D3 | Async evaluation = **Postgres-backed queue** (`FOR UPDATE SKIP LOCKED`, no Redis/Celery) | One fewer service; transactional exactly-once; strong "explain your choice" story. `AD-2` |
| D4 | Scope = **core + all bonuses** (leaderboard, rate limiting, points+badges, tests, deploy) | Maximize score + live-review signal. |
| D5 | Auth = **JWT, role-based, stateless** | Mandated (JWT-or-session); simplest fit for SPA + decoupled domains. `AD-5` |
| D6 | **Single monorepo** | Submission is one public repo. `AD-6` |
| D7 | FE data layer = **SWR** | `refreshInterval` = polling; `mutate` = optimistic UI + rollback in one primitive. `AD-3` |
| D8 | Data-viz = **Recharts** (proposed: progress rings) | Satisfies charting-lib requirement; rings map to current/target. `AD-4` |
| D9 | Backend **layering = controllers → services → models**, with parallel `schemas/` (types), `constants/`, `config/`, `core/` | Literal "models/controllers split" + a service layer for non-redundant, testable logic. `08-backend-structure.md` |
| D10 | **Config-file-driven** — committed `config/defaults.toml` (non-secret tunables) + env overrides for secrets/per-env | "Obvious things come from a config file," not scattered magic values. Divergence from env-only. `08` |
| D11 | Decoupled engine seam = **transactional outbox** (forum writes an `events` row in the same tx; worker consumes via `FOR UPDATE SKIP LOCKED`) | Monolith-appropriate decoupling; no HTTP self-call, no lost/phantom events. `AD-1`,`AD-2`,`08` |
| D12 | FE **screens pattern** — routing-only `app/`, `screens/<Name>/` (Screen + useScreen + constants + types + local components + barrels), logic-in-hooks, promote-on-2nd-use | Matches the provided discipline; clean separation for the 25% code-quality bar. `09-frontend-structure.md` |
| D13 | **SSR / SEO-ready** — public pages = RSC + `generateMetadata` (+ sitemap/robots); authenticated interactive pages = client + SWR | SEO-ready "since the beginning" (bonus); big divergence from a fully-CSR app. `AD-9`,`09` |
| D14 | **Single FE API client** (monolith = one base URL) + minimal auth store; SWR owns server cache | Simpler than multi-client; non-redundant. `09` |
| D15 | **All forum reads require auth** (brief-literal) | User chose strict compliance over public-read SEO. SSR/SEO applies to landing + login/register only; architecture stays SSR-ready. Resolves O7. `AD-9`,`02` |
| D16 | **Data-viz = Recharts progress rings + contribution streak heatmap** (both) | Faithful to wireframe; rings show challenge progress, heatmap shows streak. Resolves O2. `04` |
| D17 | **Upvote-challenge semantics = actor-credited** ("Get 5 Upvotes" tracks upvotes *cast* by the user, via `post_upvoted` on the existing `CountEvaluator` — unchanged from how every other event type is attributed) rather than author-credited (crediting the post author when *their* content is upvoted) | Author-attribution would need a second, differently-attributed event on the same action plus new idempotency/`event_id` reasoning (`posts_service.py:upvote_post`) — real scope, not a config tweak. The wireframe's "Get 5 upvotes (2/5)" copy is ambiguous between the two readings; actor-credited ships today with zero engine changes and is worded unambiguously ("cast 5 upvotes"). Documented as a deliberate scope choice, not an oversight. |

**Seed-data scaling (documented alongside D17, not a numbered decision):** the wireframes show
illustrative upvote counts in the tens (▲48) and hero point totals in the thousands. With upvotes
unique per `(post, user)` and only 7 demo personas, per-post upvotes cap out in the single digits;
similarly there aren't enough distinct challenges to organically accumulate thousands of points.
`backend/app/scripts/seed.py` reproduces the *shape* of the wireframe data (ordered upvote counts
across the 4 threads, a mixed points+badge reward ledger, ria solidly mid-pack on the leaderboard
rather than an inflated #1) at a scale the real event-driven engine can organically produce,
rather than padding the roster with throwaway accounts purely to hit specific numbers.

## Open questions / to decide

| # | Question | Owner | Notes |
| --- | --- | --- | --- |
| ~~O1~~ | ~~Exact FE + BE folder layout~~ | — | **RESOLVED** — designed in `08-backend-structure.md` + `09-frontend-structure.md` (D9–D14). |
| ~~O7~~ | ~~SEO scope: how public is the forum?~~ | — | **RESOLVED (D15)** — all forum reads require auth (brief-literal); SSR/SEO on landing + auth pages only. |
| ~~O2~~ | ~~Final data-viz pick~~ | — | **RESOLVED (D16)** — Recharts progress rings + contribution streak heatmap (both). |
| O3 | Deployment target | User + me | Likely Vercel (FE) + a Postgres-friendly API host (Railway/Render/Fly). Postgres-queue choice keeps infra minimal (no Redis). |
| O5 | Rich-text body: which editor/format? | me | Wireframe shows a rich toolbar. Decide markdown vs a lightweight editor; store as text/markdown. |
| O6 | Trending formula | me | Define + document (e.g. weighted upvotes+comments decayed by age). Knobs live in `config/defaults.toml`. |

## Assumptions (document these in the final README)
- Forum emits events **server-side** with deterministic `event_id`s so the same action can't
  double-count; end users cannot emit events attributed to others.
- Weekly window = **ISO week**, reset implicitly Monday 00:00 **UTC** via `period_key`.
- Reward ledger is the **source of truth** for points; leaderboard is a `SUM` over it.

## Session log
- **2026-08-15** — Captured full requirements (brief + wireframes), chose architecture directions
  (D1–D8), created `mind-map/` + `CLAUDE.md`.
- **2026-08-15 (cont.)** — Designed BE + FE folder structures (D9–D14) → `08-backend-structure.md`,
  `09-frontend-structure.md`. Resolved O1, O2 (D16: rings + heatmap). Remaining opens (O3 deploy,
  O5 rich-text, O6 trending) are non-blocking.
- **2026-08-16** — User reviewed decisions: **reversed D15 to "all forum reads require auth"**
  (dropped public-read SEO; SSR/SEO now landing + auth pages only), confirmed the services layer
  (D9) and D16 (rings + heatmap). Proceeding to the implementation plan.
- **2026-08-16 (P3 — engine core)** — Built the async pipeline end-to-end; decisions made while
  shipping:
  - Worker claims **one event per transaction** via `SELECT … FOR UPDATE SKIP LOCKED`
    (per-event atomicity; multiple workers are safe; each event's session is independent).
  - On evaluation failure: rollback the unit + `retry_count += 1`; mark `failed` once
    `retry_count >= worker_max_retries` (config-driven). Within one pass, an attempted id is
    excluded so a retriable event isn't re-hammered — it's retried on the next poll cycle.
  - Contribution streak = synthetic `"contribution"` type aggregating post/comment/solution
    events; challenges may target it directly (`event_type = "contribution"`).
  - Completion claimed via `UPDATE challenge_progress SET completed_at=now WHERE completed_at IS
    NULL … RETURNING id`; reward guarded again by a unique `disbursal_key` =
    `"{challenge}:{user}:{period}"` → at-most-once even under concurrency.
  - `evaluate_event` never commits — the worker commits on success / rolls back on error, so
    activity + streaks + progress + reward + event-status are one all-or-nothing unit.
  - Idempotency at three layers: ingest PK on `event_id` (dup submit is a no-op) → event
    status guard (`PENDING`) → unique `disbursal_key`.
  - UTC days + ISO-week `period_key` (implicit weekly reset Monday 00:00 UTC).
  - Rate limiting on `/api/events`: in-process fixed-window per user (documented single-process
    limitation; a shared store would be needed for multi-instance).
  - Full flow proven by `tests/test_engine_flow.py` (emit → worker → progress → reward
    at-most-once across a second worker pass; ingest dedup; 3-day streak → badge once). Suite
    green (104 tests), ruff clean.
- **2026-08-17 (P4 — engine read/admin APIs + leaderboard + seed)** — Shipped the remaining
  engine-facing surface; decisions made while shipping:
  - Admin challenge CRUD + lifecycle transitions, `GET /challenges` + `/challenges/weekly`
    (active-challenge progress reads), and the user-facing `GET /users/me/{progress,streaks,
    rewards}` + `GET /leaderboard` all landed as separate, purpose-built read services
    (`progress_reads.py` for the challenge-list views vs. `progress_service.py` for the
    `/users/me/*` views) rather than one shared module — each serves a distinct response shape.
  - Leaderboard is a `GROUP BY user_id` aggregate straight over `reward_ledger`
    (`SUM(amount) FILTER (WHERE reward_type='points')`, `COUNT(*) FILTER (WHERE
    reward_type='badge')`); it only ranks users with at least one ledger row, consistent with
    the ledger being the sole source of truth for points.
  - Contribution heatmap window is config-driven (`heatmap_days`, default 180) rather than
    hardcoded, matching the `trending_*` knob convention.
  - Found and fixed a **pre-existing bug**: all five Postgres enum-backed columns (`user_role`,
    `event_status`, `challenge_type`, `challenge_status`, `reward_type`) bound SQLAlchemy's
    default `.name` (uppercase) against Alembic-migrated enum types whose labels are lowercase
    (`.value`) — invisible in tests (which build tables via `Base.metadata.create_all`, so both
    sides agreed by construction) but fatal against the real migrated `meritforge` database.
    Fixed with `values_callable=lambda e: [m.value for m in e]` on all five columns.
  - Added `backend/app/scripts/seed.py`: creates an admin + 5 demo users, 4 challenges (one of
    each shape: one-shot count, weekly count, streak), realistic forum activity via the real
    `posts_service`/`comments_service` (so events flow through the normal outbox), then drains
    the queue synchronously with `run_worker_once` so progress/rewards are visible immediately.
  - Suite green (121 tests), ruff clean; seed script verified end-to-end against a fresh
    `meritforge` database.
- **2026-08-18 (assignment-parity remediation)** — Audited the shipped app against the assignment
  bar (`docs/plans/2026-08-18-parity-remediation.md`) and closed the gaps: fixed the weekly-widget
  FE/BE error-code mismatch (`useWeeklyChallenge.ts` now keys off HTTP status, not a code string
  the backend never sends), regenerated a fully-resolved `frontend/package-lock.json` (a clean
  `npm ci`/Docker build was failing), made `seed.py` idempotent and enriched it to the wireframe
  demo-state (D17 + the seed-scaling note above), wired it into `docker-compose.yml` as an
  auto-run one-shot service, wired the upvote endpoint into the FE (feed + post-detail), added a
  "Top this week" right-rail widget, upgraded the first-run/empty-state UX, and replaced the
  grayscale shadcn tokens with a real brand palette.
