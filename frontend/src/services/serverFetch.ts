/**
 * Server-only anonymous fetch for public-page SSR loaders. NEVER sends a token
 * (the crawler's view = public content) and uses an internal base URL so it
 * works when the web server and API run in separate containers (e.g. Docker),
 * falling back to the public URL for local dev. Import ONLY from server
 * components (page.tsx / sitemap.ts / robots.ts) — never a client component.
 */
const SERVER_API_URL =
  process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function serverFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SERVER_API_URL}${path}`, {
    cache: "no-store",
    headers: { "content-type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`serverFetch ${path} → ${response.status}`);
  }
  return response.json() as Promise<T>;
}
