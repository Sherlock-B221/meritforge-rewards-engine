import type { Reward } from "@/types";

/**
 * Composed profile header stats. `rank` / `totalPoints` / `badgeCount` come
 * from locating the current user's row in `getLeaderboard({page:1,limit:100})`
 * — when they're not present yet (no rewards earned), the header degrades
 * gracefully: `rank` is `null` (rendered as "—"), `totalPoints`/`badgeCount`
 * are `0`. `currentStreak` is the max `current_streak` across `getStreaks()`.
 * Join date is intentionally omitted — the backend does not expose one.
 */
export interface ProfileHeaderStats {
  rank: number | null;
  totalPoints: number;
  badgeCount: number;
  currentStreak: number;
}

/** Everything the header section needs from `useProfileHeader` — logic lives in the hook. */
export interface ProfileHeaderViewModel {
  displayName: string;
  username: string;
  stats: ProfileHeaderStats;
  /** Unique badge codes earned, derived from the loaded reward-ledger page. */
  badgeCodes: string[];
  isInitialLoading: boolean;
  retry: () => void;
}

/** Everything the reward-ledger section needs from `useRewardsLedger` — logic lives in the hook. */
export interface RewardsLedgerViewModel {
  rewards: Reward[];
  isInitialLoading: boolean;
  hasNext: boolean;
  retry: () => void;
}
