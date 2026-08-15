# 03 · Data model & engine semantics

> This is **our proposed** schema + algorithms, derived from the requirements. The exact tables,
> column names, and folder placement are ours to refine — the brief grades "well-modeled DB
> schema," not a fixed one. Everything is PostgreSQL, UTC timestamps.

---

## Proposed entities

### Identity (auth domain)
- **users** — `id` (uuid PK), `username` (unique), `email` (unique), `password_hash` (bcrypt),
  `role` (`user` | `admin`), `created_at`.

### Forum domain
- **posts** — `id`, `author_id → users`, `title`, `body`, `tags` (text[]), denormalized counters
  (`comment_count`, `upvote_count`, `view_count`), `solution_comment_id → comments` (nullable),
  `created_at`.
- **comments** — `id`, `post_id → posts` (cascade), `author_id → users`,
  `parent_comment_id → comments` (self-ref, nullable → nested threads), `body`,
  `is_solution` (bool), `created_at`.
- **post_upvotes** — `(post_id, user_id)` composite PK (prevents double-upvote), `created_at`.
  *(Supports the upvote extension + wireframe upvote counts.)*

### Engine domain
- **events** — `event_id` (uuid PK, **client-generated** → idempotency), `user_id → users`,
  `event_type` (string), `payload` (jsonb), `status` (`pending` | `processed` | `failed`),
  `occurred_at` (emitter clock), `received_at` (server clock), `processed_at` (nullable),
  `error` (nullable). Doubles as the **durable job queue** (workers claim `pending` rows).
- **challenges** — `id`, `name`, `description`, `type` (`count` | `streak`), `event_type`
  (matched against events), `rule_config` (jsonb — count: `{target, window}`; streak:
  `{target_days}`), `reward` (jsonb — `{type: points, amount}` or `{type: badge, badge_code}`),
  `status` (`draft`|`active`|`expired`|`archived`), `start_at`, `end_at`, `created_by → users`,
  `created_at`, `updated_at`.
- **challenge_progress** — `id`, `challenge_id → challenges` (cascade), `user_id → users`,
  `period_key` (ISO week `"2026-W33"` for weekly; `""` for one-shot/total), `current_value`,
  `target_value`, `completed_at` (nullable — completion claimed atomically), `updated_at`.
  Unique on `(challenge_id, user_id, period_key)`.
- **user_daily_activity** — `(user_id, activity_date, event_type)` composite PK, `event_count`.
  UTC day buckets → feeds streak evaluation **and** the contribution heatmap.
- **user_streaks** — `(user_id, event_type)` composite PK, `current_streak`, `best_streak`,
  `last_activity_date`. A synthetic `event_type="contribution"` aggregates posts+comments+
  solutions for the profile/streak visual.
- **reward_ledger** — `id`, `user_id → users`, `challenge_id → challenges`, `reward_type`
  (`points` | `badge`), `amount` (nullable), `badge_code` (nullable),
  `disbursal_key` (**unique** = `"{challenge_id}:{user_id}:{period_key}"`), `created_at`.
  **Append-only; source of truth for points.** Leaderboard = `SUM(amount) … GROUP BY user_id`.

### Relationships (summary)
users 1─* posts · users 1─* comments · posts 1─* comments (cascade) · comments self-ref (nesting)
· posts *─* users via post_upvotes · events *─1 users · challenges *─1 users (creator) ·
challenge_progress: one row per (challenge, user, period) · reward_ledger append-only per
qualifying completion.

---

## Engine algorithms

### Event lifecycle (end-to-end)
1. Forum action happens (create post, comment, mark solution, upvote…).
2. Forum emits an event → `POST /api/events` with a **deterministic `event_id`** (e.g. uuid5 of
   type + entity id → same action can't double-count), `event_type`, `payload`, `occurred_at`.
3. Ingestion **inserts** the event (`status=pending`) and returns **`202`**. If the `event_id`
   already exists → return the original acknowledgement, **no reprocessing** (idempotency).
4. A **background worker** claims pending events (`SELECT … FOR UPDATE SKIP LOCKED`) and evaluates
   each in a single all-or-nothing transaction.

### Evaluation (per event, one transaction)
1. Lock the event row; if already `processed` → exit early (idempotent).
2. **Record activity** first: upsert `user_daily_activity` + advance `user_streaks` (for the
   event's type and the synthetic `contribution`).
3. Find all **active** challenges where `event_type` matches and `now ∈ [start_at, end_at)`.
4. For each matching challenge, dispatch by `type` to an **evaluator** (registry pattern):
   - **CountEvaluator** — atomic upsert increments `current_value`
     (`INSERT … ON CONFLICT DO UPDATE SET current_value = current_value + 1`). `window=weekly`
     uses the current ISO-week `period_key` (implicit Monday reset); `window=total` uses `""`.
     Complete when `current_value >= target`.
   - **StreakEvaluator** — reads the pre-computed streak from `user_streaks`, mirrors it into
     `challenge_progress`. Complete when `current_streak >= target_days`.
5. On completion: **claim it atomically** (`UPDATE … SET completed_at=now WHERE completed_at IS
   NULL` → exactly one winner), then **disburse** the reward: `INSERT INTO reward_ledger` with the
   unique `disbursal_key` (→ at-most-once).
6. Mark event `processed`; commit. Any failure rolls back the whole unit and the event is retried.

### Streak rules (UTC days)
- Same UTC day again → no change (a day counts once).
- Consecutive day (yesterday was last) → `current_streak += 1`.
- Gap, or first-ever activity → reset to `1`.
- Out-of-order/older-than-last-counted events → ignored.
- `best_streak = max(best_streak, current_streak)`.

### Idempotency (three layers)
1. **Ingest:** client `event_id` is the PK → duplicate submit is a no-op returning the original.
2. **Process:** event locked + status-checked in one transaction → processed once.
3. **Disburse:** unique `disbursal_key` per (challenge, user, period) → reward lands at most once.

### Weekly reset (no cron)
The weekly challenge's `period_key` is the current ISO week. When the week rolls over, the next
event naturally targets a fresh `challenge_progress` row → progress "resets" Monday with zero
scheduled jobs.

### Leaderboard
`SUM(reward_ledger.amount) WHERE reward_type='points' GROUP BY user_id`, ranked desc, tie-break by
username; badge count = `COUNT WHERE reward_type='badge'`. Paginated.

---

## Reference reward events (from wireframes — for seed challenges)
solution accepted **+50** · weekly challenge complete **+150** · thread reached 25 upvotes **+30**
· 7-day streak bonus **+20** · per-answer **+50**. Badges: **First Solution**, **10 Answers**,
**Week Streak**. Use these to seed demo challenges so the UI matches the wireframes.
