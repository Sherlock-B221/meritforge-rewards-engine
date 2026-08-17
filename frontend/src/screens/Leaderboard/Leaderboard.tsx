"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui";
import { SectionBoundary, SkeletonRow } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { leaderboardKey } from "./Leaderboard.constants";
import { useLeaderboard } from "./useLeaderboard";

/**
 * Everything that depends on leaderboard data — table + pager — lives inside
 * the screen's `SectionBoundary` so a fetch failure degrades here (matches
 * `FeedContent`'s shape: pager buttons live alongside the data they page).
 */
function LeaderboardContent({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const board = useLeaderboard(page);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Rank</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Points</th>
              <th className="px-4 py-2 font-medium">Badges</th>
            </tr>
          </thead>
          <tbody>
            {board.isInitialLoading ? (
              Array.from({ length: 5 }, (_, index) => index).map((key) => (
                <tr key={key}>
                  <td className="px-4 py-3" colSpan={4}>
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : board.entries.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={4}>
                  No leaderboard entries yet.
                </td>
              </tr>
            ) : (
              board.entries.map((entry) => {
                const isCurrentUser = entry.user_id === board.currentUserId;
                return (
                  <tr key={entry.user_id} className={cn("border-t", isCurrentUser && "bg-primary/10 font-medium")}>
                    <td className="px-4 py-3">#{entry.rank}</td>
                    <td className="px-4 py-3">
                      {entry.username}
                      {isCurrentUser ? <span className="ml-2 text-xs text-primary">(you)</span> : null}
                    </td>
                    <td className="px-4 py-3">{entry.total_points}</td>
                    <td className="px-4 py-3">{entry.badge_count}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">Page {page}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!board.hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Leaderboard page: owns the current page number (plain `useState` — no URL
 * round-trip needed for this page per the brief) and wraps the table+pager
 * in a `SectionBoundary` whose `onRetry` revalidates the exact current-page
 * SWR key (`leaderboardKey(page)`, matching what `useLeaderboard` reads).
 */
export function LeaderboardScreen() {
  const { mutate } = useSWRConfig();
  const [page, setPage] = useState(1);

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <div>
        <h1 className="font-heading text-lg font-semibold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Ranked by total points earned.</p>
      </div>

      <SectionBoundary onRetry={() => void mutate(leaderboardKey(page))}>
        <LeaderboardContent page={page} onPageChange={(next) => setPage(Math.max(1, next))} />
      </SectionBoundary>
    </div>
  );
}
