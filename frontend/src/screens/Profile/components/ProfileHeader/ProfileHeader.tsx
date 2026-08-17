import { Card, CardContent } from "@/components/ui";
import { SkeletonLine } from "@/components/feedback";
import { NO_RANK_PLACEHOLDER } from "../../Profile.constants";
import type { ProfileHeaderViewModel } from "../../Profile.types";

/** One small labeled stat in the header strip (rank, streak, badge count). */
function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

/**
 * Profile header card: display name + handle, composed stats strip (rank,
 * current streak, badge count), the total-points big number, and badge
 * chips. All values arrive pre-composed from `useProfileHeader` — this
 * component is purely presentational.
 */
export function ProfileHeader({ header }: { header: ProfileHeaderViewModel }) {
  if (header.isInitialLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <SkeletonLine className="w-48" />
          <SkeletonLine className="w-32" />
          <SkeletonLine className="h-16" />
        </CardContent>
      </Card>
    );
  }

  const { stats } = header;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h1 className="font-heading text-lg font-semibold">{header.displayName}</h1>
          <p className="text-sm text-muted-foreground">@{header.username}</p>
        </div>

        <div className="flex flex-wrap gap-6">
          <StatBlock label="Rank" value={stats.rank !== null ? `#${stats.rank}` : NO_RANK_PLACEHOLDER} />
          <StatBlock label="Current streak" value={`${stats.currentStreak}d`} />
          <StatBlock label="Badges" value={String(stats.badgeCount)} />
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Total points</p>
          <p className="text-4xl font-bold tabular-nums">{stats.totalPoints}</p>
        </div>

        {header.badgeCodes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {header.badgeCodes.map((code) => (
              <span
                key={code}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {code}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No badges earned yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
