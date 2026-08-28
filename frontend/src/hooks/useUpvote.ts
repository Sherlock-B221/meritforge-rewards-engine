"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { upvotePost } from "@/services";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { postDetailKey } from "@/screens/PostDetail/PostDetail.constants";
import { AppError } from "@/types";
import type { Paginated, PostDetail, PostSummary } from "@/types";

/** Public shape of the shared upvote hook. PostDetail and Feed's PostRow are its two consumers. */
export interface UseUpvoteResult {
  upvote: () => void;
  isUpvoting: boolean;
  /**
   * Flips true after a successful call, purely to switch this button's icon
   * from outline to filled. Doesn't persist across reload: `GET /posts` /
   * `GET /posts/:id` don't return a per-viewer "have I upvoted this" flag
   * today, only the aggregate `upvote_count` — so "already upvoted" state
   * can't be restored from a fresh load. This is a deliberate, documented
   * scope trim, not a bug.
   */
  justUpvoted: boolean;
}

/** Bump a cached `PostDetail`'s `upvote_count` by 1 if it's the post being upvoted, else pass through unchanged. */
function bumpPostDetail(postId: string) {
  return (current: PostDetail | undefined): PostDetail | undefined => {
    if (!current || current.id !== postId) {
      return current;
    }
    return { ...current, upvote_count: current.upvote_count + 1 };
  };
}

/**
 * Bump the matching item's `upvote_count` inside a cached feed page. Returns
 * the same `current` reference when the post isn't on this page, so
 * unrelated feed pages aren't needlessly touched.
 */
function bumpFeedPage(postId: string) {
  return (current: Paginated<PostSummary> | undefined): Paginated<PostSummary> | undefined => {
    if (!current || !current.items.some((item) => item.id === postId)) {
      return current;
    }
    return {
      ...current,
      items: current.items.map((item) =>
        item.id === postId ? { ...item, upvote_count: item.upvote_count + 1 } : item,
      ),
    };
  };
}

/**
 * Single-responsibility hook for upvoting a post. Optimistically bumps
 * `upvote_count` in every SWR cache entry currently holding this post — the
 * `PostDetail` object under `["post", postId]` (see `postDetailKey`) and any
 * `Paginated<PostSummary>` feed page containing it under `["feed", sort,
 * page]` — the instant the button is clicked, via `optimisticData` on
 * `useSWRConfig()`'s global `mutate`. The feed side uses the function
 * key-matcher form (`mutate(matcherFn, updater, opts)`) since several feed
 * pages may be cached at once. The actual `upvotePost` call is threaded
 * through the detail-cache mutate's async updater (mirroring `useCreatePost`
 * / `useOptimisticComment`'s "updater performs the write" pattern); the
 * feed-cache mutate then applies the same confirmed bump. `rollbackOnError`
 * restores both caches if the request fails.
 *
 * The backend is idempotent per (post, user), so a second click on an
 * already-upvoted post is a harmless no-op server-side; this hook only
 * guards against double-submit while a request is in flight. Shared:
 * PostDetail and Feed's PostRow are its two consumers on day one.
 */
export function useUpvote(postId: string): UseUpvoteResult {
  const { mutate } = useSWRConfig();
  const guard = useAuthGuard();
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [justUpvoted, setJustUpvoted] = useState(false);

  const runUpvote = useCallback(() => {
    if (isUpvoting) {
      return;
    }
    setIsUpvoting(true);

    const bumpDetail = bumpPostDetail(postId);
    const bumpFeed = bumpFeedPage(postId);

    void (async () => {
      try {
        await mutate<PostDetail>(
          postDetailKey(postId),
          async (current) => {
            await upvotePost(postId);
            return bumpDetail(current);
          },
          {
            optimisticData: (current, displayed) => bumpDetail(current ?? displayed) as PostDetail,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );

        await mutate<Paginated<PostSummary>>(
          (key) => Array.isArray(key) && key[0] === "feed",
          (current) => bumpFeed(current),
          {
            optimisticData: (current, displayed) => bumpFeed(current ?? displayed) as Paginated<PostSummary>,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );

        setJustUpvoted(true);
      } catch (error: unknown) {
        const message =
          error instanceof AppError ? error.message : "Couldn't upvote this post. Please try again.";
        toast.error(message);
      } finally {
        setIsUpvoting(false);
      }
    })();
  }, [postId, mutate, isUpvoting]);

  // Anonymous click → open the login popup and replay the upvote after auth.
  const upvote = useCallback(() => guard(runUpvote), [guard, runUpvote]);

  return { upvote, isUpvoting, justUpvoted };
}
