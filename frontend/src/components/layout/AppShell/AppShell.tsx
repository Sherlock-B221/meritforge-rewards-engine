"use client";

import { MobileNav, RightRail, Sidebar } from "@/components/layout";
import { WeeklyChallengeWidget } from "@/components/WeeklyChallengeWidget";
import { SignupCtaCard } from "@/components/SignupCtaCard";
import { useAuthStore } from "@/store/authStore";

/**
 * The shared app chrome — sticky Sidebar · scrolling main · sticky RightRail,
 * plus the mobile top bar / bottom tabs and a faint page tint. Used by BOTH the
 * public `(public)` layout (no auth gate) and the gated `(app)` layout. Renders
 * gracefully for logged-out visitors: the Sidebar/RightRail swap personal
 * widgets for signup CTAs, and the mobile weekly banner becomes a CTA.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-dvh bg-muted/40">
      <MobileNav />
      <div className="mx-auto flex w-full max-w-[1240px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-10">
          {/* Weekly challenge is persistent; on < lg it surfaces here (the right
              rail is hidden). Logged-out visitors get a signup CTA instead. */}
          <div className="mb-4 lg:hidden">
            {user ? <WeeklyChallengeWidget /> : <SignupCtaCard />}
          </div>
          {children}
        </main>
        <RightRail />
      </div>
    </div>
  );
}
