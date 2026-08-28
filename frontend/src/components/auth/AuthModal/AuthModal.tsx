"use client";

import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuthModalStore } from "@/store/authModalStore";

/**
 * The global login/signup popup, mounted once at the app root. Opened by any
 * write action an anonymous user attempts (via `useAuthGuard`); on success the
 * captured intent replays and the popup closes.
 */
export function AuthModal() {
  const isOpen = useAuthModalStore((state) => state.isOpen);
  const mode = useAuthModalStore((state) => state.mode);
  const setMode = useAuthModalStore((state) => state.setMode);
  const close = useAuthModalStore((state) => state.close);
  const runPendingIntent = useAuthModalStore((state) => state.runPendingIntent);

  const isLogin = mode === "login";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <DialogTitle>{isLogin ? "Log in to continue" : "Join meritforge"}</DialogTitle>
          <DialogDescription>
            {isLogin
              ? "Log in to post, comment, upvote, and earn points, badges & streaks."
              : "Create an account to post, comment, upvote, and start earning points."}
          </DialogDescription>
        </DialogHeader>
        <AuthForm mode={mode} onSuccess={runPendingIntent} onSwitchMode={setMode} />
      </DialogContent>
    </Dialog>
  );
}
