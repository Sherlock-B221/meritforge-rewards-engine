"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { SWRConfig } from "swr";
import { Toaster } from "@/components/ui";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuthStore } from "@/store/authStore";

/**
 * Client-only app-wide providers: theme (next-themes, class strategy, system
 * default), SWR config (no global fetcher — services are called directly by
 * each screen's hook), one-time auth-store hydration, and the global login
 * popup (opened by any write action an anonymous user attempts).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SWRConfig value={{}}>
        {children}
        <AuthModal />
        <Toaster />
      </SWRConfig>
    </ThemeProvider>
  );
}
