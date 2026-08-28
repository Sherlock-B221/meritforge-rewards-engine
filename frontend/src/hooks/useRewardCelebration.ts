"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { getRewards } from "@/services";
import { useAuthStore } from "@/store/authStore";
import { POLL_INTERVAL_MS } from "@/constants/polling";
import type { Paginated, Reward } from "@/types";

/**
 * Mounted once in the shared shell. For authenticated users it polls the reward
 * ledger every 30s and, when a NEW reward appears since the last poll (a
 * background job just disbursed one), fires a confetti burst + a celebratory
 * toast. The first successful load only records a baseline, so historical
 * rewards never re-celebrate. No-ops entirely for anonymous visitors.
 */
export function useRewardCelebration(): void {
  const token = useAuthStore((state) => state.token);
  const seenRef = useRef<Set<string> | null>(null);

  const { data } = useSWR<Paginated<Reward>>(
    token ? ["reward-celebration"] : null,
    () => getRewards({ page: 1, limit: 20 }),
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: false },
  );

  // Reset the baseline on logout so a later login re-baselines cleanly.
  useEffect(() => {
    if (!token) seenRef.current = null;
  }, [token]);

  useEffect(() => {
    if (!data) return;

    if (seenRef.current === null) {
      seenRef.current = new Set(data.items.map((reward) => reward.id));
      return;
    }

    const fresh = data.items.filter((reward) => !seenRef.current!.has(reward.id));
    if (fresh.length === 0) return;
    fresh.forEach((reward) => seenRef.current!.add(reward.id));

    const newest = fresh[0];
    const label =
      newest.reward_type === "points"
        ? `+${(newest.amount ?? 0).toLocaleString("en-US")} points`
        : `Badge earned${newest.badge_code ? `: ${newest.badge_code}` : ""}`;
    toast.success(`🎉 Reward unlocked — ${label}`, { description: newest.challenge_name });
    void confetti({ particleCount: 90, spread: 72, origin: { y: 0.3 }, scalar: 0.9 });
  }, [data]);
}
