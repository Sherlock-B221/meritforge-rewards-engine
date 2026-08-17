import type { LeaderboardEntry } from "@/types";

/** Everything `LeaderboardContent` needs from `useLeaderboard` — logic lives in the hook. */
export interface LeaderboardViewModel {
  /** Ranked rows for the current page. */
  entries: LeaderboardEntry[];
  /** True on first load with no data yet — drives skeleton rows. */
  isInitialLoading: boolean;
  /** Whether a next page exists (from the API's `has_next`). */
  hasNext: boolean;
  /** The logged-in user's id, or `null` if signed out — drives row highlight. */
  currentUserId: string | null;
}
