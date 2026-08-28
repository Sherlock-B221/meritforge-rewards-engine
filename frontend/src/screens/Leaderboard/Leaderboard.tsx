"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Crown } from "lucide-react";
import { SectionBoundary, SkeletonRow } from "@/components/feedback";
import { PageContainer } from "@/components/PageContainer";
import { Pagination } from "@/components/Pagination";
import { UserAvatar } from "@/components/UserAvatar";
import { LevelBadge } from "@/components/gamification";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";
import { leaderboardKey } from "./Leaderboard.constants";
import { useLeaderboard } from "./useLeaderboard";

/** Rank tone for medal chips + podium, using semantic tokens (dark-mode safe). */
function rankTone(rank: number): string {
  if (rank === 1) return "bg-reward/15 text-reward-foreground ring-reward/50";
  if (rank === 2) return "bg-secondary text-secondary-foreground ring-border";
  if (rank === 3) return "bg-streak/15 text-streak ring-streak/40";
  return "";
}

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className={cn(
          "inline-grid size-6 place-items-center rounded-full text-xs font-bold ring-1",
          rankTone(rank),
        )}
      >
        {rank}
      </span>
    );
  }
  return <span className="pl-1 text-sm tabular-nums text-muted-foreground">#{rank}</span>;
}

/** One raised podium card for a top-3 finisher. */
function PodiumCard({ entry, isYou }: { entry: LeaderboardEntry; isYou: boolean }) {
  const { rank } = entry;
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center rounded-2xl border p-4 text-center ring-1 shadow-card",
        rankTone(rank),
        rank === 1 && "sm:-translate-y-2",
      )}
    >
      <div className="relative">
        <UserAvatar username={entry.username} size="lg" />
        <span
          className={cn(
            "absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full text-xs font-bold ring-2 ring-card",
            rank === 1
              ? "bg-reward text-reward-foreground"
              : rank === 3
                ? "bg-streak text-streak-foreground"
                : "bg-secondary text-secondary-foreground",
          )}
        >
          {rank}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        {rank === 1 ? <Crown className="size-4 text-reward" aria-hidden /> : null}
        <span className="max-w-[8rem] truncate font-display font-semibold">{entry.username}</span>
      </div>
      {isYou ? <span className="text-xs font-medium text-primary">(you)</span> : null}
      <span className="mt-1 font-display text-xl font-bold tabular-nums text-primary">
        {entry.total_points.toLocaleString("en-US")}
      </span>
      <span className="text-xs text-muted-foreground">points</span>
      <LevelBadge points={entry.total_points} className="mt-2" />
    </div>
  );
}

/** Top-3 podium, arranged 2 · 1 · 3 with the champion raised. */
function Podium({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId: string | null }) {
  const [first, second, third] = entries;
  const ordered = [second, first, third].filter(Boolean) as LeaderboardEntry[];
  if (ordered.length === 0) return null;
  return (
    <div className="flex items-end justify-center gap-3 pt-2 sm:gap-4">
      {ordered.map((entry) => (
        <PodiumCard key={entry.user_id} entry={entry} isYou={entry.user_id === currentUserId} />
      ))}
    </div>
  );
}

/**
 * Everything that depends on leaderboard data — podium (page 1) + table + pager
 * — lives inside the screen's `SectionBoundary` so a fetch failure degrades here.
 */
function LeaderboardContent({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const board = useLeaderboard(page);
  const showPodium = page === 1 && board.entries.length > 0;
  const tableEntries = showPodium ? board.entries.slice(3) : board.entries;

  return (
    <div className="space-y-5">
      {showPodium ? <Podium entries={board.entries} currentUserId={board.currentUserId} /> : null}

      <div className="overflow-hidden rounded-2xl border shadow-card">
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
            ) : tableEntries.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={4}>
                  {showPodium ? "That's everyone so far." : "No leaderboard entries yet."}
                </td>
              </tr>
            ) : (
              tableEntries.map((entry) => {
                const isCurrentUser = entry.user_id === board.currentUserId;
                return (
                  <tr key={entry.user_id} className={cn("border-t", isCurrentUser && "bg-primary/5")}>
                    <td className="px-4 py-2.5">
                      <RankCell rank={entry.rank} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar username={entry.username} size="sm" />
                        <span className={cn("truncate", isCurrentUser && "font-semibold")}>
                          {entry.username}
                        </span>
                        <LevelBadge points={entry.total_points} className="hidden sm:inline-flex" />
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
 * Leaderboard page: owns the current page number (plain `useState`) and wraps
 * the podium+table+pager in a `SectionBoundary` whose `onRetry` revalidates the
 * exact current-page SWR key.
 */
export function LeaderboardScreen() {
  const { mutate } = useSWRConfig();
  const [page, setPage] = useState(1);

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="text-h1">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Top contributors, ranked by points earned.</p>
      </div>

      <SectionBoundary onRetry={() => void mutate(leaderboardKey(page))}>
        <LeaderboardContent page={page} onPageChange={(next) => setPage(Math.max(1, next))} />
      </SectionBoundary>
    </PageContainer>
  );
}
