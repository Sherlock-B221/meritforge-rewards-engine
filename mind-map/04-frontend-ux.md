# 04 · Frontend UX (Part B — Consumer Forum)

The **Vultr Developer Community Forum**. 5 pages + a persistent weekly-challenge widget. Wireframes
show three navigation shells (3-column sidebar / top-nav / slim icon-rail); **Shell A (left
sidebar · main feed · right rail)** is the default the remaining pages are drawn in.

---

## The 5 pages

### 1. Feed / Home — `/feed?sort=latest&page=1` · auth-gated
- Thread list with **Latest / Trending** filters, **search**, and **pagination**.
- Each row: title, tags, author, relative time, comment count, points/upvotes, `✓ solved` badge.
- **URL state**: `sort` + `page` (+ search) live in the URL — shareable, back-button restores.
- **Skeleton rows** on first load (no spinners).
- **Optimistic**: a newly created post appears instantly at the top; rolls back + error toast on
  failure.
- Weekly-challenge widget in the right rail (see below).

### 2. Post Detail — `/posts/:slug` · auth-gated
- Full thread + **nested comments**.
- **Accepted solution** highlighted at top.
- **Owner-only** "Mark as solution" control → `PATCH /posts/:id/solution/:commentId`.
- **Optimistic** comment submit (appears instantly; rolls back on error).
- Emits `post_viewed` on load, `comment_posted` on comment, `solution_marked` on solution.

### 3. Create Post — `/posts/new`
- Form: **Title**, **Tags** (chips), **Body** (rich-text toolbar).
- On publish: thread shows in feed immediately (**optimistic**), emits `post_created`; rolls back
  + error toast on failure.

### 4. Challenges & Progress — `/challenges`
- **Active challenges** with progress indicators (e.g. `2/3`, `2/5`) + reward (`+150 pts`).
- **Data-viz (charting lib — required):** Recharts **progress rings** for active-challenge progress
  **and** a **contribution streak heatmap** ("14-day streak · best 21"). Component-lib progress bars
  do **not** count. (Decision D16.)
- **This week's breakdown** — checklist of sub-goals (☑ / ☐) with points.
- **Polls every 30s** — evaluation is async so progress trickles in without reload.
- **Skeletons** on load; **error boundary** shows "couldn't load progress · retry" while the page
  stays usable.

### 5. Profile / Rewards — `/u/:username`
- Header: name, handle, join date, current streak, leaderboard rank.
- **Total points** (big number).
- **Badges earned** (First Solution / 10 Answers / Week Streak…).
- **Reward history / ledger** — **paginated**, **skeleton rows** on load.

### Bonus page — Leaderboard — `/leaderboard`
- Users ranked by total points, paginated (uses `GET /api/leaderboard`).

---

## Persistent Weekly Challenge widget
- **Layout-level** component present on **all 5 pages**.
- Shows the current weekly challenge, live progress (e.g. `2/3`), reward (`+150 pts`), and a
  countdown ("Resets Mon · 3d 14h").
- **Polls every 30s** (same mechanism as the challenges page).
- **Resets Monday** (driven by the engine's ISO-week `period_key`).

---

## Required behaviors (graded — build every one)

| Behavior | Requirement |
| --- | --- |
| **Optimistic UI** | Post creation **and** comment submission update instantly before server confirm; roll back + surface error on failure. |
| **Polling** | Challenges/Progress page + weekly widget poll for updates (async eval). Document interval (**30s**) + why. |
| **Data visualization** | One of: streak **heatmap** / progress **rings** / points **timeline**. Must use a charting lib. |
| **Loading states** | **Skeleton** loaders on all data-fetching surfaces. **No spinners.** |
| **Error boundaries** | Every data-fetching section degrades gracefully with a visible fallback (retry). |
| **URL state** | Feed filters + pagination in the URL; shareable; back-nav restores state. |
| **Custom hook** | ≥1 named custom hook with a single, clear responsibility. |

Candidate custom hooks: `useUrlFeedState` (sort/page/search ↔ URL), `useWeeklyChallenge`
(fetch+poll+countdown), `useOptimisticComment`, `useCreatePost`, `useCountdown`.

---

## Our FE approach (proposed — see `05-architecture-decisions.md`)
- **SWR** for data fetching — its built-in `refreshInterval` cleanly expresses the 30s polling and
  the optimistic `mutate()` API expresses optimistic UI + rollback.
- **Recharts** for the data-viz — **progress rings** for active-challenge progress **and** a
  **contribution streak heatmap** (both, per the wireframe). Confirmed (D16).
- **shadcn / base-ui + Tailwind** for components; **sonner**-style toasts for optimistic-failure
  errors; `react-error-boundary` (or equivalent) for the boundaries.
- Auth token handling + a single 401→login redirect interceptor.
