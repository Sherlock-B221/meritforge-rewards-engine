import { Card, CardContent } from "@/components/ui";
import { SkeletonLine } from "@/components/feedback";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { useTopThisWeek } from "./useTopThisWeek";
import type { TopThisWeekContentProps } from "./TopThisWeekWidget.types";

function WidgetLabel() {
  return (
    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      Top this week
    </p>
  );
}

function RankedList({ entries, currentUserId }: TopThisWeekContentProps) {
  return (
    <ol className="space-y-1">
      {entries.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        return (
          <li
            key={entry.user_id}
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-sm",
              isCurrentUser && "bg-primary/10",
            )}
          >
            <span className="w-4 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
              {entry.rank}
            </span>
            <UserAvatar username={entry.username} size="sm" />
            <span className={cn("min-w-0 flex-1 truncate", isCurrentUser && "font-semibold")}>
              {entry.username}
              {isCurrentUser ? <span className="ml-1 text-xs text-primary">(you)</span> : null}
            </span>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {entry.total_points} pts
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The widget's body — separated from the outer `TopThisWeekWidget` shell so it
 * can throw (via a render-time error) for real fetch failures, letting the
 * parent `SectionBoundary` catch it, while the "no activity yet" case renders
 * inline as a normal empty state.
 */
export function TopThisWeekContent() {
  const { entries, currentUserId, isLoading, error } = useTopThisWeek();

  if (error) {
    // Re-throw so the wrapping SectionBoundary's error boundary catches it.
    throw error;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <WidgetLabel />
          <div className="space-y-2">
            <SkeletonLine className="w-full" />
            <SkeletonLine className="w-full" />
            <SkeletonLine className="w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <WidgetLabel />
          <p className="text-sm text-muted-foreground">No activity yet this week.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <WidgetLabel />
        <RankedList entries={entries} currentUserId={currentUserId} />
      </CardContent>
    </Card>
  );
}
