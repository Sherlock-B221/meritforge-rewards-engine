import { apiGet } from "@/services/apiClient";
import type { WeeklyChallenge } from "@/types/engine";

/**
 * `GET /challenges/weekly` → 200 `WeeklyChallenge`, or throws `AppError` with
 * `code: "NOT_FOUND"` (404) when no weekly challenge is currently active.
 *
 * Only this one read is built here for now — the rest of the engine reads
 * (progress, streaks, rewards, leaderboard) land with the screens that need
 * them in P6, not speculatively.
 */
export function getWeeklyChallenge(): Promise<WeeklyChallenge> {
  return apiGet<WeeklyChallenge>("/challenges/weekly");
}
