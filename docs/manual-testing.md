# Manual testing — key flows

A short, flow-oriented checklist to verify the deployed app. For the exhaustive
case-by-case version, see the hosted test plan.

- **App:** https://frontend-sigma-sand-38.vercel.app
- **API:** https://meritforge-api.onrender.com/api

> **Warm up first.** The backend is on Render's free tier and sleeps when idle. Open the API
> health URL until it returns `{"status":"ok"}` before timing anything; the first hit after a
> quiet spell can take ~30–60s or return a one-off `502` (just retry).

---

## Setup (only needed for the engine + challenge flows)

```bash
API=https://meritforge-api.onrender.com/api

# A normal user token (register in the UI first, or via /auth/register)
TOKEN=$(curl -sS -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"YOURUSER","password":"YOURPASS"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('token') or d.get('access_token'))")
```

**Admin** is set by a direct DB write (no admin-promotion API, by design). Try logging into the
app as `admin` / `admin12345` first; if that fails the prod DB wasn't seeded — create your own:

```bash
curl -sS -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"username":"qaadmin","email":"qaadmin@example.com","password":"password123"}'

# Promote in Postgres (get the External Database URL from the Render dashboard):
psql "<RENDER_EXTERNAL_DATABASE_URL>" \
  -c "UPDATE users SET role='admin' WHERE username='qaadmin';"

# Re-login AFTER promotion (the JWT embeds the role):
ADMIN_TOKEN=$(curl -sS -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"qaadmin","password":"password123"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('token') or d.get('access_token'))")
```

**Provision two active challenges** (points + weekly), so the Challenges page and weekly widget
have data:

```bash
# Points challenge — completes after 3 `verify_points_evt` events
curl -sS -X POST $API/admin/challenges -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{
  "name":"Verify Points Reward","description":"Fire 3 events to earn points",
  "type":"count","event_type":"verify_points_evt","rule_config":{"target":3,"window":"total"},
  "reward":{"type":"points","amount":250},
  "start_at":"2026-08-17T00:00:00Z","end_at":"2027-01-01T00:00:00Z"}'

# Weekly challenge — progresses when you comment in the UI (`comment_posted`)
curl -sS -X POST $API/admin/challenges -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{
  "name":"Post 3 Answers This Week","description":"Comment 3 times this week",
  "type":"count","event_type":"comment_posted","rule_config":{"target":3,"window":"weekly"},
  "reward":{"type":"points","amount":150},
  "start_at":"2026-08-17T00:00:00Z","end_at":"2027-01-01T00:00:00Z"}'

# Each POST returns an id in `draft` — activate it:
curl -sS -X PATCH $API/admin/challenges/<CHALLENGE_ID> -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"active"}'
```

---

## 1. Auth & access control

1. Register a new account in the app → you land in the feed; a refresh keeps you signed in.
2. Log out → redirected to Login. Visiting `/feed` while signed out → redirected to Login.
3. Non-admin is blocked from admin routes:
   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" $API/admin/challenges -H "Authorization: Bearer $TOKEN"   # 403
   ```

## 2. Forum core — post, comment, reply, solution

1. **Create post (optimistic + tags):** "Start a post…", add a title, a tag or two, a body, Post →
   appears at the **top instantly**, still there after refresh.
2. **Rollback:** DevTools › Network › **Offline**, submit a post → it appears then **rolls back**
   with an error toast. Set Online again.
3. Open the thread → breadcrumb, avatar + `@handle`, tag chips, **markdown-rendered** body.
4. **Comment (optimistic):** bottom composer → Comment → appears instantly.
5. **Reply (nested):** click **Reply** on a comment → inline box → reply appears **indented under
   that comment**.
6. **Mark solution (owner only):** on a thread **you** authored, "Mark as solution" on a comment →
   it moves into a green **Accepted solution** card and the thread shows ✓ solved. On someone
   else's thread the control is **not** shown.

## 3. ⭐ Full rewards-engine flow (the core requirement)

Emit event → `202` → async job evaluates → progress updates → reward disbursed, idempotently.

```bash
# 3 unique events for the points challenge
for i in 1 2 3; do
  EID=$(python3 -c "import uuid;print(uuid.uuid4())")
  curl -sS -X POST $API/events -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"event_id\":\"$EID\",\"event_type\":\"verify_points_evt\",\"payload\":{}}" -w ' [%{http_code}]\n' -o /dev/null
done
```

- Each returns **`202`** with `{"event_id":"…","status":"pending"}` — ingestion never waits.
- Progress lands via the background worker (read a couple of times; it may briefly lag):
  ```bash
  curl -sS $API/challenges           -H "Authorization: Bearer $TOKEN"   # progress -> 3/3
  curl -sS $API/users/me/rewards     -H "Authorization: Bearer $TOKEN"   # +250 pts reward row
  ```
- **Idempotency:** re-POST one of the same `event_id`s → returns the original response, **not**
  reprocessed (progress doesn't double-count).
- **At-most-once:** emit extra `verify_points_evt` past completion → **no** second reward.

## 4. Challenges & progress (data-viz + polling)

1. Open `/challenges` → active challenges as **Recharts progress rings**; a **streak heatmap** with
   a Less→More legend (real charting lib, not a bar).
2. **30s live polling:** keep the page open and, in the app, comment on a thread (moves the weekly
   challenge). **Without refreshing**, the ring ticks up within ~30s.
3. Hard-refresh → **skeletons** first (no spinners). Offline + retry → section shows a graceful
   **error fallback** while the rest of the page stays usable.

## 5. Weekly widget · Profile · Leaderboard

1. **Weekly widget** is present in the right rail on **all 5 pages**; shows the challenge, an
   n/target ring, reward, and a **"Resets in Xd Yh"** countdown (targets Monday 00:00 UTC). Its
   progress advances live via polling.
2. **Profile:** avatar + streak/rank pills, **total points** hero, badge medallions (earned lit /
   locked grey), and a **paginated reward ledger** (When · Challenge · +reward).
3. **Leaderboard** (`/leaderboard`): ranked by points, paginated, medals on top 3, your row
   highlighted with **(you)**.

## 6. Cross-cutting must-haves (quick pass)

- **URL state:** change sort + page on the feed → both live in the URL; the link is shareable and
  **Back** restores state.
- **Responsive:** narrow below ~760px → sidebar becomes a top bar + bottom tabs, right rail hides
  (weekly shows as a banner), **no horizontal scroll**.
- **Active nav + logout** stay visible while scrolling a tall page.

## 7. Bonus — rate limiting

Default is 60 events / 60s per user. Fire past it to see the `429`:

```bash
for i in $(seq 1 65); do
  EID=$(python3 -c "import uuid;print(uuid.uuid4())")
  curl -sS -o /dev/null -w "%{http_code} " -X POST $API/events -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -d "{\"event_id\":\"$EID\",\"event_type\":\"noop_evt\",\"payload\":{}}"
done; echo
```

Early requests return `202`; once over the limit you get `429` with
`{"error":{"code":"RATE_LIMITED",…}}` and a `Retry-After` header.
