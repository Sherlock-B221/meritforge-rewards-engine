/**
 * Engine (challenges/progress/rewards) types — mirror
 * `backend/app/schemas/engine.py` exactly. Only the shapes P5 needs
 * (`GET /challenges/weekly`) are modeled here; the rest of the engine reads
 * land with the screens that need them in P6.
 */

export type ChallengeType = "count" | "streak";

export type RewardConfig =
  | { type: "points"; amount: number }
  | { type: "badge"; badge_code: string };

export interface ChallengeProgress {
  period_key: string;
  current_value: number;
  target_value: number;
  completed: boolean;
}

/** `GET /challenges/weekly` → 200. 404 `NOT_FOUND` means no active weekly challenge. */
export interface WeeklyChallenge {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  event_type: string;
  rule_config: Record<string, unknown>;
  reward: RewardConfig;
  start_at: string;
  end_at: string;
  progress: ChallengeProgress;
  resets_at: string;
}

/**
 * `GET /challenges` → 200 `ChallengeWithProgress[]` (PLAIN ARRAY, not paginated).
 * An active challenge plus the caller's current-period progress toward it.
 */
export interface ChallengeWithProgress {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  event_type: string;
  rule_config: Record<string, unknown>;
  reward: RewardConfig;
  start_at: string;
  end_at: string;
  progress: ChallengeProgress;
}

/**
 * `GET /users/me/progress` → 200 `ProgressEntry[]` (PLAIN ARRAY). A flattened,
 * per-challenge progress row for the current period.
 */
export interface ProgressEntry {
  challenge_id: string;
  challenge_name: string;
  type: ChallengeType;
  event_type: string;
  period_key: string;
  current_value: number;
  target_value: number;
  completed: boolean;
  completed_at: string | null;
}

/** One event-type streak for the current user. Dates are `YYYY-MM-DD`. */
export interface Streak {
  event_type: string;
  current_streak: number;
  best_streak: number;
  last_activity_date: string | null;
}

/** One day of the contribution heatmap. `activity_date` is `YYYY-MM-DD`. */
export interface HeatmapDay {
  activity_date: string;
  event_count: number;
}

/** `GET /users/me/streaks` → 200. Per-event-type streaks + a day-count heatmap. */
export interface UserStreaks {
  streaks: Streak[];
  heatmap: HeatmapDay[];
}
