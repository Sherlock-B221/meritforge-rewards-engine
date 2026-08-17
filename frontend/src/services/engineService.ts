import { apiGet } from "@/services/apiClient";
import type { Paginated } from "@/types/api";
import type {
  ChallengeWithProgress,
  LeaderboardEntry,
  ProgressEntry,
  Reward,
  UserStreaks,
  WeeklyChallenge,
} from "@/types/engine";

/** Parameters for a single paginated-page fetch (rewards ledger or leaderboard). */
export interface PageParams {
  page: number;
  limit?: number;
}

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

/**
 * `GET /users/me/rewards?page=&limit=` → `Paginated<Reward>` — the caller's
 * disbursed-reward ledger (points + badges), newest first. Powers the
 * Profile screen's reward history table and badge chips (Task 4).
 */
export function getRewards(params: PageParams): Promise<Paginated<Reward>> {
  const query = new URLSearchParams({ page: String(params.page) });
  if (params.limit !== undefined) {
    query.set("limit", String(params.limit));
  }
  return apiGet<Paginated<Reward>>(`/users/me/rewards?${query.toString()}`);
}

/**
 * `GET /leaderboard?page=&limit=` → `Paginated<LeaderboardEntry>` — users
 * ranked by total points. Powers the Leaderboard screen, and the Profile
 * screen's rank/points/badge-count composition (Task 4) by locating the
 * current user's row within a page.
 */
export function getLeaderboard(params: PageParams): Promise<Paginated<LeaderboardEntry>> {
  const query = new URLSearchParams({ page: String(params.page) });
  if (params.limit !== undefined) {
    query.set("limit", String(params.limit));
  }
  return apiGet<Paginated<LeaderboardEntry>>(`/leaderboard?${query.toString()}`);
}
