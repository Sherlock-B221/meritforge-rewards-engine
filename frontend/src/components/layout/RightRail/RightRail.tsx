"use client";

import { WeeklyChallengeWidget } from "@/components/WeeklyChallengeWidget";
import { TopThisWeekWidget } from "@/components/TopThisWeekWidget";
import { SignupCtaCard } from "@/components/SignupCtaCard";
import { useAuthStore } from "@/store/authStore";

/**
 * Right rail for the shared shell. Full-height + sticky. Logged in → the personal
 * weekly-challenge widget; logged out → a signup CTA (the weekly endpoint needs
 * auth). The public "Top this week" leaderboard peek shows for everyone. Hidden
 * below `lg`; on smaller screens the weekly banner surfaces in `<main>` instead.
 */
export function RightRail() {
  const user = useAuthStore((state) => state.user);

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 space-y-4 overflow-y-auto border-l p-4 lg:block">
      {user ? <WeeklyChallengeWidget /> : <SignupCtaCard />}
      <TopThisWeekWidget />
    </aside>
  );
}
