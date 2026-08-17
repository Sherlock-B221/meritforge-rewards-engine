"use client";

import { useSWRConfig } from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { SectionBoundary, SkeletonCard, SkeletonLine } from "@/components/feedback";
import { CHALLENGES_KEY, STREAKS_KEY, formatReward } from "./Challenges.constants";
import { useChallenges } from "./useChallenges";
import { useStreaks } from "./useStreaks";
import { ProgressRing, StreakHeatmap, WeekBreakdown } from "./components";

/**
 * The active-challenges section body — rings + this-week breakdown. Lives
 * inside its own `SectionBoundary` so a `/challenges` fetch failure degrades
 * here without touching the streak section. On first load it shows skeletons
 * (never a spinner); `useChallenges` re-throws real errors to the boundary.
 */
function ChallengesSection() {
  const { challenges, isInitialLoading } = useChallenges();

  if (isInitialLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No active challenges right now. Check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {challenges.map((challenge) => (
          <Card key={challenge.id}>
            <CardHeader>
              <CardTitle className="text-base">{challenge.name}</CardTitle>
              <CardDescription>{challenge.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <ProgressRing
                current={challenge.progress.current_value}
                target={challenge.progress.target_value}
                completed={challenge.progress.completed}
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">{formatReward(challenge.reward)}</p>
                <p className="text-xs text-muted-foreground">
                  {challenge.progress.completed ? "Completed 🎉" : "In progress"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week&apos;s breakdown</CardTitle>
          <CardDescription>Sub-goals for the current period.</CardDescription>
        </CardHeader>
        <CardContent>
          <WeekBreakdown challenges={challenges} />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The contribution-streak section body — the heatmap + headline streak line.
 * In its own `SectionBoundary`, so a `/users/me/streaks` failure leaves the
 * challenges rings usable. Skeletons on first load; `useStreaks` re-throws.
 */
function StreaksSection() {
  const { heatmap, currentStreak, bestStreak, isInitialLoading } = useStreaks();

  if (isInitialLoading) {
    return (
      <div className="space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="h-24" />
      </div>
    );
  }

  return (
    <StreakHeatmap heatmap={heatmap} currentStreak={currentStreak} bestStreak={bestStreak} />
  );
}

/**
 * Challenges & Progress page. Two independently-guarded async sections
 * (challenges vs streaks), each polling every 30s (via its hook) and each
 * wrapped in its OWN `SectionBoundary` whose `onRetry` revalidates that
 * section's SWR key — so one failing section leaves the rest of the page
 * usable. Presentational only; all logic lives in `useChallenges`/`useStreaks`.
 */
export function ChallengesScreen() {
  const { mutate } = useSWRConfig();

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="font-heading text-lg font-semibold">Challenges &amp; Progress</h1>
        <p className="text-sm text-muted-foreground">
          Live progress on active challenges — updates every 30s as events are evaluated.
        </p>
      </div>

      <SectionBoundary onRetry={() => void mutate(CHALLENGES_KEY)}>
        <ChallengesSection />
      </SectionBoundary>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contribution streak</CardTitle>
          <CardDescription>Your activity over the last 12 weeks.</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionBoundary onRetry={() => void mutate(STREAKS_KEY)}>
            <StreaksSection />
          </SectionBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
