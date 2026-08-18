"use client";

import useSWR from "swr";
import { getWeeklyChallenge } from "@/services/engineService";
import { AppError } from "@/types/api";
import { POLL_INTERVAL_MS } from "@/constants/polling";
import type { WeeklyChallenge } from "@/types/engine";

interface UseWeeklyChallengeResult {
  challenge: WeeklyChallenge | undefined;
  /** True when the backend reports no active weekly challenge (any 404) — not a hard error. */
  hasNoActiveChallenge: boolean;
  isLoading: boolean;
  error: AppError | undefined;
  retry: () => void;
}

/**
 * Fetch+poll+countdown-data hook for the weekly challenge widget. Polls every
 * `POLL_INTERVAL_MS` (30s) since evaluation is async. A 404 means
 * "no active weekly challenge" — a valid empty state, not an error to throw
 * into the surrounding `SectionBoundary`.
 */
export function useWeeklyChallenge(): UseWeeklyChallengeResult {
  const { data, error, isLoading, mutate } = useSWR<WeeklyChallenge, AppError>(
    "/challenges/weekly",
    getWeeklyChallenge,
    {
      refreshInterval: POLL_INTERVAL_MS,
      shouldRetryOnError: (err) => !(err instanceof AppError && err.status === 404),
    },
  );

  // The only 404 this endpoint can return is "no active weekly challenge" — the
  // backend's generic NotFoundError emits a resource-specific code
  // (WEEKLY_CHALLENGE_NOT_FOUND), not the FE's assumed "NOT_FOUND", so key off
  // the HTTP status rather than a code string that never matches.
  const hasNoActiveChallenge = error instanceof AppError && error.status === 404;

  return {
    challenge: data,
    hasNoActiveChallenge,
    isLoading,
    error: hasNoActiveChallenge ? undefined : error,
    retry: () => {
      void mutate();
    },
  };
}
