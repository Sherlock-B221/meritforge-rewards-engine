"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/**
 * Client island mounted on the server-rendered landing page (`page.tsx`).
 * Renders nothing — on mount, it defensively re-hydrates the auth store
 * (see `useRequireAuth.ts` for why: `app/providers.tsx` also hydrates once,
 * but effect ordering between a descendant and `Providers` isn't guaranteed,
 * so a plain `token` read here could false-negative on hard refresh) and, if
 * a session is present, replaces the landing page with `/feed` so signed-in
 * visitors never see the marketing content.
 */
export function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    useAuthStore.getState().hydrate();
    const token = useAuthStore.getState().token;
    if (token) {
      router.replace("/feed");
    }
  }, [router]);

  return null;
}
