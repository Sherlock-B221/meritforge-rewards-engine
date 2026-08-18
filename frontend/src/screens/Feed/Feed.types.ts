import type { PostSummary } from "@/types";
import type { FeedSort } from "@/services";

/** The composer's two-field local form state (inline optimistic affordance). */
export interface ComposerValues {
  title: string;
  body: string;
  tags: string[];
}

/** Everything `Feed.tsx` needs from `useFeed` — logic lives in the hook, props stay presentational. */
export interface FeedViewModel {
  /** Rows for the current (sort, page), already client-side filtered by search. */
  posts: PostSummary[];
  isLoading: boolean;
  /** True on first load with no data yet — drives skeleton rows. */
  isInitialLoading: boolean;

  sort: FeedSort;
  setSort: (sort: FeedSort) => void;

  search: string;
  setSearch: (search: string) => void;

  page: number;
  hasNext: boolean;
  goToPage: (page: number) => void;

  /** Re-fetch the current page — passed to `SectionBoundary`'s `onRetry`. */
  retry: () => void;

  composer: ComposerValues;
  setComposerField: (field: "title" | "body", value: string) => void;
  setComposerTags: (tags: string[]) => void;
  submitComposer: () => void;
  isSubmitting: boolean;
}
