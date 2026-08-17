import type { RewardConfig } from "@/types";

/** SWR cache key for the active-challenges list (`GET /challenges`). */
export const CHALLENGES_KEY = "/challenges" as const;

/** SWR cache key for the caller's streaks + heatmap (`GET /users/me/streaks`). */
export const STREAKS_KEY = "/users/me/streaks" as const;

/**
 * How many trailing weeks the contribution heatmap renders (GitHub-style).
 * 12 weeks keeps the grid compact while still showing a meaningful streak span.
 */
export const HEATMAP_WEEKS = 12;

/** Days per heatmap column (a full week, Mon–Sun ordering handled at render). */
export const HEATMAP_DAYS_PER_WEEK = 7;

/**
 * Intensity buckets for the heatmap: each `[minCount, tailwindClass]` maps a
 * day's `event_count` to a fill. Ordered ascending; a day picks the last bucket
 * whose `minCount` it meets. Bucket 0 is the "no activity" base cell.
 */
export const HEATMAP_LEVELS: ReadonlyArray<{ minCount: number; className: string }> = [
  { minCount: 0, className: "bg-muted" },
  { minCount: 1, className: "bg-primary/25" },
  { minCount: 2, className: "bg-primary/45" },
  { minCount: 4, className: "bg-primary/70" },
  { minCount: 7, className: "bg-primary" },
];

/** SVG geometry for a single progress ring (donut). */
export const RING = {
  size: 120,
  innerRadius: 42,
  outerRadius: 54,
} as const;

/**
 * Render a reward config as a short human label — `+150 pts` for points, or the
 * badge code for badges. Shared by the ring cards and the week breakdown.
 */
export function formatReward(reward: RewardConfig): string {
  return reward.type === "points" ? `+${reward.amount} pts` : `Badge: ${reward.badge_code}`;
}
