"use client";

import { useState } from "react";
import { CheckCircle2, Reply } from "lucide-react";
import { Button } from "@/components/ui";
import { UserAvatar } from "@/components/UserAvatar";
import { Markdown } from "@/components/Markdown";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types";
import { CommentBox } from "../CommentBox";

/**
 * One comment: avatar, author, markdown body, and actions — a "Reply" toggle
 * that opens an inline composer (owns its own draft + in-flight state and calls
 * `onReply`), plus the owner-only "Mark as solution" control.
 */
export function CommentItem({
  comment,
  canMarkSolution,
  isMarking,
  onMarkSolution,
  onReply,
}: {
  comment: Comment;
  /** True only when the signed-in user owns the post AND this comment isn't already the solution. */
  canMarkSolution: boolean;
  isMarking: boolean;
  onMarkSolution: (commentId: string) => void;
  onReply: (parentId: string, body: string) => Promise<boolean>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitReply = async () => {
    setSubmitting(true);
    const ok = await onReply(comment.id, replyBody);
    setSubmitting(false);
    if (ok) {
      setReplyBody("");
      setReplyOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        comment.is_solution ? "border-success/40 bg-success/5" : "bg-card",
      )}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar username={comment.author.username} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">@{comment.author.username}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(comment.created_at)}</span>
            {comment.is_solution ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Solution
              </span>
            ) : null}
          </div>

          <Markdown content={comment.body} className="mt-1.5" />

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReplyOpen((open) => !open)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <Reply className="size-3.5" aria-hidden />
              Reply
            </button>
            {canMarkSolution ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isMarking}
                onClick={() => onMarkSolution(comment.id)}
                className="gap-1 border-success/40 text-success hover:bg-success/10 hover:text-success"
              >
                <CheckCircle2 className="size-3.5" aria-hidden />
                Mark as solution
              </Button>
            ) : null}
          </div>

          {replyOpen ? (
            <div className="mt-3">
              <CommentBox
                value={replyBody}
                onChange={setReplyBody}
                onSubmit={submitReply}
                onCancel={() => {
                  setReplyOpen(false);
                  setReplyBody("");
                }}
                isSubmitting={submitting}
                placeholder={`Reply to @${comment.author.username}…`}
                submitLabel="Reply"
                autoFocus
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
