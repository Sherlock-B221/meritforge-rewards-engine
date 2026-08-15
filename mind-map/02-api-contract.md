# 02 · API contract

- **Base path:** `/api`
- **Format:** JSON request/response bodies.
- **Auth:** JWT bearer token; all non-auth endpoints require it. Admin endpoints → `403` for
  non-admins.
- **Errors:** consistent, structured envelope (shape is our choice — documented below).

## Error envelope (our choice)

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message",
    "details": { "field": "optional context" }
  }
}
```

Representative codes: `INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `EMAIL_TAKEN`, `UNAUTHORIZED`,
`INVALID_TOKEN`, `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_POST_OWNER`, `NOT_FOUND`, `VALIDATION_ERROR`,
`RATE_LIMITED`, `INVALID_STATUS_TRANSITION`, `UNKNOWN_CHALLENGE`.

---

## Auth

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Returns token + user |
| POST | `/auth/login` | Public | Returns token + user |
| GET | `/auth/me` | User | Current user + role |

## Forum

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/posts` | User | Paginated. Query: `sort=latest\|trending`, `page`, `limit` |
| POST | `/posts` | User | Create thread. Emits `post_created` |
| GET | `/posts/:id` | User | Thread + nested comments. Emits `post_viewed` |
| POST | `/posts/:id/comments` | User | Add comment (optional `parent_comment_id`). Emits `comment_posted` |
| PATCH | `/posts/:id/solution/:commentId` | User (**post owner only**) | Mark solution. Emits `solution_marked` |

> **All endpoints require auth (D15):** every forum read + write requires authentication, per the
> brief. SSR/SEO therefore applies to genuinely public pages only (landing + login/register); the
> architecture stays SSR-ready if we choose to expose public reads later.
>
> Bonus/extension: `POST /posts/:id/upvote` (emits `post_upvoted`) to power upvote-based challenges
> and the wireframe's upvote counts. Mark clearly as an extension in docs.

## Events

| Method | Path | Auth | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `/events` | User | `event_id`, `event_type`, `payload` | **`202 Accepted`**. Idempotent on `event_id`. Rate-limited (bonus). |

## Challenges — Admin

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/admin/challenges` | Admin | Create challenge from config |
| GET | `/admin/challenges` | Admin | List; optional `?status=` filter |
| PATCH | `/admin/challenges/:id` | Admin | Update challenge (config / status transition) |
| DELETE | `/admin/challenges/:id` | Admin | **Archives** (soft) the challenge |

## Challenges — User

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/challenges` | User | Active challenges **with current user's progress** |
| GET | `/challenges/weekly` | User | Current weekly challenge + user progress (+ `resets_at`) |

## Progress & streaks

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/users/me/progress` | User | All challenge progress for current user |
| GET | `/users/me/streaks` | User | Streak history + current streak count (feeds the heatmap) |

## Rewards

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/users/me/rewards` | User | Paginated reward ledger |

## Leaderboard (bonus)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/leaderboard` | User | Users ranked by total points, paginated |

---

## Conventions

- **Pagination:** `page` (1-based) + `limit`; responses carry `items` + total/next info. Pick a
  sensible default limit (e.g. 10–20) and a max cap.
- **Sorting:** feed `sort=latest` (by `created_at` desc) vs `trending` (engagement score, e.g.
  upvotes/comments over recency — document the formula).
- **`202` bodies:** the events endpoint returns an accepted-acknowledgement (echo `event_id` +
  status); progress becomes visible via the polling endpoints once the job runs.
- **Timestamps:** ISO-8601 UTC in all payloads.
