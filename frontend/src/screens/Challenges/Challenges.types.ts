import type { ChallengeWithProgress, Streak, HeatmapDay } from "@/types";

/** Everything `Challenges.tsx` needs from `useChallenges` — logic lives in the hook. */
export interface ChallengesViewModel {
  /** Active challenges with the caller's current-period progress. */
  challenges: ChallengeWithProgress[];
  /** True on first load with no data yet — drives skeletons. */
  isInitialLoading: boolean;
  /** Re-fetch — passed to the section's `SectionBoundary` `onRetry`. */
  retry: () => void;
}

/** Everything the streak section needs from `useStreaks` — logic lives in the hook. */
export interface StreaksViewModel {
  /** Per-event-type streaks (used to derive the headline streak line). */
  streaks: Streak[];
  /** Day-count heatmap cells for the contribution grid. */
  heatmap: HeatmapDay[];
  /** Max `current_streak` across event types — the headline "N-day streak". */
  currentStreak: number;
  /** Max `best_streak` across event types — the "best M" figure. */
  bestStreak: number;
  /** True on first load with no data yet — drives skeletons. */
  isInitialLoading: boolean;
  /** Re-fetch — passed to the section's `SectionBoundary` `onRetry`. */
  retry: () => void;
}

/** One rendered day cell in the contribution heatmap grid. */
export interface HeatmapCell {
  /** `YYYY-MM-DD` — empty string for padding cells before the first real day. */
  date: string;
  count: number;
  /** Tailwind fill class chosen from `HEATMAP_LEVELS`. */
  className: string;
  /** True for leading padding cells that align the grid to week columns. */
  isPadding: boolean;
}
