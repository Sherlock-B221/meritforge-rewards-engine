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
