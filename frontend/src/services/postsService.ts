import { apiGet, apiPost } from "@/services/apiClient";
import type { CreatePostInput, Paginated, PostSummary } from "@/types";

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
