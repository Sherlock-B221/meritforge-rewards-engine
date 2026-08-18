"use client";

import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { ArrowUp, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { SectionBoundary, SkeletonCard } from "@/components/feedback";
import { timeAgo } from "@/lib/timeAgo";
import { useUpvote } from "@/hooks";
import { postDetailKey } from "./PostDetail.constants";
import { usePostDetail } from "./useScreen";
import { CommentTree } from "./components";

/** Post header: title, author, meta, tags, body, upvote control. */
function PostHeader({
  title,
  body,
  tags,
  author,
  createdAt,
  isSolved,
  upvoteCount,
  justUpvoted,
  isUpvoting,
  onUpvote,
}: {
  title: string;
  body: string;
  tags: string[];
  author: string;
  createdAt: string;
  isSolved: boolean;
  upvoteCount: number;
  justUpvoted: boolean;
  isUpvoting: boolean;
  onUpvote: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-lg font-semibold leading-snug">{title}</h1>
          {isSolved ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              ✓ solved
            </span>
          ) : null}
        </div>

        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="text-sm whitespace-pre-wrap">{body}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{author}</span>
          <span>{timeAgo(createdAt)}</span>
          <Button
            type="button"
            variant={justUpvoted ? "default" : "outline"}
            size="sm"
            disabled={isUpvoting}
            onClick={onUpvote}
            aria-pressed={justUpvoted}
            aria-label="Upvote this post"
          >
            <ArrowUp className="size-3.5" aria-hidden />
            {upvoteCount}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Comment composer — top-level comments only; optimistic via `useOptimisticComment`. */
function CommentComposer({
  body,
  isSubmitting,
  onBodyChange,
  onSubmit,
}: {
  body: string;
  isSubmitting: boolean;
  onBodyChange: (body: string) => void;
  onSubmit: () => void;
}) {
  const canSubmit = body.trim().length > 0 && !isSubmitting;
  return (
    <form
      className="space-y-2 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        className="min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        placeholder="Write a reply…"
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        aria-label="Comment body"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {isSubmitting ? "Posting…" : "Reply"}
        </Button>
      </div>
    </form>
  );
}

/** Everything that depends on thread data — lives inside the SectionBoundary so failures degrade here. */
function PostDetailContent() {
  const detail = usePostDetail();
  const params = useParams<{ id: string }>();
  const { upvote, isUpvoting, justUpvoted } = useUpvote(params.id);

  if (detail.isInitialLoading || !detail.post) {
    return (
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const { post } = detail;

  return (
    <div className="space-y-4">
      <PostHeader
        title={post.title}
        body={post.body}
        tags={post.tags}
        author={post.author.username}
        createdAt={post.created_at}
        isSolved={post.solution_comment_id !== null}
        upvoteCount={post.upvote_count}
        justUpvoted={justUpvoted}
        isUpvoting={isUpvoting}
        onUpvote={upvote}
      />

      {detail.acceptedSolution ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <CheckCircle2 className="size-4" aria-hidden />
              Accepted solution
            </div>
            <p className="text-sm whitespace-pre-wrap">{detail.acceptedSolution.body}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {detail.acceptedSolution.author.username}
              </span>
              <span>{timeAgo(detail.acceptedSolution.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CommentComposer
        body={detail.commentForm.body}
        isSubmitting={detail.isSubmittingComment}
        onBodyChange={detail.setCommentBody}
        onSubmit={detail.submitComment}
      />

      <CommentTree
        comments={post.comments}
        isOwner={detail.isOwner}
        markingCommentId={detail.markingCommentId}
        onMarkSolution={detail.markSolution}
      />
    </div>
  );
}

/**
 * Post Detail shell: reads the dynamic `[id]` route param via `useParams()`
 * (same value `usePostDetail` reads internally) so the `SectionBoundary`
 * retries the exact SWR key the screen fetches, and wraps the thread render.
 */
export function PostDetailScreen() {
  const { mutate } = useSWRConfig();
  const { id: postId } = useParams<{ id: string }>();

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <SectionBoundary onRetry={() => void mutate(postDetailKey(postId))}>
        <PostDetailContent />
      </SectionBoundary>
    </div>
  );
}
