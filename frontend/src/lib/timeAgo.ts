/**
 * Format an ISO timestamp as a compact relative-time string ("just now",
 * "5m ago", "3h ago", "2d ago", "4w ago", "1y ago"). Pure, dependency-free —
 * intentionally coarse (no live ticking) so feed rows stay cheap to render.
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) {
    return "just now";
  }

  const units: ReadonlyArray<{ limit: number; secs: number; suffix: string }> = [
    { limit: 3600, secs: 60, suffix: "m" },
    { limit: 86400, secs: 3600, suffix: "h" },
    { limit: 604800, secs: 86400, suffix: "d" },
    { limit: 2592000, secs: 604800, suffix: "w" },
    { limit: 31536000, secs: 2592000, suffix: "mo" },
    { limit: Infinity, secs: 31536000, suffix: "y" },
  ];

  for (const { limit, secs, suffix } of units) {
    if (seconds < limit) {
      return `${Math.floor(seconds / secs)}${suffix} ago`;
    }
  }
  return "";
}
