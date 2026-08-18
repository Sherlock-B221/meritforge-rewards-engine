"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useSWRConfig } from "swr";
import { Card, CardContent } from "@/components/ui";
import { SectionBoundary, SkeletonRow } from "@/components/feedback";
import { PageContainer } from "@/components/PageContainer";
import { Pagination } from "@/components/Pagination";
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
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Challenge</th>
              <th className="px-4 py-2.5 text-right font-medium">Reward</th>
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
                <td className="px-4 py-8 text-center text-sm text-muted-foreground" colSpan={3}>
                  No rewards yet — complete a challenge to earn your first one.
                </td>
              </tr>
            ) : (
              ledger.rewards.map((reward) => <RewardRow key={reward.id} reward={reward} />)
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} hasNext={ledger.hasNext} onPageChange={onPageChange} />
    </div>
  );
}

/**
 * Profile screen: the SELF-profile, composed from existing reads (there is no
 * per-user profile endpoint). Reads the `[username]` route param via
 * `useParams()` for URL parity (`/u/:username`); the data always belongs to the
 * logged-in user (`useAuthStore`), per the brief. Two independently-guarded
 * async sections (header vs ledger), each with its own `SectionBoundary`.
 */
export function ProfileScreen() {
  const { mutate } = useSWRConfig();
  const params = useParams<{ username: string }>();
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);

  const username = user?.username ?? params.username;

  if (!user) {
    return (
      <PageContainer className="py-2">
        <Card>
          <CardContent className="space-y-1 py-6 text-center">
            <p className="font-medium">Profile unavailable</p>
            <p className="text-sm text-muted-foreground">Sign in to view your profile.</p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <SectionBoundary
        onRetry={() => {
          void mutate(PROFILE_STREAKS_KEY);
          void mutate(PROFILE_LEADERBOARD_KEY);
          void mutate(rewardsKey(1));
        }}
      >
        <HeaderSection userId={user.id} username={username} />
      </SectionBoundary>

      <section className="space-y-2.5">
        <p className="section-label">Reward history</p>
        <SectionBoundary onRetry={() => void mutate(rewardsKey(page))}>
          <RewardsSection page={page} onPageChange={(next) => setPage(Math.max(1, next))} />
        </SectionBoundary>
      </section>
    </PageContainer>
  );
}
