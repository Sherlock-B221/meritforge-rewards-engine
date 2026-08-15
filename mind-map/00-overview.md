# 00 · Overview & index

## What meritforge is

A **Developer Community Forum** ("Vultr Developer Community") backed by a **decoupled Challenge &
Rewards Engine**. Developers ask/answer questions in threads, upvote, and mark solutions. Every
meaningful action emits an **event**. The engine ingests events, evaluates **data-driven
challenges** asynchronously, tracks **per-user progress + streaks**, and disburses **rewards**
(points, badges) into an append-only **ledger**. The forum surfaces all of this — a persistent
weekly-challenge widget, a challenges/progress page, a profile/rewards page, and (bonus) a
leaderboard.

The engine is **decoupled**: it knows only about events, challenges, progress, and rewards — never
about forum domain concepts. The forum emits events into it and reads results back out.

## The two parts

- **Part A — Challenge & Rewards Engine (backend):** auth + roles, data-driven challenge config,
  idempotent event ingestion, **async** evaluation, idempotent reward disbursal + ledger,
  progress/streaks/leaderboard. See `01-backend-requirements.md`, `02-api-contract.md`,
  `03-data-model-and-engine.md`.
- **Part B — Consumer Frontend:** 5 pages + a persistent weekly widget, with a strict set of
  graded interaction behaviors (optimistic UI, polling, URL state, skeletons, error boundaries,
  a custom hook, a real charting-lib viz). See `04-frontend-ux.md`.

## Feature list (what we're implementing — core + all bonuses)

**Core**
- Register / login / me — JWT, role-based (`user`, `admin`).
- Forum: paginated feed (latest/trending), create thread, thread detail with nested comments,
  mark-as-solution (owner only). Each action emits an event.
- Event ingestion endpoint — idempotent on `event_id`, returns `202`, async evaluation.
- Data-driven challenges — count-based + streak-based, lifecycle draft→active→expired→archived.
- Async background job evaluates challenges and updates progress.
- Idempotent reward disbursal + per-user reward ledger.
- Progress + streaks endpoints; weekly challenge with Monday reset.
- Frontend: all 5 pages + weekly widget + every required behavior.

**Bonus (all in scope)**
- Leaderboard endpoint + page (ranked by total points, paginated).
- Rate limiting on `/api/events`.
- Multiple reward types (points **and** badges) with distinct handling.
- Unit tests (streak logic, idempotency, reward disbursal).
- Deployment to a public URL.

## How the mind-map fits together

```
00-overview ............ you are here (index)
01-backend-requirements  Part A functional spec (the "what" for the engine)
02-api-contract ........ the exact HTTP surface both sides agree on
03-data-model-and-engine the schema + the engine's algorithms/invariants
04-frontend-ux ......... Part B: pages, widget, graded behaviors, wireframe notes
05-architecture-decisions our stack-within-constraints choices + why (originality)
06-evaluation-rubric ... how it's graded — keep this in view while building
07-decision-log ........ decisions made + open questions
08-backend-structure ... monolith layout: controllers/services/models, config, constants, exceptions
09-frontend-structure .. App Router screens pattern, SSR/SEO, SWR, barrels
```

## Non-negotiables (quick reference)

- Mandated stack: FastAPI · Next.js/TS/Tailwind · PostgreSQL · JWT role-based · shadcn/base-ui.
- Evaluation is **async** (job), ingestion returns **202**, `event_id` is **idempotent**.
- Reward disbursal is **at-most-once** per qualifying completion.
- Weekly challenge **resets Monday**; all timestamps **UTC**.
- Deadline: **Day 5** from assignment date. Submission: one public repo, `.env.example` for the
  service(s), deployed URL preferred (else a 3–5 min walkthrough).
