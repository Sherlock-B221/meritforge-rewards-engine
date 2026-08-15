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
