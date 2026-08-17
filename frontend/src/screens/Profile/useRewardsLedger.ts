"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { getRewards } from "@/services";
import { AppError } from "@/types";
import type { Paginated, Reward } from "@/types";
import { REWARDS_PAGE_SIZE, rewardsKey } from "./Profile.constants";
import type { RewardsLedgerViewModel } from "./Profile.types";

/**
 * Fetch hook for a single reward-ledger page (`GET /users/me/rewards`). Page
 * number is owned by the screen (plain `useState` — no URL round-trip
 * needed) and passed in here so the SWR key matches the key the screen's
 * `SectionBoundary` retries. Page 1 shares its cache entry with
 * `useProfileHeader`'s badge-chip read (same `rewardsKey(1)`), so mounting
 * both sections costs one request, not two.
 *
 * On an unexpected `AppError` it RE-THROWS so the surrounding
 * `<SectionBoundary>` renders the retry fallback.
 */
export function useRewardsLedger(page: number): RewardsLedgerViewModel {
  const { data, error, isLoading, mutate } = useSWR<Paginated<Reward>, AppError>(
    rewardsKey(page),
    ([, pageKey]: readonly [string, number]) => getRewards({ page: pageKey, limit: REWARDS_PAGE_SIZE }),
  );

  // Unexpected failures bubble to the SectionBoundary; the page stays usable.
  if (error) {
    throw error;
  }

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    rewards: data?.items ?? [],
    isInitialLoading: isLoading && !data,
    hasNext: data?.has_next ?? false,
    retry,
  };
}
