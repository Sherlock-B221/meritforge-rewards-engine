"use client";

import Link from "next/link";
import { useSWRConfig } from "swr";
import { Plus, Search } from "lucide-react";
import { Button, Input, buttonVariants } from "@/components/ui";
import { SectionBoundary, SkeletonCard } from "@/components/feedback";
import { useUrlState } from "@/hooks";
import type { FeedSort } from "@/services";
import { FEED_DEFAULTS, FEED_SORTS, feedKey } from "./Feed.constants";
import { useFeed } from "./useFeed";
import { PostRow } from "./components";

/** Latest / Trending tab toggle. */
function SortTabs({ sort, onChange }: { sort: FeedSort; onChange: (sort: FeedSort) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-muted p-0.5">
      {FEED_SORTS.map((tab) => (
        <Button
          key={tab.value}
          type="button"
          size="sm"
          variant={sort === tab.value ? "default" : "ghost"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

/** Inline optimistic composer — demonstrates instant-at-top + rollback + toast via `useCreatePost`. */
function Composer({
  title,
  body,
  isSubmitting,
  onField,
  onSubmit,
}: {
  title: string;
  body: string;
  isSubmitting: boolean;
  onField: (field: "title" | "body", value: string) => void;
  onSubmit: () => void;
}) {
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !isSubmitting;
  return (
    <form
      className="space-y-2 rounded-xl border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Input
        placeholder="Post title…"
        value={title}
        onChange={(event) => onField("title", event.target.value)}
        aria-label="Post title"
      />
      <Input
        placeholder="What's on your mind?"
        value={body}
        onChange={(event) => onField("body", event.target.value)}
        aria-label="Post body"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {isSubmitting ? "Posting…" : "Post"}
        </Button>
      </div>
    </form>
  );
}

/** Everything that depends on feed data — lives inside the SectionBoundary so failures degrade here. */
function FeedContent() {
  const feed = useFeed();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SortTabs sort={feed.sort} onChange={feed.setSort} />
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Search this page…"
            value={feed.search}
            onChange={(event) => feed.setSearch(event.target.value)}
            aria-label="Search posts"
          />
        </div>
      </div>

      <Composer
        title={feed.composer.title}
        body={feed.composer.body}
        isSubmitting={feed.isSubmitting}
        onField={feed.setComposerField}
        onSubmit={feed.submitComposer}
      />

      {feed.isInitialLoading ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : feed.posts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No posts to show.
        </p>
      ) : (
        <ul className="space-y-2">
          {feed.posts.map((post) => (
            <li key={post.id}>
              <PostRow post={post} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={feed.page <= 1}
          onClick={() => feed.goToPage(feed.page - 1)}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">Page {feed.page}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!feed.hasNext}
          onClick={() => feed.goToPage(feed.page + 1)}
        >
          Next
        </Button>
      </div>
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
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">Feed</h1>
        <Link href="/posts/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Plus aria-hidden />
          New post
        </Link>
      </div>

      <SectionBoundary onRetry={() => void mutate(feedKey({ sort, page }))}>
        <FeedContent />
      </SectionBoundary>
    </div>
  );
}
