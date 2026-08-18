import type { Comment } from "@/types";
import { CommentItem } from "../CommentItem";

/**
 * Renders a comment and its `replies` recursively, indenting each nesting level
 * with a threading line. `isOwner` gates "Mark as solution" (owner-only);
 * `onReply` threads a new reply under the correct parent via the screen's
 * optimistic submit.
 */
export function CommentTree({
  comments,
  isOwner,
  markingCommentId,
  onMarkSolution,
  onReply,
  depth = 0,
}: {
  comments: Comment[];
  isOwner: boolean;
  markingCommentId: string | null;
  onMarkSolution: (commentId: string) => void;
  onReply: (parentId: string, body: string) => Promise<boolean>;
  depth?: number;
}) {
  if (comments.length === 0 && depth === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No comments yet — be the first to reply.
      </p>
    );
  }

  return (
    <ul className={depth > 0 ? "mt-2 space-y-2 border-l pl-3 sm:pl-4" : "space-y-2"}>
      {comments.map((comment) => (
        <li key={comment.id}>
          <CommentItem
            comment={comment}
            canMarkSolution={isOwner && !comment.is_solution}
            isMarking={markingCommentId === comment.id}
            onMarkSolution={onMarkSolution}
            onReply={onReply}
          />
          {comment.replies.length > 0 ? (
            <CommentTree
              comments={comment.replies}
              isOwner={isOwner}
              markingCommentId={markingCommentId}
              onMarkSolution={onMarkSolution}
              onReply={onReply}
              depth={depth + 1}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
