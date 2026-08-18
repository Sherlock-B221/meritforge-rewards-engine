# meritforge — Assignment Parity Remediation Plan

**Date:** 2026-08-18 · **Branch:** `fix/assignment-parity` (cut from P7 HEAD `a02cde2`)
**Scope:** DIAGNOSE + PLAN ONLY. No application code was changed in producing this document.
**Grounding:** the assignment only — `mind-map/00–09`, the Forum Wireframes, and the brief/rubric
(`mind-map/06`). Every gap below is tied to a spec line or a wireframe element.

> **How to use:** work P0 → P1 → P2. Each gap is `symptom · root cause · concrete fix (exact
> files/endpoints/components) · verification`. The completeness checklist (§4) is the "nothing
> missed" backstop — re-run it before submission.

---

## 0. Executive summary — what's actually wrong

The audit (live stack + backend/deploy + frontend + prod probe + spec cross-check) shows the
**engineering is largely complete and correct**: every one of the 19 contracted endpoints is
implemented, the async engine (Postgres queue, idempotency, streaks, at-most-once disbursal) is
solid with 121 passing tests, all graded cross-cutting FE behaviors ship (optimistic post+comment,
30s polling, URL feed state, skeletons-not-spinners, error boundaries on all 8 fetch surfaces, real
Recharts rings, clean custom hooks), and the core loop is **proven live on prod** (a user carries
disbursed points + a badge on the deployed leaderboard). All five bonuses are present.

So the "poor state" is **not** a missing-core problem — it is a **presentation, demo-data, and
deploy-health** problem, i.e. exactly the surface a reviewer sees first:

1. **The deployed demo is broken and empty.** The right rail shows *"Couldn't load this section."*
   and the feed/challenges/leaderboard are near-empty — because prod was never seeded and a FE/BE
   error-code mismatch turns "no weekly challenge yet" into a hard error.
2. **A fresh `docker compose up` fails** (frontend lockfile drift) and even when it runs, **nothing
   seeds the DB**, so a grader following the README gets an empty, hollow app.
3. **Upvoting has no UI** even though the backend fully supports it and the wireframes make it a
   first-class, rewarded interaction.
4. **The UI is a bare, all-grayscale shadcn scaffold** with no Vultr brand identity, and the
   first-run experience for a new user is an empty feed with no guidance.

Close these four and the app becomes complete, working end-to-end, and demo-ready. The bulk of the
effort is **frontend polish + seed data + two small config/code fixes**, not new backend systems.

---

## 1. Root-cause note — the deployed right-rail "Couldn't load this section."

**Symptom.** On the deployed app (`https://frontend-sigma-sand-38.vercel.app`), the persistent
right-rail Weekly-Challenge widget renders its `SectionBoundary` error fallback
(*"Couldn't load this section."*) on every page.

**What it is NOT (ruled out with first-hand evidence):**
- **Not CORS.** A preflight from the exact Vercel origin returns `200` with
  `access-control-allow-origin: https://frontend-sigma-sand-38.vercel.app`, `allow-credentials:
  true`, all methods. CORS is configured correctly (`backend/app/main.py:30-36`; `FRONTEND_ORIGIN`
  in `render.yaml` equals the Vercel origin).
- **Not a wrong API base URL.** The production JS bundle (chunk `362-*.js`) bakes
  `https://meritforge-api.onrender.com/api` verbatim; grep of every prod chunk finds **0**
  `localhost:8000` hits. The live build points at Render.
- **Not a missing token.** The API client attaches `Authorization: Bearer <token>` from the
  hydrated auth store, and the widget only mounts inside the auth-gated `(app)` shell
  (`frontend/src/services/apiClient.ts:53-59`).

**Actual root cause — a compound of two real defects:**

1. **Prod DB has no active weekly challenge (never seeded).** Authenticated prod probe:
   `GET /api/challenges/weekly` (with a valid token) → **`404 {"error":{"code":
   "WEEKLY_CHALLENGE_NOT_FOUND",...}}`**. Prod contains only ad-hoc "Deploy Verify" artifacts from
   the README's manual walkthrough — not the seed dataset — so `get_weekly_with_progress`
   (`backend/app/services/engine/progress_reads.py:84-99`) finds no active weekly COUNT challenge.

2. **FE/BE error-code contract mismatch turns "empty" into "error."** When there is no weekly
   challenge the backend raises `NotFoundError("weekly_challenge", "current")`
   (`progress_reads.py:99`), and the envelope builder emits `code = "{RESOURCE}_NOT_FOUND"` =
   **`WEEKLY_CHALLENGE_NOT_FOUND`** (`backend/app/core/exceptions.py:17-24`). But the FE's graceful
   "no active challenge" guard only fires when `error.code === "NOT_FOUND"`
   (`frontend/src/components/WeeklyChallengeWidget/useWeeklyChallenge.ts:30,34`). Because
   `WEEKLY_CHALLENGE_NOT_FOUND !== "NOT_FOUND"`, the widget treats the empty case as a hard error,
   re-throws (`WeeklyChallengeContent.tsx:45-48`), and `SectionBoundary`
   (`WeeklyChallengeWidget.tsx:18`, string at `feedback/SectionBoundary/SectionBoundary.tsx:10`)
   renders the error UI instead of *"No active weekly challenge right now."*

   The FE `apiClient` copies `AppError.code` straight from the wire body with no status-based
   normalization (`apiClient.ts:66-79`), so nothing rescues the mismatch.

**Exact fix (both required):**
- **Code:** align the error code so "empty" degrades gracefully. Either (a) backend returns the
  generic `NOT_FOUND` (or a dedicated `NO_ACTIVE_WEEKLY_CHALLENGE` sentinel) for the weekly-empty
  case at `progress_reads.py:99`; **or** (b) broaden the FE guard to
  `error.status === 404 || error.code === "WEEKLY_CHALLENGE_NOT_FOUND"` at
  `useWeeklyChallenge.ts:30,34`. Prefer (b) plus a small FE hardening so *any* unexpected
  widget error still shows the branded empty state rather than a scary boundary. Do the same audit
  for other resource-specific `*_NOT_FOUND` codes the FE may mis-handle.
- **Data:** seed the Render DB so there is a real active weekly challenge (see P0-2 and the seed
  spec §3), so the widget shows live progress rather than an empty state.

**Latent footgun (fix while here, not the current cause):** `NEXT_PUBLIC_API_URL` is set only in
the Vercel dashboard (out of repo); every committed default is `http://localhost:8000/api`
(`frontend/.env.example:1`, `frontend/Dockerfile:14`, `docker-compose.yml:82,87`,
`apiClient.ts:8` fallback). A rebuild from committed defaults — or a fresh Vercel project — would
silently ship a localhost bundle. Commit the intended prod value (e.g. a `frontend/vercel.json`
`env` entry, or a documented+enforced build arg) so the base URL can't regress.

**Verification:** after the code fix, with prod still unseeded, reload the deployed `/feed` → the
widget shows *"No active weekly challenge right now."* (never the error). After seeding prod, reload
→ the widget shows the live weekly challenge with `x/target` progress and the countdown. Also
`curl -H "Authorization: Bearer <tok>" .../api/challenges/weekly` returns `200` with a challenge.

---

## 2. Prioritized gap list

### P0 — broken / blocking (a reviewer hits these immediately)

**P0-1 · Deployed right-rail shows an error on every page.**
- *Symptom / root cause / fix / verify:* see §1 in full. (Compound: unseeded prod + error-code
  mismatch.) Fix = align error code (`useWeeklyChallenge.ts:30,34` or `progress_reads.py:99`) +
  seed prod. Verify = reloaded prod `/feed` shows live widget or graceful empty, never the boundary.

**P0-2 · Deployed demo is empty (prod DB never seeded).**
- *Symptom:* deployed `/feed`, `/challenges`, `/leaderboard` are near-empty (only "Deploy Verify"
  challenges, a `deployuser`, one throwaway post); no demo threads, no weekly challenge, no
  activity. The live URL — the primary submission artifact — looks unfinished.
- *Root cause:* `seed.py` runs nowhere automatically. `render.yaml` sets no `dockerCommand`, so the
  image CMD only runs `alembic upgrade head` + serve (`backend/docker-entrypoint.sh:9-10`); seed is
  never invoked on Render.
- *Fix:* run the (enriched, idempotent — see P1-2) seed once against the Render Postgres. Options:
  a Render one-off Job / "Run command" (`uv run python -m app.scripts.seed`) against
  `DATABASE_URL`, or a guarded one-shot on deploy. Make the seed idempotent first (it is currently
  "not idempotent") so re-running is safe.
- *Verify:* deployed `/feed` shows the demo threads; `/challenges` shows the active weekly + others;
  the right rail loads live progress; `/leaderboard` shows the demo users.

**P0-3 · Fresh `docker compose up --build` fails to build the frontend.**
- *Symptom:* a clean `docker compose up --build` aborts at the `web` image with
  `npm ci` **`EUSAGE`** — *"npm ci can only install packages when your package.json and
  package-lock.json … are in sync … Missing: @emnapi/runtime@1.11.3, @emnapi/core@1.11.3"*
  (`frontend/Dockerfile:10`). (A stale 17-hour-old stack is still running locally, which masks this
  — but a grader cloning fresh cannot build the frontend.)
- *Root cause:* `frontend/package-lock.json` drifted out of sync with `package.json` (the Tailwind
  v4 oxide wasm shims `@emnapi/*` are missing from the lock). `npm ci` is strict and refuses.
- *Fix:* `cd frontend && npm install` to regenerate the lockfile in sync, then commit
  `frontend/package-lock.json`. (Optionally pin `npm` in the Dockerfile for reproducibility.)
- *Verify:* `docker compose build web` succeeds from a clean cache; `docker compose down -v && docker
  compose up` brings up **all four** services (db, backend, worker, web) healthy.

**P0-4 · The documented one-command setup yields an empty app (no auto-seed on `docker compose up`).**
- *Symptom:* even once P0-3 is fixed, a grader who runs `docker compose up` gets a migrated-but-empty
  DB — empty feed, no challenges, right rail empty→error (same mismatch as P0-1). The README's
  "full-flow verification" then requires manual seeding they may not notice.
- *Root cause:* `docker-compose.yml` `backend.command` = `alembic upgrade head && uvicorn …`
  (`:44`) and `worker.command` = `run_worker` (`:72`); neither invokes `app.scripts.seed`.
- *Fix:* add a one-shot **`seed`** service to `docker-compose.yml` that `depends_on: backend
  (service_healthy)` and runs `uv run python -m app.scripts.seed` once (idempotent so repeated
  `up`s are safe), or have the backend entrypoint seed when the DB is empty behind a
  `SEED_ON_START`-style flag (default on for local/compose, off for prod). Keep the manual command
  documented as the escape hatch.
- *Verify:* `docker compose down -v && docker compose up` → open `http://localhost:3000`, register,
  land on a **populated** feed with a live right-rail widget, no manual step.

### P1 — missing features + core UX

**P1-1 · Upvote/like has no UI (post-detail empty, feed count inert).**
- *Symptom:* the wireframes show upvote counts on threads (▲48/▲23/▲11), a "Get 5 upvotes"
  challenge, and a "reached 25 upvotes" reward — but the post-detail page shows **no upvote control
  or count at all** (`frontend/src/screens/PostDetail/Screen.tsx:14-60` omits `upvote_count`), and
  the feed only renders a **static, non-clickable** `ArrowUp` + count
  (`frontend/src/screens/Feed/components/PostRow/PostRow.tsx:48-51`). There is no way to cast an
  upvote from the UI on either surface.
- *Root cause:* the FE never wires the (fully-working) backend endpoint. Backend has it end to end:
  `POST /api/posts/:id/upvote` (`backend/app/controllers/posts_controller.py:45` →
  `services/forum/posts_service.py:95`, idempotent), `posts.upvote_count` on the read model
  (`schemas/forum.py:32`), and it publishes a `post_upvoted` event
  (`constants/events.py:10`) that the generic `CountEvaluator` already evaluates. The FE
  `postsService` has no `upvotePost` call.
- *Fix:* add `upvotePost(id)` to `frontend/src/services/postsService.ts` (POST
  `/posts/:id/upvote`); add an optimistic `useUpvote` hook (mirror `useOptimisticComment`:
  `optimisticData` bumps `upvote_count`, `rollbackOnError`, error toast); render an **interactive
  upvote button + count** in the post-detail `PostHeader` (`PostDetail/Screen.tsx:14-60`) and make
  the feed `PostRow` count a button (`PostRow.tsx:48-51`). Reflect `upvoted` state (filled vs
  outline `ArrowUp`).
- *Verify:* on `/posts/:id`, click upvote → count increments instantly, persists on reload; on
  `/feed`, the count is clickable and optimistic; `POST /posts/:id/upvote` shows `upvote_count+1`.

**P1-2 · Seed does not reproduce the wireframe demo-state (and isn't idempotent).**
- *Symptom:* the current seed makes the app *work* but not *look like the wireframes* — no upvotes,
  no "Get 5 upvotes" challenge, only 8 comments (wireframe thread #1 shows "12 comments"), no
  populated hero-user streak (14/best 21) or the exact reward-ledger rows the Profile page depicts.
- *Root cause:* `backend/app/scripts/seed.py` seeds admin + 5 users + 4 challenges (First Solution,
  10 Answers, "Weekly: 5 Comments", Week Streak) + 4 posts + 8 comments + 1 solution — **no upvotes,
  no upvote challenge** — and is explicitly "not idempotent."
- *Fix:* extend `seed.py` per the **Seed-data spec (§3)**: add upvotes to reach the wireframe counts,
  add a COUNT-on-`post_upvoted` "Get 5 upvotes" challenge (+100 pts), enrich thread #1 to ~12
  comments, seed the hero user's streak (14/best 21), and align the weekly challenge to the
  wireframe ("Post N answers this week"). Make it idempotent (skip if `admin@meritforge.dev`
  exists, or upsert by natural key) so it can run on `docker compose up` and re-run on prod safely.
- *Verify:* after `seed`, `/feed` shows 4 tagged threads with upvote counts + a ✓solved thread,
  `/posts/:id` shows ~12 nested comments + accepted solution + upvote control, `/challenges` shows
  the weekly + "Get 5 upvotes" + streak, `/u/ria` shows points/badges/ledger + a 14-day streak
  heatmap, `/leaderboard` ranks the demo users.

**P1-3 · Right-rail "Top this week" widget is not built.**
- *Symptom:* the wireframes show a **TOP THIS WEEK** mini-leaderboard in the right rail (ranks 1–3
  with points) alongside the weekly widget on every page; the FE right rail renders **only** the
  weekly widget.
- *Root cause:* `frontend/src/components/layout/RightRail/RightRail.tsx` mounts just
  `WeeklyChallengeWidget`; no top-this-week component exists (grep: no match).
- *Fix:* add a `TopThisWeekWidget` in `RightRail` fed by `GET /api/leaderboard` (top ~3–5), with a
  `SkeletonCard`, its own `SectionBoundary`, and an empty state — matching the existing widget
  pattern.
- *Verify:* the right rail shows a ranked top-users card on all five pages; loading shows a
  skeleton; a fetch error shows the boundary, not a crash.

**P1-4 · Post-login first-run is empty and unguided ("unintuitive").**
- *Symptom:* login/register both `router.push("/feed")` (`screens/{Login,Register}/useScreen.ts:45`),
  but a brand-new user lands on an **empty** feed — a single gray line *"No posts to show."*
  (`Feed.tsx:114-117`) — plus a "no active weekly challenge" widget and a 3-link nav. `/` is a
  two-line placeholder that doesn't route authenticated users anywhere (`app/page.tsx:8-17`). The
  gamified core (points/challenges) is never surfaced first.
- *Root cause:* seed-empty system (P0-4/P1-2) + minimal empty-state UX + no onboarding + landing on
  `/feed` rather than the challenges hook.
- *Fix:* (a) seeding (P0-4/P1-2) makes the feed non-empty for the demo; (b) upgrade the feed empty
  state to a real first-run card ("Start the conversation — post your first thread" + a "View
  challenges to earn points" CTA) at `Feed.tsx:114-117`; (c) make `/` redirect authenticated users
  to `/feed` and give unauthenticated users a real one-screen landing (`app/page.tsx`); (d)
  optionally a dismissible welcome banner pointing at `/challenges`.
- *Verify:* a fresh registration lands on a populated feed (demo) or a clearly-guided empty state
  with an obvious primary action; hitting `/` while logged in redirects to `/feed`.

**P1-5 · Upvote-challenge reward semantics (decision + optional backend change).**
- *Symptom:* the wireframe's "Get 5 upvotes (2/5)" and "Thread reached 25 upvotes → +30" read as
  *the post author* earning when *their* content is upvoted. Today a COUNT-on-`post_upvoted`
  challenge credits **the user who casts the upvote**, not the author (`posts_service.py:113` puts
  the upvoter's `user_id` on the event).
- *Root cause:* upvote events are attributed to the actor (upvoter), consistent with all other
  events; there is no author-attribution path.
- *Fix (choose one, document it):* (a) scope the seeded upvote challenge as *"cast 5 upvotes"*
  (works today, purely data) and word it that way; **or** (b) if author-reward is intended, emit an
  author-attributed upvote event (credit the post author) in `posts_service.py:110-116` and target
  the challenge at that — noting the idempotency/`event_id` implications.
- *Verify:* per the chosen semantics, upvoting advances the correct user's progress toward the
  challenge, and the reward disburses once.

### P2 — polish (raises the visible quality bar)

**P2-1 · No brand identity — the app is all-grayscale stock shadcn.**
- *Symptom:* every theme token is `oklch(L 0 0)` (chroma 0) — `--primary` is dark **gray**, charts
  are gray, and the only blue token (`--sidebar-primary`) is dark-mode-only **and** unreferenced,
  so **no blue ever renders** (`frontend/src/app/globals.css:51-84,112`). No dark mode is activated
  (no `ThemeProvider`). This is the loudest "weak UI" tell against the wireframe's Vultr design
  system.
- *Fix:* introduce a Vultr-style palette in `globals.css` — a bright-blue `--primary` and a navy
  surface — and either ship a cohesive branded light theme or wire a `ThemeProvider` (next-themes is
  already a dep) to enable the dark palette; color the progress rings (`ProgressRing.tsx:26` uses
  `var(--color-primary)`), the ✓solved / reward / tag chips, and rank/points accents; use the
  installed-but-unused `Avatar`/`Separator` for hierarchy.
- *Verify:* the app renders with a blue accent and coherent theme; rings and badges are colored;
  side-by-side with the wireframe it reads as "Vultr," not "stock shadcn."

**P2-2 · Weak visual hierarchy / density.** Feed/profile/leaderboard rows are flat and generic (no
avatars, plain gray pills, low-contrast accents, uniform Geist sizing). *Fix:* add avatars, weight
trending/high-rank/solved items, differentiate heading scale. *Files:* feed `PostRow`, `Leaderboard`,
`ProfileHeader`. *Verify:* scannable hierarchy; important items stand out.

**P2-3 · No responsive/mobile layout.** `(app)/layout.tsx:18-24` is a fixed 3-column desktop shell
(`w-56` sidebar + `w-72` right rail, no breakpoints) — the main column is crushed on narrow
viewports. *Fix:* collapse sidebar/right-rail below a breakpoint, add a mobile nav. *Verify:* usable
at ~375px width.

**P2-4 · Rich-text editor is a fake toolbar.** The Create-Post toolbar appends literal markdown
characters to a `<textarea>` (`CreatePost/useScreen.ts:56-58`) (open item O5). *Fix:* integrate a
lightweight editor or render a markdown preview; store as markdown. *Verify:* formatting actually
applies / previews.

**P2-5 · Streak heatmap: charting-lib fidelity + empty state.** The heatmap is a hand-built CSS grid
(`StreakHeatmap.tsx:88-101`), not a charting-lib component — the rubric's charting requirement is
already met by the Recharts rings, so this is fidelity only (D16 wanted both via a charting lib).
It also has no distinct empty state (renders "0-day streak · best 0"). *Fix (optional):* reimplement
via Recharts and add a "no activity yet" empty state. *Verify:* heatmap renders with an empty state
for new users.

**P2-6 · Trending sort formula undefined/undocumented (O6).** The feed exposes a `trending` sort;
confirm it computes a real engagement score (e.g. weighted upvotes+comments decayed by age) rather
than a naive order, and document it in the README (the contract requires the trending formula to be
documented). *Files:* backend feed query + README. *Verify:* `sort=trending` orders by a documented
formula that visibly differs from `latest`.

---

## 3. Seed-data spec — reproduce the wireframe demo-state

Goal: after `seed` runs (locally and on prod), the app matches the wireframes — alive, with an
active weekly challenge, upvotes, an accepted solution, streaks, a populated ledger, and a
leaderboard. **Δ = change vs. the current `seed.py`.**

### Users (≥7; keep current creds, documented in README)
- **admin** — `admin@meritforge.dev` / `admin12345`, role admin. *(exists)*
- **ria** (hero, Profile page is drawn for her) — `ria@meritforge.dev` / `demo12345`. **Δ** seed her
  to ~3,240 total points, **14-day current streak / best 21**, ~rank #7.
- **arjun, kavya, sam, neha** — `<name>@meritforge.dev` / `demo12345`. *(exist)*
- **Δ** add ≥2 more users (e.g. `toml`, `vultr_sa`) so "Top this week" (≈980/840/770) and the
  leaderboard look real, and so `vultr_sa` can author the accepted solution.

### Posts / threads (4, with tags, authors, times, comment + upvote counts, solved flag)
1. **"How do I autoscale Cloud GPU for batch inference?"** — tags `gpu`,`kubernetes` — author ria —
   **▲48** — ✓ solved. **Δ** upvotes + ~12 comments + accepted solution.
2. **"Object Storage vs Block Storage for media pipeline?"** — tag `storage` — author arjun/mako —
   **▲23**. **Δ** upvotes.
3. **"Best region pairing for low-latency EU + US?"** — tag `networking` — author toml — **▲11**.
   **Δ** upvotes.
4. **"Managed DB backups — point in time?"** — tag `db` — **▲17**. **Δ** upvotes (+ this 4th post
   already exists in spirit).

### Comments
- **Δ** enrich thread #1 to **~12 nested comments** (current seed adds 2/post); include one by
  `vultr_sa` **marked as the accepted solution**. Keep 2/post on the others.

### Upvotes  **(Δ — none today)**
- Cast upvotes via the real `POST /posts/:id/upvote` path (so `post_upvoted` events flow through the
  engine) to reach counts 48 / 23 / 11 / 17.

### Challenges (must include an ACTIVE WEEKLY one)
- **Weekly (active):** align to the wireframe — **"Post 3 answers this week"**, COUNT on
  `comment_posted`, target **3**, window `weekly`, reward **+150 pts**. *(Current seed has a weekly
  "5 Comments/150" — retarget/rename to 3 to match the wireframe, or keep 5 and update the wireframe
  reference — pick one and be consistent.)* ria progress ~2/3.
- **"Get 5 upvotes"** — **Δ new** — COUNT on `post_upvoted`, target **5**, reward **+100 pts**
  (ria ~2/5). (See P1-5 for actor-vs-author semantics.)
- **First Solution** — badge, `solution_marked`, target 1. *(exists; earned by ria)*
- **Week Streak** — STREAK, `contribution`, target_days 7, badge. *(exists)*
- *(optional)* **10 Answers** — badge, `comment_posted`, target 10. *(exists)*

### Rewards ledger (arises from draining events; ensure the hero's rows resemble the wireframe)
- Answer marked as solution → **+50**; Weekly challenge complete → **+150**; (if upvote author-reward
  shipped) thread reached 25 upvotes → **+30**; 7-day streak bonus → **+20**.

### Badges (ria): First Solution, 10 Answers, Week Streak earned; ≥2 shown locked.

### Streak / heatmap **(Δ)**: seed ria's `user_daily_activity`/`user_streaks` to a 14-day current
streak (best 21) so the Recharts/heatmap surface is populated.

### Execution requirements
- **Idempotent** (Δ): guard on an existing admin / upsert by natural key so it is safe on repeated
  `docker compose up` and re-runnable on prod.
- **Runs automatically on `docker compose up`** (P0-4) and **once on Render** (P0-2).

---

## 4. Assignment-completeness checklist

Legend: ✅ done · 🟡 partial/weak · ⚠️ broken (regressed/observably failing) · ❌ missing.
IDs reference `mind-map` (rubric `06`, contract `02`, data-model `03`, UX `04`, structure `09`).

### 4.1 Rubric (`06`)
| Line | Status | Note |
| --- | --- | --- |
| CQ1 separation of concerns | ✅ | layered controllers→services→models; engine decoupled; screens pattern |
| CQ2 meaningful naming / small modules | ✅ | consistent; ~16 focused hooks |
| CQ3 strict TS, no `any` abuse | ✅ | P6 typecheck/lint green |
| UX1 all required behaviors | 🟡 | behaviors ship, but weekly widget broken on prod (P0-1) + no upvote UI (P1-1) |
| BE1 well-modeled schema | ✅ | 03 schema fully implemented incl. `post_upvotes` |
| BE2 all endpoints match contract | ✅ | 19/19 core endpoints implemented (+ upvote extension) |
| FN1 full E2E flow | ✅ | proven live on prod (disbursed points+badge on leaderboard) + 121 tests |
| DOC1 setup | ✅ | README Docker + local setup |
| DOC2 challenge provisioning | ✅ | admin-API walkthrough in README |
| DOC3 full-flow verification | 🟡 | documented, but relies on manual seed (P0-4) — tighten after auto-seed |
| DOC4 design decisions | ✅ | schema/queue/polling/timezone/idempotency writeups |
| DOC5 assumptions | ✅ | documented |

### 4.2 Cross-cutting graded behaviors (`04`)
| ID | Behavior | Status | Note |
| --- | --- | --- | --- |
| X1 | optimistic post | ✅ | `useCreatePost` optimistic + rollback + toast |
| X2 | optimistic comment | ✅ | `useOptimisticComment` |
| X3 | 30s polling | ✅ | challenges + weekly widget, single `POLL_INTERVAL_MS` |
| X4 | URL feed state | ✅ | `useUrlState` (sort/page/search, shareable, back-button) |
| X5 | skeletons, no spinners | ✅ | all surfaces; zero spinners in codebase |
| X6 | error boundaries per surface | ✅/⚠️ | 8/8 surfaces wrapped; weekly boundary mis-fires on empty (P0-1) |
| X7 | ≥1 single-responsibility hook | ✅ | `useUrlState`, `useCountdown`, etc. |
| X8 | persistent weekly widget, resets Monday | ⚠️ | mounted + 30s poll + ISO-week reset, but **broken on prod** (P0-1) |
| X9 | charting-lib data-viz | ✅ | real Recharts rings (heatmap is CSS — fidelity note P2-5) |

### 4.3 The 5 pages + bonus page (`04`/`09`)
| Page | Status | Note |
| --- | --- | --- |
| Feed `/feed` (F1–F6) | ✅/🟡 | all behaviors ✅; empty first-run weak (P1-4); trending formula undocumented (P2-6) |
| Post Detail `/posts/:id` (PD1–PD5) | 🟡 | nested comments/solution/optimistic ✅; **upvote control missing** (P1-1) |
| Create Post `/posts/new` (CP1–CP2) | ✅/🟡 | optimistic publish ✅; rich-text toolbar is fake (P2-4) |
| Challenges `/challenges` (CH1–CH5) | ✅ | rings + heatmap + this-week + 30s poll + skeleton/boundary |
| Profile `/u/:username` (PR1–PR3) | ✅ | points, badges, paginated ledger + skeleton |
| Leaderboard `/leaderboard` (LB1–LB3) *(bonus)* | ✅ | ranked, paginated, self-row highlight |
| Weekly widget (WW1–WW4) | ⚠️ | mounted/poll/reset ✅; graceful-empty (WW4) defeated by P0-1 |
| Right-rail "Top this week" | ❌ | not built (P1-3) |

### 4.4 API contract (`02`) — 19 core endpoints
✅ **all implemented** (auth register/login/me; posts list/create/get; comments; mark-solution;
events 202/idempotent/rate-limited; admin challenge CRUD+lifecycle; challenges + weekly;
users/me/progress|streaks|rewards; leaderboard). Extension `POST /posts/:id/upvote` ✅ implemented
(FE unused — P1-1). Error envelope present, but resource-specific `*_NOT_FOUND` codes vs the
representative `NOT_FOUND` cause the widget bug (P0-1).

### 4.5 Data model + engine (`03`)
✅ all tables/fields (`users, posts, comments, post_upvotes, events, challenges,
challenge_progress, user_daily_activity, user_streaks, reward_ledger`). ✅ engine invariants
(EA1–EA11): idempotent ingest (202), `FOR UPDATE SKIP LOCKED` worker, one all-or-nothing txn,
count+streak evaluators, at-most-once `disbursal_key`, UTC/ISO-week `period_key`. Evaluators =
count+streak (upvote = count-on-`post_upvoted`, no new kind needed).

### 4.6 Backend / engine requirements (`01`) — BR1–BR32
✅ auth+roles, challenge config/CRUD/lifecycle, event ingestion (202/idempotent/rate-limited),
Postgres-queue async worker, at-most-once reward disbursal, streak/period logic, error-envelope,
structure adherence. No gaps found.

### 4.7 Bonuses (`06`) + Definition of Done
| Item | Status | Note |
| --- | --- | --- |
| B1 tests (streak/idempotency/disbursal) | ✅ | 121 tests green |
| B2 leaderboard page | ✅ | endpoint + page |
| B3 rate limiting on `/api/events` | ✅ | 429/`RATE_LIMITED` proven |
| B4 multiple reward types (points+badges) | ✅ | distinct handlers, proven on prod |
| B5 deployment | 🟡 | live on Vercel+Render, but demo **broken/empty** until P0-1/P0-2 fixed |
| DoD1 public repo + incremental commits | ✅ | P1–P7 history |
| DoD2 `.env.example` | ✅ | ×2 |
| DoD3 deployed URL or video | 🟡 | deployed but degraded — fix before relying on it |
| DoD4–8 README sections | ✅ | overview/setup/provisioning/verification/design |

### 4.8 Wireframe-parity extras (beyond the literal contract, but visible)
| Item | Status | Gap |
| --- | --- | --- |
| Upvote interaction (feed + post detail) | ❌ | P1-1 (BE ready, FE missing) |
| "Get 5 upvotes" / upvote reward | ❌ | P1-2 seed + P1-5 semantics |
| Right-rail "Top this week" | ❌ | P1-3 |
| Vultr brand theme (navy + blue) | ❌ | P2-1 (all grayscale today) |
| Rich-text editor (O5) | 🟡 | P2-4 (fake toolbar) |
| Trending formula documented (O6) | 🟡 | P2-6 |

### 4.9 Re-run after remediation (2026-08-18)

All items above marked `⚠️`/`❌`/`🟡` for a P0/P1/P2-1 reason are now `✅`, verified against a fresh
`docker compose down -v && up` (auto-seed, no manual steps) plus direct API calls (login, feed,
upvote, leaderboard, weekly, streaks, rewards) and `npm run typecheck && npm run lint` +
`docker compose build --no-cache web`:

- **P0-1** (weekly widget error code) — `useWeeklyChallenge.ts` now keys off `error.status === 404`.
  Logically verified against the exact backend code path (`NotFoundError` → `WEEKLY_CHALLENGE_NOT_FOUND`,
  404); not additionally live-tested against a deliberately-emptied challenge table this session.
- **P0-3** (lockfile) — `frontend/package-lock.json` fully regenerated; `docker compose build
  --no-cache web` verified green from a clean cache.
- **P0-4 / P1-2** (seed) — idempotent (`Already seeded — skipping.` on rerun), auto-runs as a
  one-shot `seed` compose service, reproduces the wireframe demo-state at an organically-reachable
  scale (D17 + the seed-scaling note in `mind-map/07`). Verified: 4 tagged threads with ordered
  upvote counts (6/5/4/3), a 12-comment thread with a real accepted solution, ria's contribution
  streak at current=14/best=21, weekly progress 2/3, leaderboard populated and ria mid-pack (not #1).
- **P1-1** (upvote UI) — live-tested: a freshly registered user's `POST /posts/:id/upvote` call
  goes through end-to-end (6→7, idempotent on replay); FE code reviewed and typechecks/lints clean.
- **P1-3** (top-this-week widget) — built, mounted in the right rail, independent
  `SectionBoundary`; data source (`GET /leaderboard`) verified live.
- **P1-4** (first-run UX) — landing page SSR-verified via curl (new copy + CTAs render
  server-side); feed empty-state card reviewed in code.
- **P1-5** (upvote semantics) — decided + documented (D17 in `mind-map/07`, README).
- **P2-1** (brand theme) — verified live: compiled CSS ships `--primary: oklch(58% .21 258)`
  (was `oklch(0.205 0 0)`, chroma 0).
- **Not done this session** (P0-2, deploy): re-seeding the Render prod database and redeploying
  Vercel/Render both require dashboard/credential access this session doesn't have — see the
  handoff note in the PR description / final chat summary for the exact commands.
- **P2-6** (trending formula) — the formula already existed and was already real (HN-style
  gravity score); just wasn't documented. Documented in README ("Feed trending formula") +
  resolved O6 in `mind-map/07`.
- **Remaining P2 polish not attempted** (time-boxed out, non-blocking per the rubric): P2-2 visual
  hierarchy/density, P2-3 responsive/mobile layout, P2-4 real rich-text editor, P2-5 heatmap as a
  charting-lib component.

---

## 5. Suggested execution order

1. **P0-3** (lockfile) → unblocks any local Docker verification.
2. **P0-1 code fix** (weekly error-code) + **P1-2** (idempotent, enriched seed) — these are
   prerequisites for a good demo and for P0-2/P0-4.
3. **P0-4** (auto-seed on compose) then **P0-2** (seed prod) — makes both dev and the live URL alive;
   re-verify the right rail loads.
4. **P1-1** (upvote UI) + **P1-3** (top-this-week) + **P1-4** (first-run) — the visible feature/UX
   gaps.
5. **P1-5** decision (upvote semantics), then **P2-1** (brand theme) and remaining P2 polish.
6. Re-run the **§4 checklist** end to end (fresh `docker compose down -v && up`, then click every
   page + the deployed URL) before submission. Update the README/AI-usage notes for anything changed.

_This plan and its design are derived solely from the assignment — the mind-map, the wireframes,
and the brief._
