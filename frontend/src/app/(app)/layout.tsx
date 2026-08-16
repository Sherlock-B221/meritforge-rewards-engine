"use client";

import { RightRail, Sidebar } from "@/components/layout";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * Authenticated app shell: guards the route (redirects to `/login` if there's
 * no token after hydration) and renders Sidebar + main content + RightRail
 * (which hosts the persistent WeeklyChallengeWidget).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth();

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
      <RightRail />
    </div>
  );
}
