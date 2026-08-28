"use client";

import { useCallback } from "react";
import { useAuthModalStore } from "@/store/authModalStore";
import { useAuthStore } from "@/store/authStore";

/**
 * The single interception point for write actions. If the user is
 * authenticated, run the action immediately; otherwise open the login popup
 * capturing the action as a pending intent so it replays right after they
 * authenticate. Every write entry point (upvote, comment, create-post,
 * mark-solution) wraps its handler in the returned `guard`.
 */
export function useAuthGuard() {
  const open = useAuthModalStore((state) => state.open);

  return useCallback(
    (action: () => void | Promise<void>) => {
      // Read the token at call time (event handler), not via subscription.
      if (useAuthStore.getState().token) {
        return action();
      }
      open(action, "login");
    },
    [open],
  );
}
