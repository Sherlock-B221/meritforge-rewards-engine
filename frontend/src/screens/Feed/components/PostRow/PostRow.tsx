import Link from "next/link";
import { MessageSquare, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { timeAgo } from "@/lib/timeAgo";
import { useUpvote } from "@/hooks";
import type { PostSummary } from "@/types";

/** One feed row: title (links to the thread), tags, author, relative time, and stats. */
export function PostRow({ post }: { post: PostSummary }) {
  const isSolved = post.solution_comment_id !== null;
  const { upvote, isUpvoting, justUpvoted } = useUpvote(post.id);

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/posts/${post.id}`}
            className="font-heading text-sm font-medium leading-snug hover:underline"
          >
            {post.title}
          </Link>
          {isSolved ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              ✓ solved
            </span>
          ) : null}
        </div>

        {post.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{post.author.username}</span>
          <span>{timeAgo(post.created_at)}</span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden />
            {post.comment_count}
          </span>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors ${
              justUpvoted
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted hover:text-foreground"
            }`}
            disabled={isUpvoting}
            aria-pressed={justUpvoted}
            aria-label="Upvote this post"
            onClick={(event) => {
              // Defensive: PostRow isn't nested in an anchor today, but stop
              // propagation in case this row is ever wrapped differently.
              event.stopPropagation();
              upvote();
            }}
          >
            <ArrowUp className={`size-3.5 ${justUpvoted ? "fill-current" : ""}`} aria-hidden />
            {post.upvote_count}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
