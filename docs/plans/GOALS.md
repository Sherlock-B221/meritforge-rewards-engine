# Phase execution goals (copy one per new session)

Run **one phase per fresh session**, launched inside `meritforge/`. Complete + commit + skim-review
a phase before starting the next. Paste that phase's `/goal` block verbatim.

## Execution recipe (token-lean, quality-kept)
- **Batch, don't atomize.** 2–4 subagents per phase (cohesive chunks with their own tests), not one
  per micro-task. Fewer context loads + fewer reviews = far fewer tokens.
- **Targeted reads.** Each subagent reads only the mind-map files named in its goal + its own chunk
  — never all 10 docs.
- **Model tiering.** Orchestrator on **Opus**. Mechanical chunks (models, schemas, CRUD, migrations,
  boilerplate screens) on **Sonnet**. Correctness-critical logic on **Opus**.
- **Lean plans.** Full `writing-plans` doc **only for P3**. P4–P7 execute from the mind-map + a short
  in-session checklist (no 400-line plan doc).
- **Right-sized TDD.** Full red→green for logic (the engine); for pure CRUD, write test+impl together
  and run once. Deep review only on P3; elsewhere: run tests + skim.
- **Every phase's last step:** update `CLAUDE.md` "Current status" + `mind-map/07` session log, then
  commit. Build only from `mind-map/` + the plan — never reference any external project.

**Status:** ✅ P1 done · ✅ P2 done · ▶️ next: P3.

---

## P3 — Engine evaluation core ⭐ (full rigor — spend here)

```
/goal Write docs/plans/2026-08-16-03-engine-core.md via superpowers:writing-plans (from
mind-map/01,02,03,08 only), then execute it via superpowers:subagent-driven-development in 4
batched subagents with DEEP per-chunk review:
  (a) [Sonnet] Event/Challenge/ChallengeProgress/UserDailyActivity/UserStreak/RewardLedger models
      + migration + engine schemas (count/streak rule configs, points/badge rewards).
  (b) [Opus] ingestion endpoint (202, idempotent on event_id, rate-limited) + the Postgres-queue
      worker (SELECT … FOR UPDATE SKIP LOCKED).
  (c) [Opus] evaluators count+streak + registry + streaks/periods (UTC, ISO-week).
  (d) [Opus] reward disbursal + handlers registry (unique disbursal_key) + evaluation_service (the
      single all-or-nothing transaction) + UNIT TESTS for streak logic, idempotency, disbursal.
Done = full flow proven by tests (emit event → worker evaluates → progress updates → reward
disbursed AT MOST ONCE); all unit tests + ruff green (via Docker); each chunk committed; CLAUDE.md
status + mind-map/07 updated. Read only mind-map/01,02,03,08. Build only from mind-map/ + the plan;
never reference any external project.
```

## P4 — Engine read/admin APIs + leaderboard + seed (lean)

```
/goal Execute P4 from mind-map/02,03,08 + a short in-session task checklist (NO heavy plan doc), via
superpowers:subagent-driven-development in 2 [Sonnet] subagents, LIGHT review (run tests + skim):
  (a) admin challenge CRUD + lifecycle (draft→active→expired→archived, admin-only 403 guard) +
      GET /challenges + /challenges/weekly (with resets_at).
  (b) GET /users/me/{progress,streaks,rewards} (streaks shaped for the heatmap; rewards paginated) +
      GET /leaderboard (SUM points, paginated) + a seed script (demo users/admin/challenges/posts
      matching the wireframes).
Done = every engine endpoint matches mind-map/02; seed runs; pytest + ruff green (Docker); each
chunk committed; CLAUDE.md status + mind-map/07 updated. Read only mind-map/02,03,08. Build only
from mind-map/ + the checklist; never reference any external project.
```

## P5 — Frontend foundation (lean)

```
/goal Execute P5 from mind-map/02,04,09 + a short in-session checklist (NO heavy plan doc), via
superpowers:subagent-driven-development in 2 [Sonnet] subagents, LIGHT review, strict TS (no `any`):
  (a) Next.js + Tailwind + shadcn/base-ui + SWR scaffold (+ frontend Dockerfile & compose `web`
      service); single API client (one base URL) with token attach + 401→login + error→typed
      AppError mapping; auth store.
  (b) login/register screens; the (app) shell layout (sidebar + right rail); feedback primitives
      (Skeletons, SectionBoundary error boundary); useUrlState + useCountdown hooks; the persistent
      WeeklyChallengeWidget polling every 30s.
Done = auth flow + shell + weekly widget work against the API; screens-pattern + index.ts barrels
per mind-map/09; logic-in-hooks; typecheck + lint green; each chunk committed; CLAUDE.md status
updated. Read only mind-map/02,04,09. Build only from mind-map/ + the checklist; never reference any
external project.
```

## P6 — Frontend pages + graded behaviors (mixed models)

```
/goal Execute P6 from mind-map/02,04,09 + a short in-session checklist (NO heavy plan doc), via
superpowers:subagent-driven-development in 4 batched subagents; REVIEW the behavior-heavy chunks
(a,c) carefully, light review on (b,d):
  (a) [Opus] Feed — latest/trending, search, pagination, URL-encoded shareable state + back-button,
      skeleton rows, OPTIMISTIC new-post with rollback + toast.
  (b) [Sonnet] Post Detail (nested comments, owner-only mark-solution, OPTIMISTIC comment) + Create
      Post.
  (c) [Opus] Challenges — 30s polling, progress RINGS + streak HEATMAP via shadcn Charts/Recharts,
      error boundaries, skeletons.
  (d) [Sonnet] Profile (points, badges, paginated reward ledger) + Leaderboard.
Done = all 5 pages + EVERY required behavior (optimistic UI, polling, URL state, skeletons, error
boundaries, ≥1 single-responsibility custom hook, charting-lib viz) work end-to-end; no `any`;
typecheck + lint green; each chunk committed; CLAUDE.md status updated. Read only mind-map/02,04,09.
Build only from mind-map/ + the checklist; never reference any external project.
```

## P7 — Integration, docs, deploy (lean, mostly Sonnet)

```
/goal Execute P7 from mind-map/02,03,05,06,07 + a short in-session checklist (NO heavy plan doc), via
superpowers:subagent-driven-development in 3 [Sonnet] subagents, LIGHT review:
  (a) complete docker-compose (db + api + worker + web) so `docker compose up` runs the full stack;
      verify the rate-limit + multiple-reward-type bonuses actually work.
  (b) README — overview + implemented features, setup + ALL env vars (.env.example), how to
      provision challenges via the admin API, how to trigger + verify the full flow, and design
      decisions (DB schema rationale, background-job impl + why, polling interval + why, timezone
      handling, idempotency) — sourced from mind-map/03,05,07.
  (c) deploy to a public URL (Vercel + a Postgres-friendly API host) OR record a 3–5 min walkthrough.
Done = full stack runs via `docker compose up`; README complete; deployed URL or video; final
commit; CLAUDE.md status → "shipped". Read only mind-map/02,03,05,06,07. Build only from mind-map/ +
the checklist; never reference any external project.
```
