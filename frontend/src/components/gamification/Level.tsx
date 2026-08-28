"use client";

import { getLevel } from "@/constants/levels";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Full level display: tier badge + points-to-next + a progress bar. Profile hero. */
export function LevelProgress({ points, className }: { points: number; className?: string }) {
  const level = getLevel(points);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Badge variant="default" className="text-[0.8rem]">
          <span className="font-bold">Lv {level.tier}</span>
          <span aria-hidden className="opacity-50">
            ·
          </span>
          {level.label}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">
          {level.pointsToNext !== null
            ? `${level.pointsToNext.toLocaleString("en-US")} pts to next`
            : "Max level"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(level.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** Compact level chip for dense rows (e.g. leaderboard). */
export function LevelBadge({ points, className }: { points: number; className?: string }) {
  const level = getLevel(points);
  return (
    <Badge variant="secondary" className={cn("tabular-nums", className)}>
      Lv {level.tier}
    </Badge>
  );
}
