import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui";
import { timeAgo } from "@/lib/timeAgo";
import type { Comment } from "@/types";

/** One comment row: author, body, timestamp, and (owner-only) the "Mark as solution" control. */
export function CommentItem({
  comment,
  canMarkSolution,
  isMarking,
  onMarkSolution,
}: {
  comment: Comment;
  /** True only when the signed-in user owns the post AND this comment isn't already the solution. */
  canMarkSolution: boolean;
  isMarking: boolean;
  onMarkSolution: (commentId: string) => void;
}) {
  return (
    <div className={comment.is_solution ? "rounded-lg border border-primary/30 bg-primary/5 p-3" : "rounded-lg border p-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{comment.author.username}</span>
          <span>{timeAgo(comment.created_at)}</span>
          {comment.is_solution ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Solution
            </span>
          ) : null}
        </div>
        {canMarkSolution ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={isMarking}
            onClick={() => onMarkSolution(comment.id)}
          >
            Mark as solution
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap">{comment.body}</p>
    </div>
  );
}
