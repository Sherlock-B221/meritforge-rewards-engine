/**
 * Frontend-derived level tiers from a user's total points. Pure + config-driven
 * — deliberately NO backend/schema change: the reward ledger stays the single
 * source of truth for points; levels are a presentation-layer mapping over the
 * total, so new tiers are a one-line edit here.
 */
export interface LevelInfo {
  tier: number;
  label: string;
  floor: number;
  nextFloor: number | null;
  /** 0..1 toward the next tier (1 at max level). */
  progress: number;
  pointsIntoTier: number;
  pointsToNext: number | null;
}

const TIERS: ReadonlyArray<{ label: string; floor: number }> = [
  { label: "Novice", floor: 0 },
  { label: "Contributor", floor: 100 },
  { label: "Regular", floor: 300 },
  { label: "Expert", floor: 700 },
  { label: "Master", floor: 1500 },
  { label: "Legend", floor: 3000 },
];

export function getLevel(points: number): LevelInfo {
  const total = Math.max(0, Math.floor(points));
  let index = 0;
  for (let t = 0; t < TIERS.length; t += 1) {
    if (total >= TIERS[t].floor) index = t;
  }
  const current = TIERS[index];
  const next = index + 1 < TIERS.length ? TIERS[index + 1] : null;
  const pointsIntoTier = total - current.floor;
  const span = next ? next.floor - current.floor : 0;
  const progress = next && span > 0 ? Math.min(1, pointsIntoTier / span) : 1;
  return {
    tier: index + 1,
    label: current.label,
    floor: current.floor,
    nextFloor: next?.floor ?? null,
    progress,
    pointsIntoTier,
    pointsToNext: next ? next.floor - total : null,
  };
}
