import type { ComponentType } from "react";
import { Award, CheckCircle2, Flame, MessagesSquare, Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { SkeletonLine } from "@/components/feedback";
import { UserAvatar } from "@/components/UserAvatar";
import { LevelProgress, StreakFlame } from "@/components/gamification";
import { formatBadge } from "@/lib/formatBadge";
import { cn } from "@/lib/utils";
import type { ProfileHeaderViewModel } from "../../Profile.types";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/** Known badge → medallion icon; unknown earned badges fall back to a generic award. */
const BADGE_ICONS: Record<string, IconType> = {
  first_solution: CheckCircle2,
  ten_answers: MessagesSquare,
  week_streak: Flame,
  deploy_verify: Rocket,
};

/** Baseline badge set shown as locked medallions until earned. */
const BADGE_CATALOG = ["first_solution", "ten_answers", "week_streak", "deploy_verify"];

function BadgeMedallion({ code, earned }: { code: string; earned: boolean }) {
  const Icon = BADGE_ICONS[code] ?? Award;
  return (
    <div className="flex w-16 flex-col items-center gap-1.5 text-center">
      <div
        className={cn(
          "grid size-12 place-items-center rounded-full ring-1",
          earned
            ? "bg-primary/10 text-primary ring-primary/20"
            : "bg-muted text-muted-foreground/40 ring-transparent",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <span
        className={cn(
          "text-[0.7rem] leading-tight",
          earned ? "text-foreground" : "text-muted-foreground/60",
        )}
      >
        {formatBadge(code)}
      </span>
    </div>
  );
}

/**
 * Profile header card: identity (avatar, name, handle, streak + rank pills),
 * the total-points hero number, and a badges row where earned badges light up
 * and the rest stay locked. Values arrive pre-composed from `useProfileHeader`.
 */
export function ProfileHeader({ header }: { header: ProfileHeaderViewModel }) {
  if (header.isInitialLoading) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonLine className="size-14 rounded-full" />
            <div className="space-y-2">
              <SkeletonLine className="w-40" />
              <SkeletonLine className="w-24" />
            </div>
          </div>
          <SkeletonLine className="h-16" />
        </CardContent>
      </Card>
    );
  }

  const { stats } = header;
  const earned = new Set(header.badgeCodes);
  const badges = [
    ...BADGE_CATALOG,
    ...header.badgeCodes.filter((code) => !BADGE_CATALOG.includes(code)),
  ];

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              username={header.username}
              size="default"
              className="size-14"
              fallbackClassName="text-lg"
            />
            <div>
              <h1 className="font-heading text-xl font-semibold leading-tight">
                {header.displayName}
              </h1>
              <p className="text-sm text-muted-foreground">@{header.username}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
                  <StreakFlame days={stats.currentStreak} size="sm" />
                  <span className="text-muted-foreground">day streak</span>
                </span>
                {stats.rank !== null ? (
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                    rank #{stats.rank}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-primary">
              {stats.totalPoints.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted-foreground">total points</p>
          </div>
        </div>

        <LevelProgress points={stats.totalPoints} />

        <div className="space-y-2.5">
          <p className="section-label">Badges earned</p>
          <div className="flex flex-wrap gap-3">
            {badges.map((code) => (
              <BadgeMedallion key={code} code={code} earned={earned.has(code)} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
