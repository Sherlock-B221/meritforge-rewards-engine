"use client";

import { useMemo } from "react";
import type { HeatmapDay } from "@/types";
import {
  HEATMAP_DAYS_PER_WEEK,
  HEATMAP_LEVELS,
  HEATMAP_WEEKS,
} from "../../Challenges.constants";
import type { HeatmapCell } from "../../Challenges.types";

interface StreakHeatmapProps {
  heatmap: HeatmapDay[];
  currentStreak: number;
  bestStreak: number;
}

/** Format a `Date` as `YYYY-MM-DD` in UTC (matches the API's date keys). */
function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Pick the Tailwind fill class for a given event count from the level buckets. */
function classForCount(count: number): string {
  let chosen = HEATMAP_LEVELS[0].className;
  for (const level of HEATMAP_LEVELS) {
    if (count >= level.minCount) {
      chosen = level.className;
    }
  }
  return chosen;
}

/**
 * Build a fixed `HEATMAP_WEEKS × 7` grid of day cells ending today. Real
 * `heatmap` counts are looked up by date key; days with no entry render as the
 * base ("no activity") level. Pure — no React, easy to reason about.
 */
function buildCells(heatmap: HeatmapDay[]): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const day of heatmap) {
    counts.set(day.activity_date, day.event_count);
  }

  const totalDays = HEATMAP_WEEKS * HEATMAP_DAYS_PER_WEEK;
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (totalDays - 1));

  const cells: HeatmapCell[] = [];
  for (let i = 0; i < totalDays; i += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const key = toDateKey(date);
    const count = counts.get(key) ?? 0;
    cells.push({
      date: key,
      count,
      className: classForCount(count),
      isPadding: false,
    });
  }
  return cells;
}

/**
 * Contribution streak HEATMAP — the second required data-viz (the rings are the
 * first). A GitHub-style grid of the trailing `HEATMAP_WEEKS` weeks, each day
 * colored by `event_count` intensity, led by the headline streak number.
 */
export function StreakHeatmap({ heatmap, currentStreak, bestStreak }: StreakHeatmapProps) {
  const cells = useMemo(() => buildCells(heatmap), [heatmap]);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-primary">{currentStreak}</span>
        <span className="text-sm text-muted-foreground">
          day streak <span className="text-muted-foreground/50">·</span> best {bestStreak}
        </span>
      </div>

      <div
        className="grid grid-flow-col gap-1 overflow-x-auto pb-1"
        style={{ gridTemplateRows: `repeat(${HEATMAP_DAYS_PER_WEEK}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Contribution heatmap for the last ${HEATMAP_WEEKS} weeks`}
      >
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`size-3 rounded-sm ${cell.className}`}
            title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "event" : "events"}`}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <span>Less</span>
        {HEATMAP_LEVELS.map((level) => (
          <span key={level.minCount} className={`size-3 rounded-sm ${level.className}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
