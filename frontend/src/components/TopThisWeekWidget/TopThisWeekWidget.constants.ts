/**
 * The single source of truth for this widget's SWR cache key. Deliberately
 * DISTINCT from `leaderboardKey` (screens/Leaderboard) — this widget always
 * fetches page 1 (top 5) and must not share a cache entry with, or be
 * invalidated by, the full paginated Leaderboard screen.
 */
export const topThisWeekKey = ["top-this-week"] as const;

/** Rows requested for the mini-leaderboard — top of the board only. */
export const TOP_THIS_WEEK_LIMIT = 5;
