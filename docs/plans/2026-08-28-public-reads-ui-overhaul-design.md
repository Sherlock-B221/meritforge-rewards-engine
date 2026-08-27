# Design · Public reads + SSR/SEO + UI overhaul & gamification

**Date:** 2026-08-28
**Branch:** `feat/public-reads-ui-overhaul`
**Status:** design — awaiting review before implementation plan
**Supersedes decision:** re-reverses **D15** ("all forum reads require auth") back toward the
original **AD-9 / D13** intent ("public pages = RSC + `generateMetadata`; architecture stays
SSR-ready so public reads can be exposed later with minimal change").

---

## 1 · Goal & motivation

meritforge is a **developer community forum**. Today every forum read is auth-gated (a deliberate
"brief-literal" choice, D15). For a community platform that's the wrong posture: the content that
gives the site its value — threads and their discussion — should be **publicly readable, crawlable,
and shareable**, while anything that **writes** or is **user-specific** stays behind auth. This is
exactly the surface AD-9 was designed to enable "later with minimal change."

Two workstreams, one branch:

1. **Public reads + SSR/SEO** — expose the read-only, non-user-specific forum surface to anonymous
   visitors, server-rendered for SEO; intercept every *write* attempt with a polished login popup
   that, after auth, **replays the attempted action**.
2. **UI overhaul + light gamification** — a dramatically better visual system (typography, palette,
   depth, dark mode) and tasteful game mechanics (levels/XP, streak flame, leaderboard podium,
   reward celebrations).

**Hard invariant (user-stated):** the **architecture and folder structure stay the same**. This
work *completes* the already-designed SSR/screens-pattern path; it does not restructure the modular
monolith, the layered backend, the screens pattern, the barrels, the single API client, or the
error envelope. No contract breaks.

---

## 2 · Locked decisions (from brainstorming)

| # | Decision |
| --- | --- |
| **PR-1** | **Public + SSR/SEO surface = Feed, Post-detail (+comments), Leaderboard.** Challenges and Profile **stay logged-in-only.** |
| **PR-2** | Anonymous write attempts (upvote / comment / create post / mark-solution) open a **login+signup popup** that, on success, **replays the attempted action**. |
| **PR-3** | Routing = **Approach A** — split into a public route group `(public)/` and the gated `(app)/`, sharing one `<AppShell>`. URLs are unchanged. |
| **PR-4** | Typography = **Geist body/UI + Geist Mono code + Space Grotesk display** (headings), plus a real type scale & hierarchy. |
| **PR-5** | Enhancements in scope: **dark mode + toggle**, **levels/XP** (frontend-derived), **celebrations + motion** (incl. `canvas-confetti`, pinned), **leaderboard podium**. |
| **PR-6** | Since challenges stay gated, `/challenges/weekly` stays auth-only; the **right rail shows a logged-out CTA + the public Top-this-week peek** for anonymous users. |
| **PR-7** | Levels/XP are **derived on the frontend** from the points total — **no schema/API change**. |

**Out of scope:** prod re-seed / redeploy (needs credentials), public profile pages (would need a
new public user endpoint), a real rich-text editor (still open question O5).

---

## 3 · Backend design

The backend change is surgical and additive. **No response schema changes. No contract breaks.**

### 3.1 New optional-auth dependency

Add to `backend/app/controllers/deps.py`, mirroring `get_current_principal` (deps.py:11) but
non-raising:

```python
async def get_optional_principal(
    authorization: str | None = Header(default=None),
) -> Principal | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    try:
        return decode_token(authorization.split(" ", 1)[1])
    except UnauthorizedError:
        return None
```

`decode_token` (`services/auth/security.py:40`) already raises `UnauthorizedError` on
expired/invalid tokens — we swallow it and return `None`. A *malformed but present* token therefore
degrades to anonymous rather than erroring, which is the correct behavior for a public read
(a stale token shouldn't 401 a public page).

### 3.2 Endpoint changes (only these three)

| Endpoint | File | Change |
| --- | --- | --- |
| `GET /posts` | `controllers/posts_controller.py` | `principal: Principal = Depends(require_user)` → `principal: Principal \| None = Depends(get_optional_principal)` |
| `GET /posts/{post_id}` | `controllers/posts_controller.py` | same swap; pass `viewer_id = principal.user_id if principal else None` into the service |
| `GET /leaderboard` | `controllers/challenges_controller.py` | drop the unused `principal` param entirely → fully public |

Everything else is **unchanged and still gated**: `POST /posts`, `POST /posts/{id}/comments`,
`PATCH /posts/{id}/solution/{commentId}`, `POST /posts/{id}/upvote`, `POST /events`, all
`/admin/*`, all `/users/me/*`, `GET /challenges`, `GET /challenges/weekly`.

### 3.3 `post_viewed` nuance (anonymous views emit nothing)

`services/forum/posts_service.py:view_post` (≈:76-92) publishes `post_viewed` with `user_id=viewer_id`.
`publish_event` requires a non-null `user_id`. Change:

- Signature → `viewer_id: uuid.UUID | None`.
- **Guard:** only `publish_event(...)` when `viewer_id is not None`. Anonymous views return the post
  detail with **no event emitted** (an anonymous view can't be attributed and must not affect any
  challenge). Logged-in views behave **exactly as today**.

### 3.4 Feed-list per-user fields

Verify during implementation that the `GET /posts` list service composes **no per-user fields**
(e.g. "have I upvoted"). Mapping shows it returns public post summaries (counts are public). If any
per-user field exists, it must tolerate `principal is None` (return the anonymous/`false` default).
The feed's *upvote button* for anonymous users triggers the login popup, so no per-user upvote state
is needed server-side for anon.

### 3.5 CORS / infra

No change. Same origin set; no new hosts. The public endpoints are the same base path `/api`.

### 3.6 Backend tests (added)

- `GET /posts` → **200 without** an `Authorization` header.
- `GET /posts/{id}` → **200 without** a token; assert **no `events` row** is created for the anon
  view; assert a **logged-in** view **still** emits `post_viewed`.
- `GET /leaderboard` → **200 without** a token.
- `POST /posts`, `POST /comments`, `POST /upvote`, `PATCH /solution`, `POST /events` → **still 401**
  without a token (regression guard — writes stay gated).
- A *malformed* bearer token on a public GET degrades to anonymous (200), not 401.
- Existing suite (121+ tests) stays green.

---

## 4 · Frontend — routing & shell (Approach A)

### 4.1 Route groups

```
src/app/
├── layout.tsx                 # root; Providers (adds ThemeProvider); default metadata
├── page.tsx                   # landing (unchanged public)
├── sitemap.ts                 # NEW — SEO
├── robots.ts                  # NEW — SEO
│
├── (auth)/                    # UNCHANGED — login / register full pages
│   ├── login/page.tsx
│   └── register/page.tsx
│
├── (public)/                  # NEW GROUP — public reads, server-rendered
│   ├── layout.tsx             # PublicShell → <AppShell gated={false}>  (NO redirect)
│   ├── feed/page.tsx          # server: generateMetadata + loader
│   ├── posts/[id]/page.tsx    # server: per-thread generateMetadata + loader
│   └── leaderboard/page.tsx   # server: generateMetadata + loader
│
└── (app)/                     # gated — writes + user-specific
    ├── layout.tsx             # GatedShell → <AppShell gated>  (useRequireAuth)
    ├── posts/new/page.tsx
    ├── challenges/page.tsx
    └── u/[username]/page.tsx
```

**Route groups do not affect URLs** — `/feed`, `/posts/[id]`, `/leaderboard`, `/posts/new`,
`/challenges`, `/u/[username]` are all exactly as before. The screens pattern is untouched; only the
three read `page.tsx` files move folders and become server components.

### 4.2 Shared `<AppShell>` (promoted layout component)

Two layouts now render the same chrome, so extract today's `(app)/layout.tsx` body into
`components/layout/AppShell/` (promote-on-2nd-use rule satisfied — two consumers). `AppShell` is a
`"use client"` component (Sidebar/RightRail read the auth store) that renders
`MobileNav + Sidebar + <main>{children}</main> + RightRail`.

- **Client layout wrapping server pages is valid in App Router:** the server `page.tsx` is rendered
  to HTML and passed to the client layout as `children`; its content is in the initial HTML (SEO
  intact) and the client shell hydrates around it.
- `(app)/layout.tsx` calls `useRequireAuth()` (redirect to `/login` if unauthenticated) — unchanged
  gate, just relocated to wrap `<AppShell gated>`.
- `(public)/layout.tsx` renders `<AppShell gated={false}>` — **no redirect**; renders for everyone.

### 4.3 Anonymous-state handling in the shell

`AppShell` and its children must render gracefully when `user === null`:

- **Sidebar** (`components/layout/Sidebar/Sidebar.tsx`): when logged out, replace the user footer
  (avatar + username + logout) with a **"Log in / Sign up"** button that opens the auth popup. The
  "New Post" nav button, when logged out, opens the popup (via the auth-guard, §5) rather than
  routing to `/posts/new`. Nav items that point at gated pages (Challenges, Profile) either hide or
  open the popup when logged out — **decision: show them but open the popup on click** (discoverable,
  invites signup).
- **RightRail** (`components/layout/RightRail/RightRail.tsx`): when logged out, render the
  **Top-this-week** widget (runs off the now-public `/leaderboard`) + a compact **"Join the
  community — earn points & badges"** CTA card, and **omit** the personal `WeeklyChallengeWidget`
  (it needs the gated `/challenges/weekly`). When logged in, unchanged (weekly widget + top-this-week).

---

## 5 · Login popup + action replay (PR-2)

### 5.1 Auth-modal store

New `src/store/authModalStore.ts` (Zustand), sibling to `authStore.ts`:

```
state:  isOpen: boolean
        mode: 'login' | 'register'
        pendingIntent: (() => void | Promise<void>) | null
actions: open(intent?: () => void | Promise<void>, mode?): void   // sets pendingIntent, opens
         close(): void                                             // clears intent, closes
         setMode(mode): void
         runPendingIntentAndClose(): Promise<void>                 // run intent (if any), then close
```

### 5.2 `useAuthGuard()` — the single interception point

New `src/hooks/useAuthGuard.ts`:

```
const guard = (action: () => void | Promise<void>) =>
  useAuthStore.getState().token ? action() : authModal.open(action);
```

Every write entry point wraps its action in `guard(...)`. This is the **one** place the
authed/anon branch lives — no scattered checks.

Wiring (all existing hooks/handlers, minimal change — wrap the call site, keep the optimistic logic):

| Action | Where | Change |
| --- | --- | --- |
| Upvote | `hooks/useUpvote.ts` (Feed `PostRow`, PostDetail) | wrap the mutate call in `guard` |
| Create post | `hooks/useCreatePost.ts` (Feed composer, `/posts/new`) | wrap submit in `guard`; the intent closure captures the current draft so replay posts it |
| Comment / reply | `screens/PostDetail/useOptimisticComment.ts` | wrap submit in `guard`; intent captures the comment body + `parent_comment_id` |
| Mark solution | `screens/PostDetail/useScreen.ts` (markSolution) | wrap in `guard` |

Because the pending intent is a **closure over the current input**, replay re-runs the *same* action
(same draft, same upvote target) after login — the seamless flow PR-2 asks for.

### 5.3 `AuthForm` (promoted shared component) + Dialog

Promote the form body currently living in `screens/Login/Screen.tsx` and `screens/Register/Screen.tsx`
into one `components/auth/AuthForm/` component: fields + submit + field-level error mapping, driven by
a `mode` prop with an in-form **switch link** (login ⇄ register). `onSuccess` callback varies by host.

- **Full pages** (`(auth)/login`, `(auth)/register`) — unchanged routes; their `Screen.tsx` becomes a
  thin wrapper: `<AuthForm mode="login" onSuccess={() => router.push('/feed')} />`. SSR + metadata
  preserved.
- **Popup** — new `components/auth/AuthModal/` renders `<Dialog>` + `<AuthForm mode={modal.mode}
  onSuccess={modal.runPendingIntentAndClose} />`. Mounted once at the app root (in `Providers`), so
  it's available on public *and* gated pages. On success: `setSession` (existing) → run pending
  intent → close.

### 5.4 Correctness notes

- **No double-submit:** intent runs **once** then is cleared on close; the modal closes on success.
- **401 path untouched:** `apiClient`'s existing 401→`clearSession()`+redirect for expired sessions
  stays. The popup is only for the *anonymous-attempts-a-write* case, gated before the request is
  sent.
- **Idempotency:** upvote is unique per `(post, user)` server-side; create-post/comment replay runs
  exactly once. No new idempotency reasoning needed.

---

## 6 · SSR/SEO for the three public pages (PR-1)

Each public page adopts the designed server shape (`09-frontend-structure.md` §"How the screens
pattern adapts to App Router + SSR"): thin **server** `page.tsx` (`generateMetadata` + `*.loader.ts`
call + render `Screen` with `initialData`), with interactivity in `"use client"` islands.

### 6.1 Server-safe data loader

Loaders must fetch **without** touching the client auth store (Zustand module state on the server is
a known SSR footgun). Add a minimal **server fetch helper** (`services/serverFetch.ts`) that calls
the API base URL anonymously (no `Authorization` header) — exactly the crawler's view. The client
then hydrates with SWR (with the token, if logged in) to layer in any per-user bits.

### 6.2 Per-page

- **Feed** (`screens/Feed`): add `Feed.loader.ts` (server fetch of first page of `/posts` for the
  current `sort`), `generateMetadata` (site title + description). `Feed.tsx` renders the server list
  for first paint; the existing `useFeed` (SWR + URL state + optimistic) hydrates as the client
  island and takes over polling/sorting/search. **URL feed state, skeletons, optimistic create — all
  preserved** (they move into the island).
- **PostDetail** (`screens/PostDetail`): add `PostDetail.loader.ts` (server fetch `/posts/{id}` incl.
  comments), **per-thread `generateMetadata`** (title = post title, description = excerpt, OpenGraph)
  — the biggest SEO win. Server-render the post + comment tree as crawlable HTML; upvote / comment
  box / mark-solution / optimistic comment hydrate as islands (each wrapped by the §5 auth-guard).
- **Leaderboard** (`screens/Leaderboard`): add `Leaderboard.loader.ts` (server fetch `/leaderboard`
  page 1) + `generateMetadata`. Podium + table render server-side; pagination + self-row highlight
  hydrate client-side (self-highlight only when logged in).

### 6.3 SEO plumbing

- `app/sitemap.ts` — landing, `/feed`, `/leaderboard`, and per-thread `/posts/[id]` (fetch ids
  server-side).
- `app/robots.ts` — allow public routes; disallow `/posts/new`, `/challenges`, `/u/*`, `/api`.
- Semantic HTML + heading hierarchy on the public pages.

---

## 7 · Design system & typography (PR-4)

### 7.1 Fonts

- Add **Space Grotesk** via `next/font/google` in `app/layout.tsx`, exposed as `--font-space-grotesk`.
- In `globals.css` `@theme`: `--font-heading: var(--font-space-grotesk)` (was `var(--font-sans)`).
  Geist stays `--font-sans` (body/UI); Geist Mono stays `--font-mono` (code).

### 7.2 Type scale

Define an explicit, hierarchical scale (heading font on display/headings, sans on body). Target
values (tune during the visual checkpoint):

| Role | Size / line-height / weight / tracking | Font |
| --- | --- | --- |
| Display | 3rem / 1.05 / 700 / -0.03em | Space Grotesk |
| H1 | 2.25rem / 1.1 / 700 / -0.02em | Space Grotesk |
| H2 | 1.75rem / 1.15 / 600 / -0.02em | Space Grotesk |
| H3 | 1.35rem / 1.2 / 600 / -0.01em | Space Grotesk |
| Body-lg | 1.0625rem / 1.6 / 400 | Geist |
| Body | 1rem / 1.6 / 400 | Geist |
| Caption | 0.8125rem / 1.4 / 500 | Geist |

Implemented as a small set of heading utility classes / a `Heading` primitive + Tailwind text
utilities; constants (not inlined) where reused.

### 7.3 Palette, depth, tokens

- Keep the brand blue (`--primary: oklch(0.58 0.21 258)`); refine neutrals; introduce **elevation**
  (layered surface tokens + softer, layered shadows; crisper borders; better focus rings).
- Add a few **semantic gamification tokens** (OKLch, both themes): `--reward` (gold/amber),
  `--streak` (flame orange), reuse `--success` for completion. Chart tokens already exist.
- All tokens stay in the existing `:root` / `.dark` OKLch system in `globals.css` — no new color
  methodology.

### 7.4 Dark mode

- Complete the `.dark` token block with the refined palette.
- Wrap the app in `next-themes` `ThemeProvider` (in `providers.tsx`; the lib is already installed and
  `sonner` already consumes it), default `system`.
- Add a **theme toggle** (sun/moon, `lucide-react`) in the shell (Sidebar header / top of rail).

### 7.5 New UI primitives (base-ui, matching existing CVA style in `components/ui/`)

- **Dialog** (`@base-ui/react/dialog`) — required for the login popup (and reusable).
- **Badge** — proper component with variants (tag / reward / level / rank) replacing today's inline
  styled spans.
- **Tooltip** (`@base-ui/react/tooltip`) — for streak/level/badge hovers.
- (Optional) **Tabs** (`@base-ui/react/tabs`) — only if we promote the existing inline feed-sort /
  write-preview toggles; otherwise leave them.

---

## 8 · Gamification (PR-5, PR-7)

All tasteful and additive; **no backend/schema/API change** (PR-7).

- **Levels / XP (frontend-derived).** `constants/levels.ts` defines tiers + a pure
  `getLevel(points) → { tier, label, floor, next, progress }`. Rendered as: a level chip + "progress
  to next level" bar on the **Profile** header and a compact form in the **Sidebar** user footer;
  optional small level chip beside leaderboard names. Pure function → trivially testable.
- **Animated streak flame.** A flame (SVG/`lucide` + CSS) that scales/pulses with streak length,
  with a **count-up** on the streak number. Lives on the Challenges streak headline + Profile.
- **Leaderboard podium.** Top-3 rendered as a raised 2-1-3 podium above the ranked table; richer rank
  badges (replace today's hardcoded medal colors with the semantic tokens). Self-row highlight kept.
- **Reward celebration.** Add `canvas-confetti` (pinned exact version). New
  `hooks/useRewardCelebration.ts`: polls `/users/me/rewards` (30s, `constants/polling.ts`), diffs
  against a ref of previously-seen reward ids; on a **new** reward, fire `canvas-confetti` + a
  celebratory `sonner` toast (e.g. "🎉 +50 points — 'First Blood' badge earned"). Mounted **once in
  the gated `AppShell`** (logged-in only), so celebrations trigger anywhere in the authed app. Import
  confetti client-side only (no SSR). CSS-only fallback documented but the dep is approved.

---

## 9 · What stays exactly the same (invariants)

- **Backend:** modular monolith; layered controllers→services→models; `AppError`→one envelope; the
  entire engine (outbox, worker, evaluators, rewards, idempotency-at-three-layers); every response
  schema; every gated endpoint's gate.
- **Frontend:** screens pattern (`screens/<Name>/` = Screen + hook + constants + types + local
  components + barrel); shared-on-2nd-use promotion; one `apiClient` (one base URL, token attach,
  401→login); Zustand auth store + localStorage `meritforge.auth`; SWR as the data layer.
- **Every P6 graded behavior:** optimistic UI (post + comment), 30s polling, URL-encoded feed state
  (shareable + back-button), skeletons (no spinners), `SectionBoundary` on every fetch surface,
  single-responsibility hooks, persistent weekly widget (Monday reset), Recharts viz. These move into
  islands where a page becomes SSR but are **not removed**.

---

## 10 · Testing & verification

- **Backend:** the §3.6 test additions; full pytest suite green; ruff clean.
- **Frontend:** `npm run typecheck` + `lint` + `build` green — all routes compile, incl. the new
  `(public)` group, `sitemap.ts`, `robots.ts`.
- **SSR proof:** view-source / curl a public thread → post title + body + comments present in the
  **initial HTML**; `generateMetadata` emits per-thread `<title>`/OG.
- **Visual checkpoint (early):** build the design system + **one** hero page first, screenshot via
  the browser tools, confirm direction with the user, *then* roll across all pages. (Browser
  automation is available this session — unlike the parity-remediation session.)
- **End-to-end flow (manual/browser):** anonymous → browse `/feed` → open a thread → click upvote →
  **login popup** → authenticate → **upvote replays** → now-authed shell shows user + widgets +
  weekly challenge; dark-mode toggle; reward celebration (trigger via the engine/seed).

---

## 11 · Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Zustand store read during SSR (shared module state) | Loaders use `serverFetch.ts` (no store); token is never set on the server. |
| Client shell layout hiding server-page HTML from crawlers | Verified pattern: client layout receives already-server-rendered `children`; assert content in view-source. |
| Intent-replay double-submits a post | Intent runs once, cleared on close; modal closes on success. |
| Moving 3 route folders breaks imports/URLs | Route groups don't change URLs; screens/barrels unchanged; typecheck+build gate. |
| `canvas-confetti` in SSR bundle | Dynamic/client-only import; pinned exact version (supply-chain rule). |
| Feed-list per-user field assumes a user | §3.4 verify + null-tolerant default. |
| Weekly widget on public pages needs gated data | PR-6: hide personal widget for anon; show CTA + public Top-this-week. |

---

## 12 · Rollout (phase sketch — detailed in the implementation plan)

1. **BE public reads** — `get_optional_principal`, endpoint swaps, `post_viewed` guard, tests.
2. **FE routing** — `(public)` group, shared `AppShell`, anon Sidebar/RightRail, gate relocation.
3. **Auth popup** — `authModalStore`, `useAuthGuard`, `AuthForm` promotion, `AuthModal`, wire write
   actions to replay.
4. **SSR/SEO** — loaders + `generateMetadata` for Feed/PostDetail/Leaderboard, `sitemap`/`robots`,
   server-fetch helper.
5. **Design system** — Space Grotesk + type scale, palette/depth refine, dark mode + toggle, new
   primitives (Dialog/Badge/Tooltip).
6. **Gamification** — levels/XP, streak flame + count-up, podium, reward celebration.
7. **Polish + verify** — visual checkpoint, roll design across all pages, full test/typecheck/build,
   e2e flow, screenshots.

(Implementation plan with per-phase tasks + verification follows via the writing-plans step.)
