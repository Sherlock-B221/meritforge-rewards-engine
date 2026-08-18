"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { SectionBoundary, SkeletonRow } from "@/components/feedback";
import { PageContainer } from "@/components/PageContainer";
import { Pagination } from "@/components/Pagination";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { leaderboardKey } from "./Leaderboard.constants";
import { useLeaderboard } from "./useLeaderboard";

/** Medal colors for the top three ranks; plain `#N` below that. */
const MEDAL: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 ring-amber-300",
  2: "bg-slate-100 text-slate-600 ring-slate-300",
  3: "bg-orange-100 text-orange-700 ring-orange-300",
};

function RankCell({ rank }: { rank: number }) {
  const medal = MEDAL[rank];
  if (medal) {
    return (
      <span
        className={cn(
          "inline-grid size-6 place-items-center rounded-full text-xs font-bold ring-1",
          medal,
        )}
      >
        {rank}
      </span>
    );
  }
  return <span className="pl-1 text-sm tabular-nums text-muted-foreground">#{rank}</span>;
}

/**
 * Everything that depends on leaderboard data — table + pager — lives inside
 * the screen's `SectionBoundary` so a fetch failure degrades here.
 */
function LeaderboardContent({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const board = useLeaderboard(page);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-16 px-4 py-2.5 font-medium">Rank</th>
              <th className="px-4 py-2.5 font-medium">User</th>
              <th className="px-4 py-2.5 text-right font-medium">Points</th>
              <th className="px-4 py-2.5 text-right font-medium">Badges</th>
            </tr>
          </thead>
          <tbody>
            {board.isInitialLoading ? (
              Array.from({ length: 8 }, (_, index) => index).map((key) => (
                <tr key={key}>
                  <td className="px-4 py-3" colSpan={4}>
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : board.entries.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={4}>
                  No leaderboard entries yet.
                </td>
              </tr>
            ) : (
              board.entries.map((entry) => {
                const isCurrentUser = entry.user_id === board.currentUserId;
                return (
                  <tr
                    key={entry.user_id}
                    className={cn("border-t", isCurrentUser && "bg-primary/5")}
                  >
                    <td className="px-4 py-2.5">
                      <RankCell rank={entry.rank} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar username={entry.username} size="sm" />
                        <span className={cn("truncate", isCurrentUser && "font-semibold")}>
                          {entry.username}
                        </span>
                        {isCurrentUser ? (
                          <span className="text-xs font-medium text-primary">(you)</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-primary">
                      {entry.total_points.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{entry.badge_count}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasNext={board.hasNext} onPageChange={onPageChange} />
    </div>
  );
}

/**
 * Leaderboard page: owns the current page number (plain `useState` — no URL
 * round-trip needed per the brief) and wraps the table+pager in a
 * `SectionBoundary` whose `onRetry` revalidates the exact current-page SWR key.
 */
export function LeaderboardScreen() {
  const { mutate } = useSWRConfig();
  const [page, setPage] = useState(1);

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Ranked by total points earned.</p>
      </div>

      <SectionBoundary onRetry={() => void mutate(leaderboardKey(page))}>
        <LeaderboardContent page={page} onPageChange={(next) => setPage(Math.max(1, next))} />
      </SectionBoundary>
    </PageContainer>
  );
}
