/** SWR cache key for the caller's streaks + heatmap (shared with `screens/Challenges`). */
export const PROFILE_STREAKS_KEY = "/users/me/streaks" as const;

/**
 * Leaderboard page size used ONLY for the profile-header composition (rank /
 * total points / badge count). Matches the brief's exact contract: fetch page
 * 1 with a 100-row limit and locate the current user within it — if they're
 * not present (no rewards yet), the header degrades gracefully.
 */
export const PROFILE_LEADERBOARD_PAGE = 1;
export const PROFILE_LEADERBOARD_LIMIT = 100;

/** SWR cache key for the profile header's leaderboard lookup. */
export const PROFILE_LEADERBOARD_KEY = [
  "leaderboard",
  PROFILE_LEADERBOARD_PAGE,
  PROFILE_LEADERBOARD_LIMIT,
] as const;

/** Rows requested per reward-ledger page. Kept small for a snappy table. */
export const REWARDS_PAGE_SIZE = 20;

/**
 * The single source of truth for a reward-ledger page's SWR cache key.
 * Anyone reading or revalidating a given page MUST derive the key from here.
 */
export function rewardsKey(page: number): readonly [string, number] {
  return ["users-me-rewards", page] as const;
}

/** Placeholder shown for rank/points/badges when the user has no leaderboard entry yet. */
export const NO_RANK_PLACEHOLDER = "—";
