import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SkeletonCard } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { useTopThisWeek } from "./useTopThisWeek";
import type { TopThisWeekContentProps } from "./TopThisWeekWidget.types";

function RankedList({ entries, currentUserId }: TopThisWeekContentProps) {
  return (
    <CardContent>
      <ol className="space-y-2">
        {entries.map((entry) => {
          const isCurrentUser = entry.user_id === currentUserId;
          return (
            <li
              key={entry.user_id}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1 text-sm",
                isCurrentUser && "bg-primary/10 font-medium",
              )}
            >
              <span>
                #{entry.rank} {entry.username}
                {isCurrentUser ? <span className="ml-2 text-xs text-primary">(you)</span> : null}
              </span>
              <span className="text-muted-foreground">{entry.total_points} pts</span>
            </li>
          );
        })}
      </ol>
    </CardContent>
  );
}

/**
 * The widget's body — separated from the outer `TopThisWeekWidget` shell so
 * it can throw (via a render-time error) for real fetch failures, letting the
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
        <CardHeader>
          <CardTitle className="text-base">Top this week</CardTitle>
        </CardHeader>
        <CardContent>
          <SkeletonCard />
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top this week</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity yet this week.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top this week</CardTitle>
      </CardHeader>
      <RankedList entries={entries} currentUserId={currentUserId} />
    </Card>
  );
}
