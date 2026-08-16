"use client";

import { SectionBoundary } from "@/components/feedback";
import { useSWRConfig } from "swr";
import { WeeklyChallengeContent } from "./WeeklyChallengeContent";

/**
 * Persistent, layout-level widget mounted once inside `RightRail`. Fetches
 * `GET /challenges/weekly` (via `useWeeklyChallenge`, polling every 30s) and
 * shows challenge name, progress, reward, and a reset countdown. Wrapped in
 * its own `SectionBoundary` so a fetch failure here can't take down the rest
 * of the shell.
 */
export function WeeklyChallengeWidget() {
  const { mutate } = useSWRConfig();

  return (
    <SectionBoundary onRetry={() => void mutate("/challenges/weekly")}>
      <WeeklyChallengeContent />
    </SectionBoundary>
  );
}
