import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Allow the public read surface; keep gated + auth routes out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/feed", "/leaderboard", "/posts/"],
      disallow: ["/posts/new", "/challenges", "/u/", "/login", "/register", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
