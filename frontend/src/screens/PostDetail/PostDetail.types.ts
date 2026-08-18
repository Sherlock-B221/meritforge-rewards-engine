import type { Comment, PostDetail } from "@/types";

/** Local form state for the (top-level, for now) comment composer. */
export interface CommentFormValues {
  body: string;
}

/** Everything `Screen.tsx` needs from `usePostDetail` — logic lives in the hook. */
export interface PostDetailViewModel {
  post: PostDetail | undefined;
  isInitialLoading: boolean;

  /** The accepted-solution comment, if any (looked up by `solution_comment_id`). */
  acceptedSolution: Comment | null;

  /** True when the signed-in user owns this post — gates the "Mark as solution" control. */
  isOwner: boolean;

  commentForm: CommentFormValues;
  setCommentBody: (body: string) => void;
  submitComment: () => void;
  isSubmittingComment: boolean;

  /** Post a reply to a specific comment; resolves `true` on success. */
  submitReply: (parentId: string, body: string) => Promise<boolean>;
  /** Signed-in user's handle, for the composer avatar. */
  currentUsername: string | undefined;

  markSolution: (commentId: string) => void;
  /** The comment currently being marked as solution (in flight), or `null`. */
  markingCommentId: string | null;
}
