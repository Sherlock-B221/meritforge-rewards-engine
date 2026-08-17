/** Rows requested per leaderboard page. Kept small for a snappy table. */
export const LEADERBOARD_PAGE_SIZE = 20;

/**
 * The single source of truth for a leaderboard page's SWR cache key. Anyone
 * reading or revalidating a given page MUST derive the key from here so they
 * hit the same cache entry (matches the `feedKey` pattern in `screens/Feed`).
 */
export function leaderboardKey(page: number): readonly [string, number] {
  return ["leaderboard", page] as const;
}
