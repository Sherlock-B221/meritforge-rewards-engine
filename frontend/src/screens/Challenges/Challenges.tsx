"use client";

import { useSWRConfig } from "swr";
import { Card, CardContent } from "@/components/ui";
import { SectionBoundary, SkeletonCard, SkeletonLine } from "@/components/feedback";
import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { CHALLENGES_KEY, STREAKS_KEY, formatReward } from "./Challenges.constants";
import { useChallenges } from "./useChallenges";
import { useStreaks } from "./useStreaks";
import { ProgressRing, StreakHeatmap, WeekBreakdown } from "./components";

/** Active-challenge cards: a compact ring + name + reward, two-up. */
function ChallengesSection() {
  const { challenges, isInitialLoading } = useChallenges();

  if (isInitialLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No active challenges right now. Check back soon.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {challenges.map((challenge) => {
        const done = challenge.progress.completed;
        return (
          <Card key={challenge.id} size="sm">
            <CardContent className="flex items-center gap-3">
              <ProgressRing
                current={challenge.progress.current_value}
                target={challenge.progress.target_value}
                completed={done}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{challenge.name}</p>
                <p className={cn("text-xs font-medium", done ? "text-success" : "text-primary")}>
                  {done ? `Earned · ${formatReward(challenge.reward)}` : formatReward(challenge.reward)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** The contribution-streak heatmap + headline streak number. */
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

/** This-week checklist — reads the same challenges fetch (SWR dedupes the request). */
function BreakdownSection() {
  const { challenges, isInitialLoading } = useChallenges();

  if (isInitialLoading) {
    return <SkeletonLine className="h-16" />;
  }

  return <WeekBreakdown challenges={challenges} />;
}

/**
 * Challenges & Progress page. Three independently-guarded async sections
 * (challenges · streaks · this-week breakdown), each polling every 30s (via its
 * hook) and each wrapped in its OWN `SectionBoundary` whose `onRetry`
 * revalidates that section's SWR key — so one failing section leaves the rest
 * of the page usable. Presentational only; logic lives in the hooks.
 */
export function ChallengesScreen() {
  const { mutate } = useSWRConfig();

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Challenges &amp; Progress</h1>
        <p className="text-sm text-muted-foreground">
          Live progress on active challenges — updates every 30s as events are evaluated.
        </p>
      </div>

      <section className="space-y-2.5">
        <p className="section-label">Active challenges</p>
        <SectionBoundary onRetry={() => void mutate(CHALLENGES_KEY)}>
          <ChallengesSection />
        </SectionBoundary>
      </section>

      <section className="space-y-2.5">
        <p className="section-label">Contribution streak</p>
        <Card>
          <CardContent>
            <SectionBoundary onRetry={() => void mutate(STREAKS_KEY)}>
              <StreaksSection />
            </SectionBoundary>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2.5">
        <p className="section-label">This week&apos;s breakdown</p>
        <Card>
          <CardContent>
            <SectionBoundary onRetry={() => void mutate(CHALLENGES_KEY)}>
              <BreakdownSection />
            </SectionBoundary>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
