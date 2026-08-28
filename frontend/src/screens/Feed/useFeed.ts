"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { getFeed, type FeedSort } from "@/services";
import { useCreatePost, useUrlState } from "@/hooks";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AppError } from "@/types";
import type { Paginated, PostSummary } from "@/types";
import { FEED_DEFAULTS, FEED_PAGE_SIZE, feedKey } from "./Feed.constants";
import type { ComposerValues, FeedViewModel } from "./Feed.types";

/** Coerce a raw URL string into a valid `FeedSort` (defaults to "latest"). */
function toSort(raw: string): FeedSort {
  return raw === "trending" ? "trending" : "latest";
}

/** Coerce a raw URL page string into a 1-based positive integer. */
function toPage(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

const EMPTY_COMPOSER: ComposerValues = { title: "", body: "", tags: [] };

/**
 * All client logic for the Feed screen. Owns: URL state (sort/page/search),
 * the SWR fetch keyed via the shared `feedKey`, client-side search filtering
 * over the current page, and the inline optimistic composer (via the shared
 * `useCreatePost`). Sort + page round-trip through the API + URL; search
 * filters the already-fetched page (documented choice — no extra request, and
 * back-nav still restores the term because it lives in the URL).
 *
 * On an unexpected `AppError` the hook RE-THROWS so the surrounding
 * `<SectionBoundary>` renders the retry fallback.
 */
export function useFeed(): FeedViewModel {
  const [urlState, setUrlState] = useUrlState(FEED_DEFAULTS);
  const sort = toSort(urlState.sort);
  const page = toPage(urlState.page);
  const search = urlState.search;

  const { data, error, isLoading, mutate } = useSWR<Paginated<PostSummary>, AppError>(
    feedKey({ sort, page }),
    ([, sortKey, pageKey]: readonly [string, FeedSort, number]) =>
      getFeed({ sort: sortKey, page: pageKey, limit: FEED_PAGE_SIZE }),
  );

  // Unexpected failures bubble to the SectionBoundary; the page stays usable.
  if (error) {
    throw error;
  }

  const posts = useMemo<PostSummary[]>(() => {
    const items = data?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) {
      return items;
    }
    return items.filter(
      (post) =>
        post.title.toLowerCase().includes(term) ||
        post.tags.some((tag) => tag.toLowerCase().includes(term)),
    );
  }, [data, search]);

  const setSort = useCallback(
    (next: FeedSort) => {
      // Changing sort resets to page 1.
      setUrlState({ sort: next, page: "1" });
    },
    [setUrlState],
  );

  const setSearch = useCallback(
    (next: string) => {
      setUrlState({ search: next });
    },
    [setUrlState],
  );

  const goToPage = useCallback(
    (next: number) => {
      setUrlState({ page: String(Math.max(1, next)) });
    },
    [setUrlState],
  );

  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  const [composer, setComposer] = useState<ComposerValues>(EMPTY_COMPOSER);
  const { submit, isSubmitting } = useCreatePost();
  const guard = useAuthGuard();

  const setComposerField = useCallback((field: "title" | "body", value: string) => {
    setComposer((prev) => ({ ...prev, [field]: value }));
  }, []);

  const setComposerTags = useCallback((tags: string[]) => {
    setComposer((prev) => ({ ...prev, tags }));
  }, []);

  const submitComposer = useCallback(() => {
    const title = composer.title.trim();
    const body = composer.body.trim();
    if (!title || !body) {
      return;
    }
    // Anonymous → login popup; the drafted post is replayed after auth.
    guard(() => {
      void submit({ title, body, tags: composer.tags }).then((created) => {
        if (created) {
          setComposer(EMPTY_COMPOSER);
        }
      });
    });
  }, [composer, submit, guard]);

  return {
    posts,
    isLoading,
    isInitialLoading: isLoading && !data,
    sort,
    setSort,
    search,
    setSearch,
    page,
    hasNext: data?.has_next ?? false,
    goToPage,
    retry,
    composer,
    setComposerField,
    setComposerTags,
    submitComposer,
    isSubmitting,
  };
}
