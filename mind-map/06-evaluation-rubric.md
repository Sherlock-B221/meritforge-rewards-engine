# 06 · Evaluation rubric (what we optimize for)

Keep this in view during every build decision. The technical review also includes **live tasks
where we extend our own code** — so understanding > volume. Document AI usage honestly.

## Weights

| Category | Weight | What they want |
| --- | --- | --- |
| **Code Quality** | 25% | Clean separation of concerns; meaningful naming; proper TypeScript (**no `any` abuse**). |
| **Frontend UX & Interaction** | 20% | All required behaviors implemented correctly (optimistic, polling, URL state, skeletons, error boundaries, custom hook, data-viz, weekly widget). |
| **Backend Implementation** | 20% | Well-modeled DB schema; **all endpoints match the contract**. |
| **Functionality** | 20% | Full end-to-end flow works: event emitted → job evaluates → progress updates → reward disbursed. |
| **Documentation** | 10% | Setup for the service(s); how to provision challenges + verify the full flow; design decisions explained; assumptions documented. |
| **Bonus** | 5% | Tests, leaderboard page, rate limiting on `/api/events`, multiple reward types, deployment. |

## Highest-leverage priorities (derived)
1. **Make the core loop demonstrably work** (20% Functionality + underpins UX/Backend). A scripted
   demo: register → create challenge (admin) → act in forum → watch progress poll in → see reward
   in ledger + leaderboard.
2. **Nail every required FE behavior** (20%) — these are binary; missing one is visible.
3. **Clean schema + exact contract match** (20%) — endpoints must match `02-api-contract.md`.
4. **Code quality throughout** (25%) — separation of concerns (our modular-monolith seams help
   here), naming, strict TS (no `any`).
5. **Docs** (10%) — the README must cover schema rationale, background-job impl + why, polling
   interval + why, timezone handling, idempotency. Provide `.env.example`.
6. **Bonuses** (5%) — all in scope: tests (streak/idempotency/disbursal), leaderboard, rate
   limiting, points+badges, deploy.

## Definition of done (per the brief)
- Public GitHub repo, **incremental commit history**.
- `.env.example` for the service(s).
- Deployed public URL **preferred** (else 3–5 min walkthrough video).
- README covers overview + features, setup + env, challenge provisioning, full-flow verification,
  and all required design-decision sections.
- Deadline: **Day 5** from assignment date.

## Live-review readiness
For every file we should be able to explain **why** it exists and **how** to extend it. Favor
small, single-purpose modules (easier to reason about and to extend on the spot).
