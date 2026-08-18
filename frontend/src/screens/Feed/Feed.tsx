"use client";

import { useState } from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { Search } from "lucide-react";
import { Button, Card, CardContent, Input, buttonVariants } from "@/components/ui";
import { SectionBoundary, SkeletonCard } from "@/components/feedback";
import { PageContainer } from "@/components/PageContainer";
import { Pagination } from "@/components/Pagination";
import { UserAvatar } from "@/components/UserAvatar";
import { TagInput } from "@/components/TagInput";
import { RichEditor } from "@/components/RichEditor";
import { useUrlState } from "@/hooks";
import { useAuthStore } from "@/store";
import { cn } from "@/lib/utils";
import type { FeedSort } from "@/services";
import { FEED_DEFAULTS, FEED_SORTS, feedKey } from "./Feed.constants";
import { useFeed } from "./useFeed";
import { PostRow } from "./components";

/** Latest / Trending underline tabs. */
function SortTabs({ sort, onChange }: { sort: FeedSort; onChange: (sort: FeedSort) => void }) {
  return (
    <div className="flex items-center gap-5">
      {FEED_SORTS.map((tab) => {
        const active = sort === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Inline optimistic composer — collapses to a single prompt so it never
 * clutters the feed, and expands into title + tags + rich body. Demonstrates
 * instant-at-top create + rollback + toast via the shared `useCreatePost`.
 */
function Composer({
  currentUsername,
  title,
  body,
  tags,
  isSubmitting,
  onTitleChange,
  onBodyChange,
  onTagsChange,
  onSubmit,
}: {
  currentUsername: string | undefined;
  title: string;
  body: string;
  tags: string[];
  isSubmitting: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  onSubmit: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !isSubmitting;

  if (!expanded) {
    return (
      <Card size="sm">
        <CardContent className="flex items-center gap-3">
          {currentUsername ? <UserAvatar username={currentUsername} /> : null}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex-1 rounded-lg border border-input px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            Start a post — ask the community…
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardContent>
        <form
          className="space-y-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex items-start gap-3">
            {currentUsername ? <UserAvatar username={currentUsername} className="mt-1" /> : null}
            <div className="min-w-0 flex-1 space-y-2.5">
              <Input
                autoFocus
                placeholder="Title — a clear, specific question"
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                aria-label="Post title"
                className="font-medium"
              />
              <TagInput tags={tags} onChange={onTagsChange} disabled={isSubmitting} />
              <RichEditor
                value={body}
                onChange={onBodyChange}
                rows={4}
                placeholder="Describe what you've tried, expected vs actual…"
                ariaLabel="Post body"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {isSubmitting ? "Posting…" : "Post"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Everything that depends on feed data — lives inside the SectionBoundary so failures degrade here. */
function FeedContent() {
  const feed = useFeed();
  const username = useAuthStore((state) => state.user?.username);

  return (
    <div className="space-y-4">
      <Composer
        currentUsername={username}
        title={feed.composer.title}
        body={feed.composer.body}
        tags={feed.composer.tags}
        isSubmitting={feed.isSubmitting}
        onTitleChange={(value) => feed.setComposerField("title", value)}
        onBodyChange={(value) => feed.setComposerField("body", value)}
        onTagsChange={feed.setComposerTags}
        onSubmit={feed.submitComposer}
      />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b">
        <SortTabs sort={feed.sort} onChange={feed.setSort} />
        <div className="relative mb-2 w-full sm:w-60">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="rounded-full pl-9"
            placeholder="Search threads…"
            value={feed.search}
            onChange={(event) => feed.setSearch(event.target.value)}
            aria-label="Search posts"
          />
        </div>
      </div>

      {feed.isInitialLoading ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : feed.posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm font-medium">
            {feed.search ? "No threads match your search" : "Start the conversation — post your first thread"}
          </p>
          <p className="text-sm text-muted-foreground">
            {feed.search
              ? "Try a different keyword or clear the search."
              : "No posts yet. Be the first, or see what's up for grabs."}
          </p>
          {!feed.search ? (
            <Link
              href="/challenges"
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1" })}
            >
              View challenges to earn points →
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {feed.posts.map((post) => (
            <li key={post.id}>
              <PostRow post={post} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={feed.page}
        hasNext={feed.hasNext}
        onPageChange={feed.goToPage}
        className="pt-2"
      />
    </div>
  );
}

/**
 * Feed shell: page header + the SectionBoundary that wraps all feed-data
 * rendering. `onRetry` revalidates the exact current-page cache key (derived
 * from URL state via the shared `feedKey`), matching what `useFeed` reads.
 */
export function FeedScreen() {
  const { mutate } = useSWRConfig();
  const [urlState] = useUrlState(FEED_DEFAULTS);
  const sort: FeedSort = urlState.sort === "trending" ? "trending" : "latest";
  const parsedPage = Number.parseInt(urlState.page, 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  return (
    <PageContainer className="space-y-5">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Developer Community</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions, share answers, and earn points.
        </p>
      </div>

      <SectionBoundary onRetry={() => void mutate(feedKey({ sort, page }))}>
        <FeedContent />
      </SectionBoundary>
    </PageContainer>
  );
}
