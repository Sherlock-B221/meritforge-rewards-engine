/**
 * Single source of truth for the 30s polling interval used by every
 * async-evaluated, live-progress surface (weekly widget now; the Challenges
 * screen reuses this in P6).
 */
export const POLL_INTERVAL_MS = 30_000;
