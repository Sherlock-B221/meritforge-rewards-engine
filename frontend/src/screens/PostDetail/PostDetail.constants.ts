/** Client-side mirror of the backend's comment body bounds (`CommentCreateInput.body`). */
export const COMMENT_BODY_MIN = 1;
export const COMMENT_BODY_MAX = 10000;

/** The single source of truth for a thread's SWR cache key. */
export function postDetailKey(postId: string): readonly [string, string] {
  return ["post", postId] as const;
}
