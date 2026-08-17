"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { createPost } from "@/services";
import { TOP_FEED_KEY } from "@/screens/Feed/Feed.constants";
import { AppError } from "@/types";
import type { CreatePostInput, Paginated, PostSummary } from "@/types";

/** Public shape of the shared create-post hook. Task 2's Create Post page is its 2nd consumer. */
export interface UseCreatePostResult {
  /**
   * Creates a post, optimistically prepending it to the top-of-feed SWR cache.
   * Resolves to the server `PostSummary` on success, or `undefined` on failure
   * (the cache is rolled back and an error toast is shown — callers don't need
   * to handle the error, but may branch on `undefined`).
   */
  submit: (input: CreatePostInput) => Promise<PostSummary | undefined>;
  isSubmitting: boolean;
}

/** How SWR holds a feed page: `Paginated<PostSummary> | undefined` before first load. */
type FeedCache = Paginated<PostSummary> | undefined;

/** A stable, unique id for the optimistic placeholder row. */
function optimisticId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Build the optimistic placeholder shown at the top of the feed the instant a
 * user submits — before the server confirms. Server-owned counters start at 0
 * and there's no accepted solution yet.
 */
function toOptimisticPost(input: CreatePostInput): PostSummary {
  return {
    id: optimisticId(),
    title: input.title,
    body: input.body,
    tags: input.tags,
    author: { id: "me", username: "you" },
    comment_count: 0,
    upvote_count: 0,
    view_count: 0,
    solution_comment_id: null,
    created_at: new Date().toISOString(),
  };
}

/**
 * Single-responsibility hook for optimistic post creation. Calls
 * `postsService.createPost`, optimistically prepends the new post to the
 * top-of-feed SWR cache (`optimisticData` + `rollbackOnError`), and surfaces a
 * sonner error toast on failure. Shared: reused by the Feed inline composer and
 * (Task 2) the Create Post page.
 */
export function useCreatePost(): UseCreatePostResult {
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = useCallback(
    async (input: CreatePostInput): Promise<PostSummary | undefined> => {
      setIsSubmitting(true);
      const placeholder = toOptimisticPost(input);

      const prepend = (current: FeedCache): FeedCache => {
        if (!current) {
          return current;
        }
        return { ...current, items: [placeholder, ...current.items], total: current.total + 1 };
      };

      let created: PostSummary | undefined;
      try {
        await mutate<FeedCache>(
          TOP_FEED_KEY,
          async (current) => {
            created = await createPost(input);
            if (!current) {
              return current;
            }
            // `current` here is the optimistic cache (placeholder at index 0);
            // drop the placeholder and prepend the real server row instead.
            const withoutPlaceholder = current.items.filter((item) => item.id !== placeholder.id);
            return { ...current, items: [created, ...withoutPlaceholder] };
          },
          {
            optimisticData: prepend,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
        return created;
      } catch (error: unknown) {
        const message =
          error instanceof AppError ? error.message : "Couldn't publish your post. Please try again.";
        toast.error(message);
        return undefined;
      } finally {
        setIsSubmitting(false);
      }
    },
    [mutate],
  );

  return { submit, isSubmitting };
}
