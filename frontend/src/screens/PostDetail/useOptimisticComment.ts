"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { addComment } from "@/services";
import { useAuthStore } from "@/store";
import { AppError } from "@/types";
import type { Comment, CommentCreateInput, PostDetail } from "@/types";
import { postDetailKey } from "./PostDetail.constants";

/** How SWR holds a thread: `PostDetail | undefined` before first load. */
type PostDetailCache = PostDetail | undefined;

/** A stable, unique id for the optimistic placeholder comment. */
function optimisticId(): string {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Insert `comment` into the tree: top-level if no parent, else nested under its parent's `replies`. */
function insertComment(comments: Comment[], comment: Comment): Comment[] {
  if (comment.parent_comment_id === null) {
    return [...comments, comment];
  }
  return comments.map((existing) =>
    existing.id === comment.parent_comment_id
      ? { ...existing, replies: [...existing.replies, comment] }
      : { ...existing, replies: insertComment(existing.replies, comment) },
  );
}

/** Remove a comment (e.g. the optimistic placeholder) from the tree by id, wherever it is nested. */
function removeComment(comments: Comment[], id: string): Comment[] {
  return comments
    .filter((existing) => existing.id !== id)
    .map((existing) => ({ ...existing, replies: removeComment(existing.replies, id) }));
}

/**
 * Single-responsibility hook: optimistically posts a comment into a thread's
 * nested tree. Inserts a placeholder row immediately (`optimisticData`),
 * calls `addComment`, then swaps the placeholder for the server row —
 * `rollbackOnError` restores the prior tree and a sonner toast surfaces the
 * failure. Screen-local (not promoted to `hooks/` — PostDetail is its only
 * consumer today).
 */
export function useOptimisticComment(postId: string): {
  submitComment: (input: CommentCreateInput) => Promise<Comment | undefined>;
  isSubmitting: boolean;
} {
  const { mutate } = useSWRConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUser = useAuthStore((state) => state.user);

  const submitComment = useCallback(
    async (input: CommentCreateInput): Promise<Comment | undefined> => {
      setIsSubmitting(true);
      const placeholderId = optimisticId();
      const placeholder: Comment = {
        id: placeholderId,
        post_id: postId,
        parent_comment_id: input.parent_comment_id ?? null,
        author: currentUser
          ? { id: currentUser.id, username: currentUser.username }
          : { id: "me", username: "you" },
        body: input.body,
        is_solution: false,
        created_at: new Date().toISOString(),
        replies: [],
      };

      let created: Comment | undefined;
      try {
        await mutate<PostDetailCache>(
          postDetailKey(postId),
          async (current) => {
            created = await addComment(postId, input);
            if (!current) {
              return current;
            }
            const withoutPlaceholder = removeComment(current.comments, placeholderId);
            return { ...current, comments: insertComment(withoutPlaceholder, created) };
          },
          {
            optimisticData: (current) =>
              current ? { ...current, comments: insertComment(current.comments, placeholder) } : current,
            rollbackOnError: true,
            revalidate: false,
            populateCache: true,
          },
        );
        return created;
      } catch (error: unknown) {
        const message =
          error instanceof AppError ? error.message : "Couldn't post your comment. Please try again.";
        toast.error(message);
        return undefined;
      } finally {
        setIsSubmitting(false);
      }
    },
    [postId, mutate, currentUser],
  );

  return { submitComment, isSubmitting };
}
