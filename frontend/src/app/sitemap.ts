import type { MetadataRoute } from "next";
import { serverFetch } from "@/services/serverFetch";
import type { Paginated, PostSummary } from "@/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Sitemap of the public surface: landing + feed + leaderboard + every thread. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/feed`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: "daily", priority: 0.6 },
  ];

  try {
    const feed = await serverFetch<Paginated<PostSummary>>(`/posts?sort=latest&page=1&limit=50`);
    const threads: MetadataRoute.Sitemap = feed.items.map((post) => ({
      url: `${SITE_URL}/posts/${post.id}`,
      lastModified: post.created_at,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticRoutes, ...threads];
  } catch {
    return staticRoutes;
  }
}
