# meritforge — implementation roadmap

The build is decomposed into **7 phase-plans**. Each delivers working, independently-testable
software and is executed spec → plan → implementation. This file is the index; each phase gets its
own detailed plan file (`2026-08-16-0N-<name>.md`) written just before it's executed.

**Spec (source of truth):** [`../../mind-map/`](../../mind-map/) — especially `01`, `02`, `03` (BE)
and `04`, `09` (FE), with decisions in `05`/`07` and the rubric in `06`.

## Phases

| # | Plan | Delivers (testable) | Depends on |
| --- | --- | --- | --- |
| **P1** | Backend foundation + auth | Backend scaffold, config-from-file, DB + migrations, error envelope, **auth API** (register/login/me, JWT, roles), test harness | — |
| **P2** | Forum domain | Post/Comment/Upvote models, feed (sort/pagination/trending), thread + nested comments, create, mark-solution (owner-only), **event outbox** (writes `events` rows in-tx) | P1 |
| **P3** | Engine evaluation core ⭐ | Event ingestion (`202`, idempotent, rate-limited), **Postgres-queue worker** (`FOR UPDATE SKIP LOCKED`), count+streak evaluators + registry, streaks/daily-activity, reward disbursal + ledger. **Unit tests: streak / idempotency / disbursal.** The graded end-to-end flow. | P1, P2 |
| **P4** | Engine read + admin APIs | Admin challenge CRUD + lifecycle, user `/challenges` + `/challenges/weekly`, `/users/me/{progress,streaks,rewards}`, `/leaderboard`, seed script | P3 |
| **P5** | Frontend foundation | Next.js + Tailwind + shadcn + SWR scaffold, single API client + error mapping, auth store + login/register, app shell (`(app)` layout), feedback primitives, `useUrlState`/`useCountdown`, weekly-challenge widget (30s poll) | P1 (API) |
| **P6** | Frontend pages + behaviors | Feed, Post Detail, Create Post, Challenges (rings + heatmap via shadcn Charts/Recharts), Profile, Leaderboard — **all graded behaviors** (optimistic UI, polling, URL state, skeletons, error boundaries, custom hook) | P2, P4, P5 |
| **P7** | Integration · docs · deploy | `docker-compose` (postgres + api + worker + web), README (setup, env, challenge provisioning, full-flow verification, design decisions), rate-limit + multi-reward verification, deploy (Vercel + Postgres host) or walkthrough video | P1–P6 |

⭐ = highest-value / highest-risk (the 20% Functionality core). Front-load it.

## Sequencing notes
- **P1 → P2 → P3 → P4** is the backend critical path; the API is fully testable after P4.
- **P5/P6 (frontend)** can start once P1 is up (auth) and firm up as P2/P4 endpoints land. In a
  5-day window, do backend P1–P4 first, then FE P5–P6, then P7.
- Bonuses (leaderboard, rate limiting, multiple reward types, unit tests, deploy) are woven into
  P3/P4/P7 — not a separate phase.
- Commit after every task (incremental history is graded: "clear incremental commit history").

## Rubric mapping (why this order)
- **Functionality 20%** → P3 (+P2 events). **Backend 20%** → P1–P4 (schema + contract match).
- **FE UX 20%** → P5–P6 (every required behavior). **Code Quality 25%** → the layering/structure
  discipline enforced throughout (`08`/`09`). **Docs 10%** → P7. **Bonus 5%** → P3/P4/P7.

---
_Detailed plans live beside this file. Currently written: **P1** (`2026-08-16-01-backend-foundation.md`)._
