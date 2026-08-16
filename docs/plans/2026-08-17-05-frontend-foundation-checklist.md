# P5 — frontend foundation (lean checklist)

Source: `mind-map/02-api-contract.md`, `mind-map/04-frontend-ux.md`, `mind-map/09-frontend-structure.md`.
Short in-session checklist, not a full plan doc — P3 already has the heavy-rigor plan; P5 is lean
per `docs/plans/GOALS.md`. Two tasks, sequential (Task 2 builds on Task 1's scaffold).

## Global constraints (apply to both tasks — copy into every dispatch)

- Everything lives under `frontend/` at the repo root (sibling to `backend/`), `src/` layout, path
  alias `@/*` → `src/*`.
- Next.js 15 App Router, **TypeScript strict** (`"strict": true` in `tsconfig.json`). **No `any`
  anywhere** — use `unknown` + narrowing or generics. ESLint must fail on
  `@typescript-eslint/no-explicit-any`.
- **Package manager: npm** (ruling — nothing in the mind-map mandates one; npm keeps the Docker
  image simple with no corepack step).
- Styling: Tailwind. Components: shadcn CLI initialized with **Base UI** as the primitives layer
  (`npx shadcn@latest init`, choose Base UI when the CLI asks). If the installed shadcn version
  doesn't offer that choice, use whatever it defaults to and say so in the report — don't block on
  it.
- Data fetching: **SWR** for every client-side read; polling via SWR's `refreshInterval`.
- **Screens pattern** (mind-map/09): `app/` is routing + server boundary ONLY, no business logic.
  Each route's real implementation lives in `screens/<Name>/` = `Screen.tsx` (presentational) +
  `useScreen.ts` (client logic) + `.constants.ts` + `.types.ts` + screen-local `components/` +
  `index.ts` barrel. A component/hook is promoted from a screen's local folder to shared
  `components/`/`hooks/` only on its **second** consumer — except the handful of components the
  mind-map/09 tree already places in shared folders up front (`WeeklyChallengeWidget`, `Sidebar`/
  `RightRail`, `feedback/*`) — those are cross-cutting by design, build them there directly.
  Logic lives in hooks, never in components. Constants/types get their own files, never inlined.
  Every folder exports via `index.ts`.
- **API base URL** — one env var `NEXT_PUBLIC_API_URL` (`.env.example`:
  `NEXT_PUBLIC_API_URL=http://localhost:8000/api`), read only inside `services/apiClient.ts`. No
  other file touches `process.env` for it.
- **Error envelope** (verified against the running backend code, not just the mind-map):
  `{ "error": { "code": string, "message": string, "details": Record<string, unknown> } }` on every
  non-2xx response. Model it as `types/api.ts`'s `ApiErrorEnvelope`; the API client throws a typed
  `AppError` (`code`, `message`, `details`, `status: number`) built from it — synthesize
  `code: "UNKNOWN_ERROR"` if a non-2xx body doesn't match the envelope (e.g. a raw 502).
- **Auth response shapes** (verified against `backend/app/schemas/auth.py`):
  - `POST /auth/register` → `201`, `POST /auth/login` → `200`, both:
    `{ "token": string, "user": { "id": string, "username": string, "email": string, "role": "user" | "admin" } }`.
  - `GET /auth/me` → `200`, bare `{ id, username, email, role }` (no `token` wrapper).
  - Token goes on `Authorization: Bearer <token>`. A `401` with code `UNAUTHORIZED`,
    `INVALID_TOKEN`, or `TOKEN_EXPIRED` all mean "not authenticated" — treat identically (clear
    session, redirect to `/login`).
- **The one backend touch in P5** — `backend/app/main.py` currently does not configure CORS even
  though `Settings.frontend_origin` (`app/config/settings.py`) already exists and is unused. In
  Task 1, add:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  from app.config.settings import get_settings

  settings = get_settings()
  app.add_middleware(
      CORSMiddleware,
      allow_origins=[settings.frontend_origin],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
  placed right after `app = FastAPI(...)` (adjust the settings-getter call to match whatever's
  already imported in that file). Without this the browser can't call the API cross-origin from
  `localhost:3000`. This is the only file this phase touches under `backend/`.
- **Auth/session storage** — client-side only; no SSR-authenticated pages this phase. Persist
  `{ token, user }` under one `localStorage` key; hydrate into the auth store on mount inside a
  client `Providers` wrapper in `app/layout.tsx`. Ruling: mind-map/09 leaves the mechanism open
  ("context or zustand") — use **Zustand** for `store/authStore.ts`, the smallest surface for one
  piece of shared client state; SWR still owns all server-cache state.
- Test commands, must be clean before a task is reported done: `cd frontend && npm run typecheck`
  (add the script: `tsc --noEmit`) and `npm run lint`. No unit-test suite is mandated for this
  phase — don't add one speculatively.
- **Verify against the real API at least once per task**, not just typecheck: `docker compose -p
  meritforge up -d db backend` (run `docker compose -p meritforge run --rm backend uv run alembic
  upgrade head` once if migrations aren't applied yet), then `cd frontend && npm run dev`, and
  exercise the flow in a browser or via curl. Report exactly what you ran and what you saw — the
  Done criteria depend on this, it is not optional.
- Commit each task as its own commit (conventional-commit style matching this repo's history, e.g.
  `feat(frontend): Next.js scaffold + API client + auth store`).
- Never reference any other project, template, or repo as a source — build only from the mind-map
  + this checklist.

---

# Task 1: Next.js/Tailwind/shadcn(Base UI)/SWR scaffold + Dockerfile/compose + API client + auth store

**Scaffold**
- `frontend/` — Next.js 15 App Router, TypeScript strict, Tailwind, ESLint, `src/` directory.
- Replace the default scaffolded homepage with a minimal placeholder `src/app/page.tsx` — a plain
  server component, just enough to prove the app boots (heading + a link to `/login`). The full SSR
  landing page (metadata, hero, sitemap/robots) is out of scope for P5 — note it as a non-blocking
  open in your report, the same way `mind-map/07` tracks opens.
- `src/app/layout.tsx` — root layout; wraps children in a client `src/app/providers.tsx`
  (`"use client"`) that sets up `SWRConfig` (no global fetcher needed — services are called
  directly) and calls the auth store's `hydrate()` once on mount.
- `.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:8000/api`.

**shadcn/Base UI** — initialize per Global Constraints; add these primitives now so Task 2 doesn't
re-run init: Button, Input, Label, Card, Skeleton, Avatar, Separator, Sonner (toast). They land
under `src/components/ui/` per mind-map/09.

**API client** — `src/services/apiClient.ts`:
- A small typed wrapper (e.g. `apiGet<T>`, `apiPost<T>`, … or one `request<T>(path, init)`) that:
  prefixes `NEXT_PUBLIC_API_URL`, attaches `Authorization: Bearer <token>` from the auth store when
  a token exists, parses JSON, and on non-2xx throws `AppError` built from the error envelope (see
  Global Constraints).
- On a 401 with any of the three auth-failure codes: clear the auth store and
  `window.location.assign('/login')` (this file is not a component/hook, so no `next/navigation`
  router is available here — a full navigation is the correct behavior for "you were logged out").
- `src/types/api.ts` — `ApiErrorEnvelope`, the `AppError` class.

**Auth store + service**
- `src/store/authStore.ts` — Zustand: `{ token: string | null, user: AuthUser | null,
  setSession(token, user), clearSession(), hydrate() }`. `hydrate()` reads the one `localStorage`
  key (guard with `typeof window !== 'undefined'`); `setSession`/`clearSession` also write/remove
  it.
- `src/services/authService.ts` — `register(input)`, `login(input)`, `me()`, thin wrappers over
  `apiClient`, typed against the exact shapes in Global Constraints.
- `src/types/auth.ts` — `AuthUser { id, username, email, role }`, `AuthResponse { token, user:
  AuthUser }`.

**Dockerfile + compose**
- `frontend/Dockerfile` — multi-stage Node (deps → build → run), `EXPOSE 3000`, one header comment
  explaining the layering (match the backend Dockerfile's comment style).
- Uncomment and fill in the `web` service already stubbed (commented) in the repo-root
  `docker-compose.yml`: build context `./frontend`, port `3000:3000`, `environment:
  NEXT_PUBLIC_API_URL: http://localhost:8000/api`, `depends_on: backend`.
- Wire the CORS fix into `backend/app/main.py` (Global Constraints) — the one backend file this
  task touches.

**Verify** — register a user and call `/auth/me` for real (curl or browser), proving token attach
and the response shapes are correct; `npm run typecheck` + `npm run lint` clean; `docker compose -p
meritforge build web` succeeds.

---

# Task 2: login/register screens + (app) shell + feedback primitives + hooks + WeeklyChallengeWidget

Depends on Task 1's `apiClient`, `authService`, `authStore`, and shadcn primitives. Endpoints used:
`POST /auth/register`, `POST /auth/login`, `GET /challenges/weekly`.

**Ruling — temporary authenticated landing route.** Nothing in mind-map/04's page list is in scope
for P5 (Feed/Challenges/etc. are P6). But "Done" requires the shell + widget to actually render
post-login against the real API, so create a temporary placeholder route `(app)/home/page.tsx` →
`src/screens/Home/` (a plain welcome card, nothing else) purely to host the shell during this phase.
Login/Register redirect to `/home` on success. Leave a one-line comment noting this will very likely
be replaced once P6 builds Feed at `/feed`.

**Login/Register screens** — `src/screens/Login/`, `src/screens/Register/`, each the full shape
(`Screen.tsx` + `useScreen.ts` + `.types.ts` + `index.ts`). `app/(auth)/login/page.tsx` and
`register/page.tsx` are thin **server** components exporting `generateMetadata` (title per mind-map/09's
"public (SSR + metadata fine)") and rendering the client screen — no loader needed, there's no
server data for a login form. Behavior: shadcn form (Input+Label+Button), inline validation/error
display from the caught `AppError`'s `message`/`details`, on success call `authStore.setSession(...)`
then `router.push('/home')`.

**(app) shell** — `src/app/(app)/layout.tsx`: client layout that (a) guards the route — if there's
no token after hydration, redirect to `/login` (small `src/hooks/useRequireAuth.ts`, single
responsibility: auth-gate + redirect, nothing else), and (b) renders `Sidebar` + main `children` +
`RightRail`. `Sidebar`/`RightRail` live in `src/components/layout/` (shared per the mind-map/09
tree — treat the app shell as cross-cutting by design, not subject to the promote-on-2nd-use rule).
`Sidebar` nav links: Challenges `/challenges`, Leaderboard `/leaderboard`, Profile
`/u/${user.username}` (read from the auth store) — these routes don't exist until P6; that's fine,
the links just won't resolve yet. `RightRail` hosts the `WeeklyChallengeWidget`.

**Feedback primitives** — `src/components/feedback/`:
- `Skeletons/` — a few generic, composable shapes (`SkeletonLine`, `SkeletonCard`, `SkeletonRow`),
  sized via `className`/props; screens compose these later (P6) for their specific loading states.
- `SectionBoundary` — an error-boundary wrapper built on `react-error-boundary` (mind-map/04 names
  it explicitly) showing "Couldn't load · Retry" with a retry callback, keeping the rest of the page
  usable.
- Both exported via `components/feedback/index.ts`.

**Hooks** — `src/hooks/`:
- `useUrlState.ts` — generic query-string ↔ state sync via `next/navigation`'s `useRouter` /
  `useSearchParams` / `usePathname`. Keep it generic (`useUrlState<T extends
  Record<string,string>>(defaults: T): [T, (patch: Partial<T>) => void]` or equivalent) — P6's Feed
  screen will supply its own `sort`/`page`/`search` keys; this hook doesn't know about Feed.
- `useCountdown.ts` — `useCountdown(targetIso: string): { days, hours, minutes, isExpired }`,
  ticking every **60s** (ruling: the wireframe only ever shows day/hour granularity — "3d 14h" — so
  second-level ticks would be wasted re-renders).
- Both exported via `hooks/index.ts`.

**WeeklyChallengeWidget** — `src/components/WeeklyChallengeWidget/` (shared per mind-map/09 tree):
- `src/constants/polling.ts` — `POLL_INTERVAL_MS = 30_000` (single source of truth; P6's Challenges
  screen reuses it).
- `src/services/engineService.ts` — just `getWeeklyChallenge()` for now (thin `apiClient` wrapper);
  don't build the rest of the engine reads speculatively, they land with the screens that need them
  in P6.
- Fetches `GET /challenges/weekly` via SWR with `refreshInterval: POLL_INTERVAL_MS`; renders
  challenge name, `current/target` progress, reward, and a countdown via `useCountdown(resets_at)`.
- Wrapped in its own `SectionBoundary` + shows a `Skeleton` while loading.
- The backend raises `NotFoundError` (404, code `NOT_FOUND`) when no weekly challenge is active —
  treat that specific case as "no active weekly challenge" (render that message), not as a hard
  error.
- Mounted once, inside `RightRail`, in `(app)/layout.tsx`.

**Verify** — run the seed script once so a weekly challenge exists (`docker compose -p meritforge
run --rm backend uv run python -m app.scripts.seed`), then register+login through the browser UI
against the running backend; confirm the shell renders (Sidebar + RightRail) with the widget
showing real weekly-challenge data and a ticking countdown; confirm an unauthenticated visit to
`/home` bounces to `/login`. `npm run typecheck` + `npm run lint` clean.

---

## Done criteria (both tasks)

- Auth flow works end-to-end against the real API: register → session persisted → refresh keeps you
  logged in → logout/401 bounces to `/login`.
- `(app)/home` (temporary placeholder) renders inside the shell (Sidebar + RightRail) once
  authenticated; unauthenticated access redirects to `/login`.
- `WeeklyChallengeWidget` is mounted in the shell, polls every 30s, shows live data from `GET
  /challenges/weekly`, and degrades gracefully via its own `SectionBoundary` + `Skeleton`.
- Screens pattern + `index.ts` barrels followed exactly per mind-map/09 for Login/Register; shared
  components/hooks live under `components/`/`hooks/` per the tree.
- No `any` anywhere in `frontend/src`; `npm run typecheck` and `npm run lint` clean.
- `docker compose -p meritforge build web` succeeds; the `web` service in the root
  `docker-compose.yml` is uncommented and correct.
- Each task is its own commit.
- `CLAUDE.md` "Current status" + "Plans" progress line updated to mark P5 done, next → P6 (mirroring
  the P3/P4 update style).
