import type { LeaderboardEntry } from "@/types/engine";

export interface TopThisWeekContentProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
}
