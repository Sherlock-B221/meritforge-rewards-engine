import { apiGet, apiPatch, apiPost } from "@/services/apiClient";
import type {
  Comment,
  CommentCreateInput,
  CreatePostInput,
  Paginated,
  PostDetail,
  PostSummary,
} from "@/types";

/** Sort modes the feed supports; round-trips through the API + URL. */
export type FeedSort = "latest" | "trending";

/** Parameters for a single feed page fetch. `limit` is optional (backend default 20, max 100). */
export interface GetFeedParams {
  sort: FeedSort;
  page: number;
  limit?: number;
}

/**
 * `GET /posts?sort=&page=&limit=` → `Paginated<PostSummary>`. Builds the
 * querystring from typed params; `apiGet` attaches the token and unwraps
 * errors into `AppError`.
 */
export function getFeed(params: GetFeedParams): Promise<Paginated<PostSummary>> {
  const query = new URLSearchParams({
    sort: params.sort,
    page: String(params.page),
  });
  if (params.limit !== undefined) {
    query.set("limit", String(params.limit));
  }
  return apiGet<Paginated<PostSummary>>(`/posts?${query.toString()}`);
}

/**
 * `POST /posts` → 201 `PostSummary`. The engine reacts to the resulting
 * server-side event on its own — the FE never emits `/events`.
 */
export function createPost(input: CreatePostInput): Promise<PostSummary> {
  return apiPost<PostSummary>("/posts", input);
}

/**
 * `GET /posts/:id` → `PostDetail`. Triggers the server-side `post_viewed`
 * event as a side effect of the read — the FE never emits `/events` itself.
 */
export function getPost(id: string): Promise<PostDetail> {
  return apiGet<PostDetail>(`/posts/${id}`);
}

/**
 * `POST /posts/:id/comments` → 201 `Comment`. Triggers the server-side
 * `comment_posted` event.
 */
export function addComment(postId: string, input: CommentCreateInput): Promise<Comment> {
  return apiPost<Comment>(`/posts/${postId}/comments`, input);
}

/**
 * `PATCH /posts/:id/solution/:commentId` → 200 `PostDetail`. Triggers the
 * server-side `solution_marked` event. Returns the full refreshed thread so
 * callers can `mutate` the detail cache directly with the response.
 */
export function markSolution(postId: string, commentId: string): Promise<PostDetail> {
  return apiPatch<PostDetail>(`/posts/${postId}/solution/${commentId}`);
}
