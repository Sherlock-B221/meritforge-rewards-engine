"use client";

import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { getPost, markSolution as markSolutionRequest } from "@/services";
import { useAuthStore } from "@/store";
import { useAuthModalStore } from "@/store/authModalStore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { AppError } from "@/types";
import type { Comment, PostDetail } from "@/types";
import { postDetailKey } from "./PostDetail.constants";
import { useOptimisticComment } from "./useOptimisticComment";
import type { CommentFormValues, PostDetailViewModel } from "./PostDetail.types";

const EMPTY_FORM: CommentFormValues = { body: "" };

/** Depth-first search for a comment by id anywhere in the nested tree. */
function findComment(comments: Comment[], id: string): Comment | null {
  for (const comment of comments) {
    if (comment.id === id) {
      return comment;
    }
    const found = findComment(comment.replies, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * All client logic for the Post Detail screen. Owns: the thread SWR fetch
 * (keyed via the shared `postDetailKey`, reading the dynamic `[id]` route
 * param via `useParams()`), the owner-only gate for "Mark as solution", and
 * the top-level comment composer (delegated to the screen-local
 * `useOptimisticComment` hook).
 *
 * On an unexpected `AppError` the hook RE-THROWS so the surrounding
 * `<SectionBoundary>` renders the retry fallback.
 */
export function usePostDetail(): PostDetailViewModel {
  const params = useParams<{ id: string }>();
  const postId = params.id;
  const currentUser = useAuthStore((state) => state.user);
  const guard = useAuthGuard();
  const openAuthModal = useAuthModalStore((state) => state.open);

  const { data, error, isLoading, mutate } = useSWR<PostDetail, AppError>(
    postDetailKey(postId),
    () => getPost(postId),
  );

  // Unexpected failures bubble to the SectionBoundary; the page stays usable.
  if (error) {
    throw error;
  }

  const acceptedSolution = useMemo<Comment | null>(() => {
    if (!data || data.solution_comment_id === null) {
      return null;
    }
    return findComment(data.comments, data.solution_comment_id);
  }, [data]);

  const isOwner = Boolean(currentUser && data && currentUser.id === data.author.id);

  const [commentForm, setCommentForm] = useState<CommentFormValues>(EMPTY_FORM);
  const { submitComment: submitCommentRequest, isSubmitting: isSubmittingComment } =
    useOptimisticComment(postId);

  const setCommentBody = useCallback((body: string) => {
    setCommentForm({ body });
  }, []);

  const submitCommentForm = useCallback(() => {
    const body = commentForm.body.trim();
    if (!body) {
      return;
    }
    // Anonymous → login popup; the drafted comment is replayed after auth.
    guard(() => {
      void submitCommentRequest({ body }).then((created) => {
        if (created) {
          setCommentForm(EMPTY_FORM);
        }
      });
    });
  }, [commentForm, submitCommentRequest, guard]);

  const submitReply = useCallback(
    async (parentId: string, body: string): Promise<boolean> => {
      const trimmed = body.trim();
      if (!trimmed) {
        return false;
      }
      if (!useAuthStore.getState().token) {
        // Anonymous → open the login popup; the reply is replayed after auth.
        openAuthModal(() => {
          void submitCommentRequest({ body: trimmed, parent_comment_id: parentId });
        }, "login");
        return false;
      }
      const created = await submitCommentRequest({ body: trimmed, parent_comment_id: parentId });
      return Boolean(created);
    },
    [submitCommentRequest, openAuthModal],
  );

  const [markingCommentId, setMarkingCommentId] = useState<string | null>(null);

  const markSolution = useCallback(
    (commentId: string) => {
      setMarkingCommentId(commentId);
      markSolutionRequest(postId, commentId)
        .then((updated) => {
          void mutate(updated, { revalidate: false });
        })
        .catch((markError: unknown) => {
          const message =
            markError instanceof AppError
              ? markError.message
              : "Couldn't mark this as the solution. Please try again.";
          toast.error(message);
        })
        .finally(() => {
          setMarkingCommentId(null);
        });
    },
    [postId, mutate],
  );

  return {
    post: data,
    isInitialLoading: isLoading && !data,
    acceptedSolution,
    isOwner,
    commentForm,
    setCommentBody,
    submitComment: submitCommentForm,
    isSubmittingComment,
    submitReply,
    currentUsername: currentUser?.username,
    markSolution,
    markingCommentId,
  };
}
