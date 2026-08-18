"use client";

import { SectionBoundary } from "@/components/feedback";
import { useSWRConfig } from "swr";
import { topThisWeekKey } from "./TopThisWeekWidget.constants";
import { TopThisWeekContent } from "./TopThisWeekContent";

/**
 * Persistent, layout-level widget mounted once inside `RightRail`, alongside
 * `WeeklyChallengeWidget`. Fetches the top of `GET /leaderboard` (via
 * `useTopThisWeek`, polling every 30s) and shows a ranked mini-leaderboard.
 * Wrapped in its OWN `SectionBoundary` — independent of the weekly widget's —
 * so a fetch failure here can't take down the weekly widget or vice versa.
 */
export function TopThisWeekWidget() {
  const { mutate } = useSWRConfig();

  return (
    <SectionBoundary onRetry={() => void mutate(topThisWeekKey)}>
      <TopThisWeekContent />
    </SectionBoundary>
  );
}
