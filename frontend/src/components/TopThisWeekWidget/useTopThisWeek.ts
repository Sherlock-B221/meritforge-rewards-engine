"use client";

import useSWR from "swr";
import { getLeaderboard } from "@/services/engineService";
import { useAuthStore } from "@/store";
import { AppError } from "@/types/api";
import type { Paginated } from "@/types/api";
import type { LeaderboardEntry } from "@/types/engine";
import { POLL_INTERVAL_MS } from "@/constants/polling";
import { TOP_THIS_WEEK_LIMIT, topThisWeekKey } from "./TopThisWeekWidget.constants";

interface UseTopThisWeekResult {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  isLoading: boolean;
  error: AppError | undefined;
}

/**
 * Fetch+poll hook for the "Top this week" mini-leaderboard. Reuses the same
 * `GET /leaderboard` endpoint as the full Leaderboard screen but keys its SWR
 * cache entry separately (`topThisWeekKey`) so this widget's fixed
 * page-1/limit-5 fetch never collides with — or gets invalidated oddly by —
 * the screen's own paged cache. Polls every `POLL_INTERVAL_MS` (30s) to match
 * this app's convention for live, async-evaluated surfaces.
 */
export function useTopThisWeek(): UseTopThisWeekResult {
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const { data, error, isLoading } = useSWR<Paginated<LeaderboardEntry>, AppError>(
    topThisWeekKey,
    () => getLeaderboard({ page: 1, limit: TOP_THIS_WEEK_LIMIT }),
    {
      refreshInterval: POLL_INTERVAL_MS,
    },
  );

  return {
    entries: data?.items ?? [],
    currentUserId,
    isLoading,
    error,
  };
}
