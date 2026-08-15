# 09 · Frontend folder structure (Next.js App Router)

Same mandated stack (Next.js/TS/Tailwind/shadcn/base-ui). Two disciplines layered together:

1. **The screens pattern** — `app/` is routing + the server boundary ONLY; each page's real
   implementation lives in `screens/<Name>/` as `Screen.tsx` (presentational) + `useScreen` hook
   (client logic) + constants + types + screen-local `components/` + `index.ts` barrels. Logic
   lives in hooks; components stay presentational; constants/types are never inlined; a component
   or hook is promoted to shared `components/` / `hooks/` only on its **second** consumer.
2. **SSR / SEO-ready from day one** — public pages render on the server (React Server Components +
   `generateMetadata`), so they're crawlable and fast. Authenticated, highly-interactive pages are
   client screens using **SWR** (`refreshInterval` polling + optimistic `mutate` with rollback).

> This is a deliberate divergence toward SSR + the screens pattern + barrels. Exact layout is ours
> to refine; the shape below satisfies every graded FE behavior + the SEO goal.

## How the screens pattern adapts to App Router + SSR

`app/**/page.tsx` stays thin — **routing + the server data boundary only**, no business logic:

- **Client (interactive) screen** → `page.tsx` is a one-liner:
  `export { default } from '@/screens/Challenges'` (the screen is `"use client"`, logic in
  `useChallenges`).
- **Server (public, SEO) screen** → `page.tsx` is a thin **server** component that exports
  `generateMetadata`, calls the screen's `*.loader.ts` (server-side fetch), and renders the
  server `Screen.tsx` with initial data. Still no business logic in `app/` — the loader (a service
  call) holds it. Interactive islands inside a server screen are small `"use client"`
  sub-components with their own hooks.

## Tree

```
frontend/
├── src/
│   ├── app/                              # ROUTING + server boundary ONLY
│   │   ├── layout.tsx                    # root layout; default <metadata>; <Providers>
│   │   ├── sitemap.ts, robots.ts         # SEO
│   │   ├── page.tsx                      # landing → export from screens/Landing (SSR)
│   │   │
│   │   ├── (public)/                     # SSR, crawlable, SEO-optimized (D15: public reads)
│   │   │   ├── layout.tsx                # public shell (server)
│   │   │   ├── feed/page.tsx             # SSR public feed + generateMetadata
│   │   │   └── posts/[slug]/page.tsx     # SSR public thread detail + generateMetadata
│   │   │
│   │   ├── (auth)/                       # login / register (public; SSR is fine)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   │
│   │   └── (app)/                        # authenticated shell (client-interactive)
│   │       ├── layout.tsx                # app shell: Sidebar + RightRail + WeeklyChallengeWidget
│   │       ├── posts/new/page.tsx
│   │       ├── posts/[id]/page.tsx
│   │       ├── challenges/page.tsx
│   │       ├── profile/page.tsx
│   │       └── leaderboard/page.tsx
│   │
│   ├── screens/                          # ONE folder per route = the page implementation
│   │   ├── Feed/
│   │   │   ├── Feed.tsx                   # presentational (server or client)
│   │   │   ├── useFeed.ts                 # client logic: SWR + URL state + optimistic
│   │   │   ├── Feed.loader.ts             # server-side data fetch for SSR variant
│   │   │   ├── Feed.constants.ts
│   │   │   ├── Feed.types.ts
│   │   │   ├── Feed.test.tsx
│   │   │   ├── components/                # sub-components used ONLY by Feed
│   │   │   │   ├── PostRow/ (PostRow.tsx, index.ts)
│   │   │   │   └── index.ts               # barrel of screen-local components
│   │   │   └── index.ts                   # export { default } from './Feed'
│   │   ├── PostDetail/   (…same shape; owner-only mark-solution, optimistic comment)
│   │   ├── CreatePost/   (…optimistic publish)
│   │   ├── Challenges/   (…30s polling, progress rings + streak viz, error boundaries)
│   │   ├── Profile/      (…points, badges, paginated ledger)
│   │   ├── Leaderboard/  (…paginated ranking)
│   │   ├── Login/  Register/  Landing/
│   │
│   ├── components/                        # SHARED (used by 2+ screens)
│   │   ├── ui/                            # shadcn / base-ui primitives (Button, Card, Tabs…)
│   │   ├── WeeklyChallengeWidget/         # persistent layout widget (polls 30s, Monday reset)
│   │   ├── feedback/                      # Skeletons, SectionBoundary (error boundary), EmptyState
│   │   ├── layout/                        # Sidebar, RightRail, Header
│   │   └── index.ts                       # root barrel
│   │
│   ├── hooks/                             # SHARED hooks (used by 2+ screens)
│   │   ├── useUrlState.ts                 # feed sort/page/search ↔ URL (shareable, back-button)
│   │   ├── useCountdown.ts                # weekly-reset countdown
│   │   ├── usePolling.ts                  # thin SWR refreshInterval wrapper (optional)
│   │   └── index.ts
│   │
│   ├── services/                          # API layer (server- AND client-safe data fetching)
│   │   ├── apiClient.ts                   # ONE base client (monolith = one base URL);
│   │   │                                  #   attaches token, unwraps error → typed AppError
│   │   ├── authService.ts
│   │   ├── postsService.ts
│   │   ├── engineService.ts               # challenges, weekly, progress, streaks, rewards, leaderboard
│   │   └── index.ts
│   │
│   ├── store/                             # minimal client state (SWR owns server cache)
│   │   ├── authStore.ts                   # session/user + token (context or zustand); 401→login
│   │   └── index.ts
│   │
│   ├── types/                             # global/shared TS types (mirror the API envelope)
│   │   ├── api.ts                         # or split auth.ts/forum.ts/engine.ts if it grows
│   │   └── index.ts
│   │
│   ├── constants/                         # shared constants (routes, polling interval, public env)
│   │   ├── polling.ts                     # POLL_INTERVAL_MS = 30_000 (single source of truth)
│   │   ├── routes.ts
│   │   └── index.ts
│   │
│   └── utils/                             # pure functions only, no React (cn, formatDate, timeAgo)
│       └── index.ts
├── next.config.ts
├── tailwind + tsconfig + package.json
└── .env.example                          # NEXT_PUBLIC_API_URL, etc.
```

## Rules (adapted from the provided discipline)

1. `app/` is routing + the server data boundary only — client screens = one-line re-export; SSR
   pages = thin server component (metadata + loader + render). No business logic in `app/`.
2. Every screen = `Screen.tsx` + `useScreen` (client logic) [+ `Screen.loader.ts` if SSR] +
   `.constants` + `.types` + local `components/` + `index.ts` barrel.
3. Promote a component/hook from a screen's local folder to shared `components/`/`hooks/` only when
   a **second** screen needs it.
4. Every folder exports via `index.ts` (`export { default as X } from './X'`) → imports read
   `import { Button } from '@/components/ui'`, never reaching into internal filenames.
5. **Logic in hooks, not components** — components presentational. Server screens keep fetching in
   the `loader`; client screens keep it in `useScreen`.
6. Constants and types get their own files, never inlined.

## Graded behaviors → where they live

| Behavior | Home |
| --- | --- |
| Optimistic UI (post + comment) | `useCreatePost` / `useOptimisticComment` in the screen; SWR `mutate` (`optimisticData` + `rollbackOnError`) + toast on failure |
| 30s polling | `usePolling` / SWR `refreshInterval` from `constants/polling.ts`; `Challenges` screen + `WeeklyChallengeWidget` |
| URL state | `useUrlState` (shared) — feed sort/page/search ↔ URL via `next/navigation` |
| Skeletons (no spinners) | `components/feedback/Skeletons`; per fetch surface |
| Error boundaries | `components/feedback/SectionBoundary` wraps each fetch section (retry, page stays usable) |
| Custom hook (≥1) | `useUrlState`, `useWeeklyChallenge`, `useCountdown`, `useCreatePost` — single-responsibility |
| Data-viz (charting lib) | `Challenges` screen — Recharts progress rings (+ optional streak heatmap) |
| Weekly widget | shared `WeeklyChallengeWidget` mounted in `(app)/layout.tsx` (+ public layouts) |

## SSR / SEO specifics
- Public screens are **server components**; export `generateMetadata` (title/description/OG per
  thread), semantic HTML, `sitemap.ts` + `robots.ts`.
- Data fetching for SSR happens in `*.loader.ts` (calls `services/`) — server-side, no client
  round-trip, indexable HTML.
- Authenticated interactive screens hydrate as client components (SWR). One base API client
  (single monolith URL) with token attach + 401→login.
- **Resolved (D15 · O7 = public reads / auth writes):** `(public)` group = **feed** + **thread
  detail** (`posts/[slug]`) — server-rendered, `generateMetadata`, in the sitemap. Writes (new post,
  comment, mark-solution, upvote) + all challenge/progress/reward/leaderboard pages live in `(app)`
  behind auth. Public feed/thread render read-only server HTML with small `"use client"` islands for
  authed actions (compose, comment, vote).
