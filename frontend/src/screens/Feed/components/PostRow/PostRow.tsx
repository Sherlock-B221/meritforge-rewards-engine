"use client";

import Link from "next/link";
import { ArrowUp, Check, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { UserAvatar } from "@/components/UserAvatar";
import { timeAgo } from "@/lib/timeAgo";
import { useUpvote } from "@/hooks";
import { cn } from "@/lib/utils";
import type { PostSummary } from "@/types";

/** One feed row: avatar, title (links to the thread), tags, author/meta, and an upvote cell. */
export function PostRow({ post }: { post: PostSummary }) {
  const isSolved = post.solution_comment_id !== null;
  const { upvote, isUpvoting, justUpvoted } = useUpvote(post.id);

  return (
    <Card size="sm" className="transition-shadow hover:shadow-sm hover:ring-foreground/20">
      <CardContent className="flex gap-3">
        <UserAvatar username={post.author.username} className="mt-0.5" />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/posts/${post.id}`}
              className="font-heading text-sm font-semibold leading-snug hover:text-primary"
            >
              {post.title}
            </Link>
            {isSolved ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                <Check className="size-3" aria-hidden />
                solved
              </span>
            ) : null}
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

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">@{post.author.username}</span>
            <span aria-hidden>·</span>
            <span>{timeAgo(post.created_at)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" aria-hidden />
              {post.comment_count}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isUpvoting}
          aria-pressed={justUpvoted}
          aria-label="Upvote this post"
          onClick={(event) => {
            event.stopPropagation();
            upvote();
          }}
          className={cn(
            "flex h-fit shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
            justUpvoted
              ? "border-primary/40 bg-primary/10 text-primary"
              : "text-muted-foreground hover:border-foreground/20 hover:text-foreground",
          )}
        >
          <ArrowUp className={cn("size-4", justUpvoted && "fill-current")} aria-hidden />
          <span className="font-semibold tabular-nums">{post.upvote_count}</span>
        </button>
      </CardContent>
    </Card>
  );
}
