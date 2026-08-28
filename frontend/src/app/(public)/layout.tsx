import { AppShell } from "@/components/layout/AppShell";

/**
 * Public shell — NO auth gate. Wraps the read-only, publicly-accessible pages
 * (feed, post detail, leaderboard) in the shared app chrome. Anonymous visitors
 * browse freely; any write action opens the login popup.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
