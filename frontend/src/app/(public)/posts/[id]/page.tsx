import { cache } from "react";
import type { Metadata } from "next";
import { SWRConfig, unstable_serialize } from "swr";
import PostDetailScreen from "@/screens/PostDetail";
import { postDetailKey } from "@/screens/PostDetail/PostDetail.constants";
import { serverFetch } from "@/services/serverFetch";
import type { PostDetail } from "@/types";

/** Deduped per request so `generateMetadata` + the page share a single fetch. */
const loadPost = cache((id: string) => serverFetch<PostDetail>(`/posts/${id}`));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const post = await loadPost(id);
    const excerpt = post.body.replace(/\s+/g, " ").trim().slice(0, 155);
    return {
      title: `${post.title} — meritforge`,
      description: excerpt || "A developer discussion on meritforge.",
      openGraph: { title: post.title, description: excerpt, type: "article" },
    };
  } catch {
    return { title: "Thread — meritforge" };
  }
}

/**
 * Public, server-rendered thread. Fetches the post + its nested comments
 * anonymously on the server (for per-thread `generateMetadata` and crawlable
 * HTML) and seeds SWR via fallback; the client `PostDetail` screen hydrates the
 * interactive bits (upvote / comment / mark-solution), each auth-guarded.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let fallback: Record<string, unknown> = {};
  try {
    const post = await loadPost(id);
    fallback = { [unstable_serialize(postDetailKey(id))]: post };
  } catch {
    // SSR seed failed (e.g. not found) — the client fetches + handles the error.
  }

  return (
    <SWRConfig value={{ fallback }}>
      <PostDetailScreen />
    </SWRConfig>
  );
}
