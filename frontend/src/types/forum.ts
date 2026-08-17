/**
 * Forum domain types — mirrors the backend `forum` domain's public read/write
 * contracts. Kept deliberately small: only what the Feed page consumes today
 * (`Author`, `PostSummary`, `CreatePostInput`). `PostDetail`, `Comment`, and
 * the rest of the thread contract land with the Post Detail / Create Post
 * screens (Task 2) — extend this file there rather than defining them early.
 */

/** Minimal author reference embedded in a post summary. */
export interface Author {
  id: string;
  username: string;
}

/** A single row in the feed — `GET /posts` returns `Paginated<PostSummary>`. */
export interface PostSummary {
  id: string;
  title: string;
  body: string;
  tags: string[];
  author: Author;
  comment_count: number;
  upvote_count: number;
  view_count: number;
  /** Non-null when a comment has been accepted as the solution — drives the `✓ solved` badge. */
  solution_comment_id: string | null;
  created_at: string;
}

/** Request body for `POST /posts`. Field bounds are enforced server-side. */
export interface CreatePostInput {
  title: string;
  body: string;
  tags: string[];
}
