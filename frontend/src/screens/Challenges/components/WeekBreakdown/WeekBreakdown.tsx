"use client";

import { CheckSquare, Square } from "lucide-react";
import type { ChallengeWithProgress } from "@/types";
import { formatReward } from "../../Challenges.constants";

interface WeekBreakdownProps {
  challenges: ChallengeWithProgress[];
}

/**
 * This week's breakdown — a checklist of the active challenges (the wireframe's
 * "sub-goals" mapped onto our active-challenge set). Each row shows ☑ when its
 * progress is `completed`, else ☐, alongside the challenge name and its reward.
 * Presentational only.
 */
export function WeekBreakdown({ challenges }: WeekBreakdownProps) {
  if (challenges.length === 0) {
    return <p className="text-sm text-muted-foreground">No active challenges this week.</p>;
  }

  return (
    <ul className="space-y-2">
      {challenges.map((challenge) => {
        const done = challenge.progress.completed;
        return (
          <li key={challenge.id} className="flex items-center gap-2 text-sm">
            {done ? (
              <CheckSquare className="size-4 shrink-0 text-primary" aria-hidden />
            ) : (
              <Square className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={done ? "text-foreground" : "text-muted-foreground"}>
              {challenge.name}
            </span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {formatReward(challenge.reward)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
