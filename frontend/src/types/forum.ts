/**
 * Forum domain types — mirrors the backend `forum` domain's public read/write
 * contracts. `Author` / `PostSummary` / `CreatePostInput` land the feed;
 * `Comment` / `PostDetail` / `CommentCreateInput` (Task 2) cover the thread
 * contract: `GET /posts/:id`, `POST /posts/:id/comments`,
 * `PATCH /posts/:id/solution/:commentId`.
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

/**
 * A single comment in a thread. `replies` is the nested tree as returned by
 * the server (already grouped by `parent_comment_id`) — `CommentTree` walks
 * it recursively rather than the FE reconstructing the tree from a flat list.
 */
export interface Comment {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  author: Author;
  body: string;
  is_solution: boolean;
  created_at: string;
  replies: Comment[];
}

/** `GET /posts/:id` → the full thread: post fields + the nested comment tree. */
export type PostDetail = PostSummary & { comments: Comment[] };

/** Request body for `POST /posts/:id/comments`. Field bounds enforced server-side. */
export interface CommentCreateInput {
  body: string;
  parent_comment_id?: string;
}

/** `POST /posts/:id/upvote` → idempotent per (post, user); emits `post_upvoted` server-side. */
export interface UpvoteResponse {
  post_id: string;
  upvote_count: number;
  upvoted: boolean;
}
