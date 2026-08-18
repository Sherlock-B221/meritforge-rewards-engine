/**
 * Deterministic, tasteful avatar colors derived from a seed (username/handle).
 * Soft pastel background + a darker same-hue foreground — reads clean next to
 * the blue brand without turning the UI into a rainbow.
 */
export function avatarColor(seed: string): { backgroundColor: string; color: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsl(${hue} 52% 90%)`,
    color: `hsl(${hue} 55% 34%)`,
  };
}

/** Two-letter initials from a display name or `@handle`. */
export function initials(nameOrHandle: string): string {
  const cleaned = nameOrHandle.replace(/^@/, "").trim();
  if (!cleaned) {
    return "?";
  }
  const parts = cleaned.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}
