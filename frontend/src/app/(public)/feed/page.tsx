import type { Metadata } from "next";
import { SWRConfig, unstable_serialize } from "swr";
import FeedScreen from "@/screens/Feed";
import { FEED_PAGE_SIZE, feedKey } from "@/screens/Feed/Feed.constants";
import { serverFetch } from "@/services/serverFetch";
import type { FeedSort } from "@/services";
import type { Paginated, PostSummary } from "@/types";

export const metadata: Metadata = {
  title: "Feed — meritforge",
  description:
    "Browse the latest developer questions, answers, and discussions on meritforge — earn points, badges & streaks by contributing.",
};

function toSort(raw: string | undefined): FeedSort {
  return raw === "trending" ? "trending" : "latest";
}

function toPage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

/**
 * Public, server-rendered feed. Fetches the requested (sort, page) anonymously
 * on the server and seeds SWR via `SWRConfig` fallback so the list renders in
 * crawlable HTML on first paint; the client `Feed` screen then hydrates and
 * takes over polling / optimistic writes / URL state.
 */
export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const sort = toSort(sp.sort);
  const page = toPage(sp.page);

  let fallback: Record<string, unknown> = {};
  try {
    const data = await serverFetch<Paginated<PostSummary>>(
      `/posts?sort=${sort}&page=${page}&limit=${FEED_PAGE_SIZE}`,
    );
    fallback = { [unstable_serialize(feedKey({ sort, page }))]: data };
  } catch {
    // SSR seed failed — render unseeded; the client fetches + shows skeletons.
  }

  return (
    <SWRConfig value={{ fallback }}>
      <FeedScreen />
    </SWRConfig>
  );
}
