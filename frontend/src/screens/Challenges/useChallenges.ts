"use client";

import { useCallback } from "react";
import useSWR from "swr";
import { getChallenges } from "@/services";
import { AppError } from "@/types";
import type { ChallengeWithProgress } from "@/types";
import { POLL_INTERVAL_MS } from "@/constants/polling";
import { CHALLENGES_KEY } from "./Challenges.constants";
import type { ChallengesViewModel } from "./Challenges.types";

/**
 * Fetch+poll hook for the active-challenges list (`GET /challenges`, a plain
 * array). Polls every `POLL_INTERVAL_MS` (30s) so async-evaluated progress
 * trickles into the rings without a reload. On an unexpected `AppError` it
 * RE-THROWS so the section's `<SectionBoundary>` renders the retry fallback,
 * leaving the streak section usable.
 */
export function useChallenges(): ChallengesViewModel {
  const { data, error, isLoading, mutate } = useSWR<ChallengeWithProgress[], AppError>(
    CHALLENGES_KEY,
    getChallenges,
    { refreshInterval: POLL_INTERVAL_MS },
  );

  if (error) {
    throw error;
  }

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    challenges: data ?? [],
    isInitialLoading: isLoading && !data,
    retry,
  };
}
