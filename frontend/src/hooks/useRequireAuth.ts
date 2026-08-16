"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/**
 * Single responsibility: auth-gate + redirect. If there's no token after
 * hydration, redirects to `/login`. Returns `isReady` so the caller can
 * avoid flashing gated content before the redirect fires.
 *
 * `app/providers.tsx` also calls `hydrate()` once on mount, but React fires
 * effects bottom-up on initial mount — this hook's effect (in a descendant
 * of `Providers`) would otherwise run *before* that hydration effect,
 * reading a still-null token and redirecting on every hard refresh even
 * with a valid persisted session. Calling the (idempotent) `hydrate()` here
 * too removes the ordering dependency instead of relying on mount order.
 */
export function useRequireAuth(): { isReady: boolean } {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!token) {
      useAuthStore.getState().hydrate();
      const rehydratedToken = useAuthStore.getState().token;
      if (!rehydratedToken) {
        router.replace("/login");
      }
      return;
    }
    setIsReady(true);
  }, [token, router]);

  return { isReady };
}
