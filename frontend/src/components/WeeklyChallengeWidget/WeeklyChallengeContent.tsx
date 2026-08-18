import { Card, CardContent } from "@/components/ui";
import { SkeletonLine } from "@/components/feedback";
import { useCountdown } from "@/hooks/useCountdown";
import { formatBadge } from "@/lib/formatBadge";
import { useWeeklyChallenge } from "./useWeeklyChallenge";
import type { WeeklyChallengeContentProps } from "./WeeklyChallengeWidget.types";

function formatReward(reward: WeeklyChallengeContentProps["challenge"]["reward"]): string {
  return reward.type === "points" ? `+${reward.amount} pts` : `Badge · ${formatBadge(reward.badge_code)}`;
}

function CountdownLabel({ resetsAt }: { resetsAt: string }) {
  const { days, hours, isExpired } = useCountdown(resetsAt);
  if (isExpired) {
    return <>Resets soon</>;
  }
  return (
    <>
      Resets in {days}d {hours}h
    </>
  );
}

/** Lightweight CSS conic-gradient progress ring (the page-level rings use Recharts). */
function MiniRing({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
  const deg = pct * 3.6;
  return (
    <div className="relative size-12 shrink-0">
      <div
        className="size-12 rounded-full"
        style={{
          background: `conic-gradient(var(--color-primary) ${deg}deg, var(--color-muted) ${deg}deg)`,
        }}
      />
      <div className="absolute inset-[3px] grid place-items-center rounded-full bg-card text-xs font-semibold tabular-nums">
        {current}/{target}
      </div>
    </div>
  );
}

function WidgetLabel() {
  return (
    <p className="text-xs font-semibold tracking-wider text-primary uppercase">Weekly challenge</p>
  );
}

/**
 * The widget's body — separated from the outer `WeeklyChallengeWidget` shell so
 * it can throw (via a render-time error) for real fetch failures, letting the
 * parent `SectionBoundary` catch it, while the "no active challenge" case
 * renders inline as a normal empty state.
 */
export function WeeklyChallengeContent() {
  const { challenge, hasNoActiveChallenge, isLoading, error } = useWeeklyChallenge();

  if (error) {
    // Re-throw so the wrapping SectionBoundary's error boundary catches it.
    throw error;
  }

  if (isLoading) {
    return (
      <Card className="ring-2 ring-primary/25">
        <CardContent className="space-y-3">
          <WidgetLabel />
          <SkeletonLine className="w-32" />
          <SkeletonLine className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (hasNoActiveChallenge || !challenge) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <WidgetLabel />
          <p className="text-sm text-muted-foreground">No active weekly challenge right now.</p>
        </CardContent>
      </Card>
    );
  }

  const { name, progress, reward, resets_at } = challenge;

  return (
    <Card className="ring-2 ring-primary/25">
      <CardContent className="space-y-3">
        <WidgetLabel />
        <p className="text-sm font-semibold">{name}</p>
        <div className="flex items-center gap-3">
          <MiniRing current={progress.current_value} target={progress.target_value} />
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold text-primary">{formatReward(reward)}</p>
            <p className="text-muted-foreground">
              <CountdownLabel resetsAt={resets_at} />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
