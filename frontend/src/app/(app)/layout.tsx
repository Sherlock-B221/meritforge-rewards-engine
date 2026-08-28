"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * Gated shell — redirects to `/login` if there's no token after hydration, then
 * renders the shared `AppShell`. Wraps the write / user-specific pages
 * (create-post, challenges, profile). Public reads live in the `(public)` group.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isReady } = useRequireAuth();

  if (!isReady) {
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
