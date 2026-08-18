"use client";

import { MobileNav, RightRail, Sidebar } from "@/components/layout";
import { WeeklyChallengeWidget } from "@/components/WeeklyChallengeWidget";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * Authenticated app shell: guards the route (redirects to `/login` if there's
 * no token after hydration) and renders the bounded, centered three-column
 * layout — sticky Sidebar · scrolling main · sticky RightRail — plus the
 * mobile top bar + bottom tabs. A faint page tint lets the white cards lift.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth();

  if (!isReady) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-muted/40">
      <MobileNav />
      <div className="mx-auto flex w-full max-w-[1240px]">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-10">
          {/* Weekly challenge is persistent on every page; on < lg it surfaces
              here since the right rail is hidden. */}
          <div className="mb-4 lg:hidden">
            <WeeklyChallengeWidget />
          </div>
          {children}
        </main>
        <RightRail />
      </div>
    </div>
  );
}
