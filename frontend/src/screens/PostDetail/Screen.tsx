"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { ArrowUp, Check, CheckCircle2, ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { SectionBoundary, SkeletonCard } from "@/components/feedback";
import { PageContainer } from "@/components/PageContainer";
import { UserAvatar } from "@/components/UserAvatar";
import { Markdown } from "@/components/Markdown";
import { timeAgo } from "@/lib/timeAgo";
import { cn } from "@/lib/utils";
import { useUpvote } from "@/hooks";
import { postDetailKey } from "./PostDetail.constants";
import { usePostDetail } from "./useScreen";
import { CommentBox, CommentTree } from "./components";

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
  const isSolved = post.solution_comment_id !== null;
  const commentLabel = post.comment_count === 1 ? "comment" : "comments";

  return (
    <div className="space-y-4">
      <Link
        href="/feed"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Feed
        {post.tags[0] ? <span className="text-muted-foreground/70">/ {post.tags[0]}</span> : null}
      </Link>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-heading text-xl font-semibold leading-snug">{post.title}</h1>
            {isSolved ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <Check className="size-3" aria-hidden />
                solved
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar username={post.author.username} size="sm" />
            <span className="font-medium text-foreground">@{post.author.username}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>

          {post.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag} className="tag-chip">
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          <Markdown content={post.body} />

          <div className="pt-1">
            <button
              type="button"
              disabled={isUpvoting}
              aria-pressed={justUpvoted}
              aria-label="Upvote this post"
              onClick={upvote}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                justUpvoted
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              <ArrowUp className={cn("size-4", justUpvoted && "fill-current")} aria-hidden />
              Upvote
              <span className="tabular-nums">{post.upvote_count}</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {detail.acceptedSolution ? (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden />
              Accepted solution
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserAvatar username={detail.acceptedSolution.author.username} size="sm" />
              <span className="font-medium text-foreground">
                @{detail.acceptedSolution.author.username}
              </span>
              <span aria-hidden>·</span>
              <span>{timeAgo(detail.acceptedSolution.created_at)}</span>
            </div>
            <Markdown content={detail.acceptedSolution.body} />
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          {post.comment_count} {commentLabel}
        </h2>
        <CommentTree
          comments={post.comments}
          isOwner={detail.isOwner}
          markingCommentId={detail.markingCommentId}
          onMarkSolution={detail.markSolution}
          onReply={detail.submitReply}
        />
      </section>

      <Card size="sm">
        <CardContent className="flex items-start gap-3">
          {detail.currentUsername ? (
            <UserAvatar username={detail.currentUsername} size="sm" className="mt-0.5" />
          ) : null}
          <div className="min-w-0 flex-1">
            <CommentBox
              value={detail.commentForm.body}
              onChange={detail.setCommentBody}
              onSubmit={detail.submitComment}
              isSubmitting={detail.isSubmittingComment}
              placeholder="Write a comment…"
              submitLabel="Comment"
            />
          </div>
        </CardContent>
      </Card>
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
    <PageContainer className="space-y-4">
      <SectionBoundary onRetry={() => void mutate(postDetailKey(postId))}>
        <PostDetailContent />
      </SectionBoundary>
    </PageContainer>
  );
}
