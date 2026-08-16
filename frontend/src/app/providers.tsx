"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { Toaster } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";

/**
 * Client-only app-wide providers: SWR config (no global fetcher — services
 * are called directly by each screen's hook) and one-time auth-store
 * hydration from localStorage.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <SWRConfig value={{}}>
      {children}
      <Toaster />
    </SWRConfig>
  );
}
