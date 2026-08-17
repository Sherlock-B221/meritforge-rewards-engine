"use client";

import useSWR from "swr";
import { getLeaderboard } from "@/services";
import { useAuthStore } from "@/store";
import { AppError } from "@/types";
import type { LeaderboardEntry, Paginated } from "@/types";
import { LEADERBOARD_PAGE_SIZE, leaderboardKey } from "./Leaderboard.constants";
import type { LeaderboardViewModel } from "./Leaderboard.types";

/**
 * Fetch hook for a single leaderboard page (`GET /leaderboard`). Page number
 * is owned by the screen (plain `useState`, no URL round-trip needed per the
 * brief) and passed in here so the SWR key it derives matches the key the
 * screen's `SectionBoundary` retries. On an unexpected `AppError` it
 * RE-THROWS so the surrounding `<SectionBoundary>` renders the retry fallback.
 */
export function useLeaderboard(page: number): LeaderboardViewModel {
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const { data, error, isLoading } = useSWR<Paginated<LeaderboardEntry>, AppError>(
    leaderboardKey(page),
    ([, pageKey]: readonly [string, number]) =>
      getLeaderboard({ page: pageKey, limit: LEADERBOARD_PAGE_SIZE }),
  );

  // Unexpected failures bubble to the SectionBoundary; the page stays usable.
  if (error) {
    throw error;
  }

  return {
    entries: data?.items ?? [],
    isInitialLoading: isLoading && !data,
    hasNext: data?.has_next ?? false,
    currentUserId,
  };
}
