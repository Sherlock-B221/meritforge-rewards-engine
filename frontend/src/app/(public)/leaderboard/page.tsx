import type { Metadata } from "next";
import { SWRConfig, unstable_serialize } from "swr";
import LeaderboardScreen from "@/screens/Leaderboard";
import { LEADERBOARD_PAGE_SIZE, leaderboardKey } from "@/screens/Leaderboard/Leaderboard.constants";
import { serverFetch } from "@/services/serverFetch";
import type { LeaderboardEntry, Paginated } from "@/types";

export const metadata: Metadata = {
  title: "Leaderboard — meritforge",
  description:
    "Top contributors on meritforge, ranked by points earned from community challenges.",
};

/**
 * Public, server-rendered leaderboard. The screen owns its page number in local
 * state starting at page 1, so we seed page 1 into SWR for crawlable HTML on
 * first paint; later pages fetch client-side.
 */
export default async function LeaderboardPage() {
  let fallback: Record<string, unknown> = {};
  try {
    const data = await serverFetch<Paginated<LeaderboardEntry>>(
      `/leaderboard?page=1&limit=${LEADERBOARD_PAGE_SIZE}`,
    );
    fallback = { [unstable_serialize(leaderboardKey(1))]: data };
  } catch {
    // SSR seed failed — the client fetches + shows skeletons.
  }

  return (
    <SWRConfig value={{ fallback }}>
      <LeaderboardScreen />
    </SWRConfig>
  );
}
