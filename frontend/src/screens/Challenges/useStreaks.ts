"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { getStreaks } from "@/services";
import { AppError } from "@/types";
import type { UserStreaks } from "@/types";
import { POLL_INTERVAL_MS } from "@/constants/polling";
import { STREAKS_KEY } from "./Challenges.constants";
import type { StreaksViewModel } from "./Challenges.types";

const EMPTY_STREAKS: UserStreaks = { streaks: [], heatmap: [] };

/** Largest value of `key` across the streaks list, or 0 when there are none. */
function maxOf(streaks: UserStreaks["streaks"], key: "current_streak" | "best_streak"): number {
  return streaks.reduce((max, s) => Math.max(max, s[key]), 0);
}

/**
 * Fetch+poll hook for the caller's streaks + contribution heatmap
 * (`GET /users/me/streaks`). Polls every `POLL_INTERVAL_MS` (30s). Derives the
 * headline "N-day streak · best M" from the max across event-type streaks. On
 * an unexpected `AppError` it RE-THROWS so the streak section's own
 * `<SectionBoundary>` catches it, leaving the challenges section usable.
 */
export function useStreaks(): StreaksViewModel {
  const { data, error, isLoading, mutate } = useSWR<UserStreaks, AppError>(
    STREAKS_KEY,
    getStreaks,
    { refreshInterval: POLL_INTERVAL_MS },
  );

  if (error) {
    throw error;
  }

  const streaksData = data ?? EMPTY_STREAKS;

  const { currentStreak, bestStreak } = useMemo(
    () => ({
      currentStreak: maxOf(streaksData.streaks, "current_streak"),
      bestStreak: maxOf(streaksData.streaks, "best_streak"),
    }),
    [streaksData.streaks],
  );

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    streaks: streaksData.streaks,
    heatmap: streaksData.heatmap,
    currentStreak,
    bestStreak,
    isInitialLoading: isLoading && !data,
    retry,
  };
}
