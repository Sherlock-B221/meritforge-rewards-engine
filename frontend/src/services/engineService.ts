import { apiGet } from "@/services/apiClient";
import type {
  ChallengeWithProgress,
  ProgressEntry,
  UserStreaks,
  WeeklyChallenge,
} from "@/types/engine";

/**
 * `GET /challenges/weekly` → 200 `WeeklyChallenge`, or throws `AppError` with
 * `code: "NOT_FOUND"` (404) when no weekly challenge is currently active.
 */
export function getWeeklyChallenge(): Promise<WeeklyChallenge> {
  return apiGet<WeeklyChallenge>("/challenges/weekly");
}

/**
 * `GET /challenges` → 200 `ChallengeWithProgress[]` — a PLAIN ARRAY of every
 * active challenge with the caller's current-period progress. Powers the
 * Challenges screen's progress rings + this-week breakdown.
 */
export function getChallenges(): Promise<ChallengeWithProgress[]> {
  return apiGet<ChallengeWithProgress[]>("/challenges");
}

/**
 * `GET /users/me/progress` → 200 `ProgressEntry[]` — a PLAIN ARRAY of the
 * caller's flattened per-challenge progress rows for the current period.
 */
export function getProgress(): Promise<ProgressEntry[]> {
  return apiGet<ProgressEntry[]>("/users/me/progress");
}

/**
 * `GET /users/me/streaks` → 200 `UserStreaks` — per-event-type streaks plus a
 * day-count contribution heatmap. Powers the streak heatmap + streak line.
 * Task 4 (Profile / Rewards) reuses this exact signature.
 */
export function getStreaks(): Promise<UserStreaks> {
  return apiGet<UserStreaks>("/users/me/streaks");
}
