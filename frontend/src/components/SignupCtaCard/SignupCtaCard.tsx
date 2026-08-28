"use client";

import { Trophy } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuthModalStore } from "@/store/authModalStore";

/**
 * Shown to logged-out visitors in the right rail / mobile banner in place of the
 * personal weekly-challenge widget (which needs auth). Invites signup.
 */
export function SignupCtaCard() {
  const open = useAuthModalStore((state) => state.open);

  return (
    <div className="rounded-2xl border bg-card p-4 text-card-foreground shadow-card">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Trophy className="size-5" />
      </div>
      <h3 className="mt-3 font-display text-base font-semibold">Earn points &amp; badges</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Join meritforge to post, upvote, keep a streak, and climb the leaderboard.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => open(null, "register")}>
          Sign up
        </Button>
        <Button size="sm" variant="outline" onClick={() => open(null, "login")}>
          Log in
        </Button>
      </div>
    </div>
  );
}
