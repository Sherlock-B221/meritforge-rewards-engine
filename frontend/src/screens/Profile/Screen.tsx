"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { SectionBoundary, SkeletonRow } from "@/components/feedback";
import { useAuthStore } from "@/store";
import { PROFILE_LEADERBOARD_KEY, PROFILE_STREAKS_KEY, rewardsKey } from "./Profile.constants";
import { useProfileHeader } from "./useProfileHeader";
import { useRewardsLedger } from "./useRewardsLedger";
import { ProfileHeader, RewardRow } from "./components";

/** Header section body — composed stats from streaks + leaderboard + rewards. Lives in its own SectionBoundary. */
function HeaderSection({ userId, username }: { userId: string; username: string }) {
  const header = useProfileHeader(userId, username);
  return <ProfileHeader header={header} />;
}

/** Reward-history ledger — paginated, skeleton rows on load. Lives in its own SectionBoundary. */
function RewardsSection({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) {
  const ledger = useRewardsLedger(page);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Challenge</th>
              <th className="px-4 py-2 font-medium">Reward</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {ledger.isInitialLoading ? (
              Array.from({ length: 5 }, (_, index) => index).map((key) => (
                <tr key={key}>
                  <td className="px-4 py-3" colSpan={3}>
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : ledger.rewards.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-muted-foreground" colSpan={3}>
                  No rewards yet — complete a challenge to earn your first one.
                </td>
              </tr>
            ) : (
              ledger.rewards.map((reward) => <RewardRow key={reward.id} reward={reward} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">Page {page}</span>
        <Button type="button" variant="outline" size="sm" disabled={!ledger.hasNext} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/**
 * Profile screen: the SELF-profile, composed from existing reads (there is
 * no per-user profile endpoint). Reads the `[username]` route param via
 * `useParams()` purely for display parity with the URL (`/u/:username`);
 * the actual data always belongs to the logged-in user (`useAuthStore`), per
 * the brief. Two independently-guarded async sections (header vs ledger),
 * each with its own `SectionBoundary` so one failing section leaves the
 * other usable.
 */
export function ProfileScreen() {
  const { mutate } = useSWRConfig();
  const params = useParams<{ username: string }>();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);

  const username = user?.username ?? params.username;

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl py-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Sign in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <SectionBoundary
        onRetry={() => {
          void mutate(PROFILE_STREAKS_KEY);
          void mutate(PROFILE_LEADERBOARD_KEY);
          void mutate(rewardsKey(1));
        }}
      >
        <HeaderSection userId={user.id} username={username} />
      </SectionBoundary>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reward history</CardTitle>
        </CardHeader>
        <CardContent>
          <SectionBoundary onRetry={() => void mutate(rewardsKey(page))}>
            <RewardsSection page={page} onPageChange={(next) => setPage(Math.max(1, next))} />
          </SectionBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
