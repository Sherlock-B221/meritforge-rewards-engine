"use client";

import { useCallback, useMemo } from "react";
import useSWR, { useSWRConfig } from "swr";
import { getLeaderboard, getRewards, getStreaks } from "@/services";
import { AppError } from "@/types";
import type { LeaderboardEntry, Paginated, Reward, UserStreaks } from "@/types";
import {
  PROFILE_LEADERBOARD_KEY,
  PROFILE_LEADERBOARD_LIMIT,
  PROFILE_LEADERBOARD_PAGE,
  PROFILE_STREAKS_KEY,
  REWARDS_PAGE_SIZE,
  rewardsKey,
} from "./Profile.constants";
import type { ProfileHeaderViewModel } from "./Profile.types";

/**
 * Composes the profile header from THREE independent reads — there is no
 * per-user profile endpoint (brief-literal): `getStreaks()` for the headline
 * streak, `getLeaderboard({page:1,limit:100})` to locate the current user's
 * rank/points/badge-count, and the first reward-ledger page (shared SWR key
 * with `useRewardsLedger`'s page 1, so this doesn't double-fetch once that
 * section also mounts) to derive badge chips.
 *
 * Graceful degrade: if the user isn't found in the first 100 leaderboard
 * rows (no rewards yet), `rank` is `null`, `totalPoints`/`badgeCount` are `0`
 * — this is a valid empty state, NOT an error.
 *
 * On an unexpected `AppError` from either read, RE-THROWS so the surrounding
 * `<SectionBoundary>` renders the retry fallback.
 */
export function useProfileHeader(userId: string, username: string): ProfileHeaderViewModel {
  const { mutate } = useSWRConfig();

  const streaksSwr = useSWR<UserStreaks, AppError>(PROFILE_STREAKS_KEY, getStreaks);
  const leaderboardSwr = useSWR<Paginated<LeaderboardEntry>, AppError>(
    PROFILE_LEADERBOARD_KEY,
    () => getLeaderboard({ page: PROFILE_LEADERBOARD_PAGE, limit: PROFILE_LEADERBOARD_LIMIT }),
  );
  const rewardsSwr = useSWR<Paginated<Reward>, AppError>(
    rewardsKey(1),
    ([, pageKey]: readonly [string, number]) => getRewards({ page: pageKey, limit: REWARDS_PAGE_SIZE }),
  );

  const firstError = streaksSwr.error ?? leaderboardSwr.error ?? rewardsSwr.error;
  if (firstError) {
    throw firstError;
  }

  const currentStreak = useMemo(() => {
    const streaks = streaksSwr.data?.streaks ?? [];
    return streaks.reduce((max, streak) => Math.max(max, streak.current_streak), 0);
  }, [streaksSwr.data]);

  const leaderboardEntry = useMemo(
    () => leaderboardSwr.data?.items.find((entry) => entry.user_id === userId) ?? null,
    [leaderboardSwr.data, userId],
  );

  const badgeCodes = useMemo(() => {
    const rewards = rewardsSwr.data?.items ?? [];
    const codes = rewards
      .filter((reward) => reward.reward_type === "badge" && reward.badge_code !== null)
      .map((reward) => reward.badge_code as string);
    return Array.from(new Set(codes));
  }, [rewardsSwr.data]);

  const isInitialLoading =
    (streaksSwr.isLoading && !streaksSwr.data) ||
    (leaderboardSwr.isLoading && !leaderboardSwr.data) ||
    (rewardsSwr.isLoading && !rewardsSwr.data);

  const retry = useCallback(() => {
    void mutate(PROFILE_STREAKS_KEY);
    void mutate(PROFILE_LEADERBOARD_KEY);
    void mutate(rewardsKey(1));
  }, [mutate]);

  return {
    displayName: username,
    username,
    stats: {
      rank: leaderboardEntry?.rank ?? null,
      totalPoints: leaderboardEntry?.total_points ?? 0,
      badgeCount: leaderboardEntry?.badge_count ?? 0,
      currentStreak,
    },
    badgeCodes,
    isInitialLoading,
    retry,
  };
}
