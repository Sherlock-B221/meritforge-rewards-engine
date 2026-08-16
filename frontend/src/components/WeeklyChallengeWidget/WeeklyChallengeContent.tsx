import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SkeletonCard } from "@/components/feedback";
import { useCountdown } from "@/hooks/useCountdown";
import { useWeeklyChallenge } from "./useWeeklyChallenge";
import type { WeeklyChallengeContentProps } from "./WeeklyChallengeWidget.types";

function formatReward(reward: WeeklyChallengeContentProps["challenge"]["reward"]): string {
  return reward.type === "points" ? `+${reward.amount} pts` : `Badge: ${reward.badge_code}`;
}

function CountdownLabel({ resetsAt }: { resetsAt: string }) {
  const { days, hours, isExpired } = useCountdown(resetsAt);
  if (isExpired) return <span>Resets soon</span>;
  return (
    <span>
      Resets in {days}d {hours}h
    </span>
  );
}

function ChallengeDetails({ challenge }: WeeklyChallengeContentProps) {
  const { name, progress, reward, resets_at } = challenge;
  return (
    <CardContent className="space-y-2">
      <p className="text-sm font-medium">{name}</p>
      <p className="text-sm text-muted-foreground">
        {progress.current_value}/{progress.target_value} · {formatReward(reward)}
      </p>
      <p className="text-xs text-muted-foreground">
        <CountdownLabel resetsAt={resets_at} />
      </p>
    </CardContent>
  );
}

/**
 * The widget's body — separated from the outer `WeeklyChallengeWidget` shell
 * so it can throw (via a render-time error) for real fetch failures, letting
 * the parent `SectionBoundary` catch it, while the "no active challenge"
 * case renders inline as a normal empty state.
 */
export function WeeklyChallengeContent() {
  const { challenge, hasNoActiveChallenge, isLoading, error } = useWeeklyChallenge();

  if (error) {
    // Re-throw so the wrapping SectionBoundary's error boundary catches it.
    throw error;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week&apos;s challenge</CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonCard />
        </CardContent>
      </Card>
    );
  }

  if (hasNoActiveChallenge || !challenge) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week&apos;s challenge</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active weekly challenge right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">This week&apos;s challenge</CardTitle>
      </CardHeader>
      <ChallengeDetails challenge={challenge} />
    </Card>
  );
}
