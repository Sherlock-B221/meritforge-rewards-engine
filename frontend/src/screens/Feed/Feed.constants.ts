import type { FeedSort } from "@/services";

/**
 * URL-state keys the feed owns. `useUrlState` keeps values as plain strings —
 * declaring the value type as `string` (not literals) keeps the setter open to
 * any sort/page/search value.
 */
export type FeedUrlState = {
  sort: string;
  page: string;
  search: string;
};

/** URL-state defaults for the feed. */
export const FEED_DEFAULTS: FeedUrlState = {
  sort: "latest",
  page: "1",
  search: "",
};

/** The two feed tabs, in display order. */
export const FEED_SORTS: ReadonlyArray<{ value: FeedSort; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "trending", label: "Trending" },
];

/** Page size requested from the API (kept small for a snappy list). */
export const FEED_PAGE_SIZE = 20;

/**
 * The single source of truth for a feed page's SWR cache key. Both `useFeed`
 * (which reads it) and `useCreatePost` (which optimistically prepends into it)
 * MUST derive the key from here so they mutate the same cache entry. Search is
 * intentionally NOT part of the key — it filters client-side over the fetched
 * page, so the cache is shared across searches within a (sort, page).
 */
export function feedKey(params: { sort: FeedSort; page: number }): readonly [string, FeedSort, number] {
  return ["feed", params.sort, params.page] as const;
}

/**
 * The canonical "top of feed" key — latest sort, first page. A freshly created
 * post belongs at the top of this view, so `useCreatePost` prepends here.
 */
export const TOP_FEED_KEY = feedKey({ sort: "latest", page: 1 });
