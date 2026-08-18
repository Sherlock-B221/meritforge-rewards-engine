"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

/**
 * Cross-cutting left nav for the authenticated `(app)` shell. Links to
 * `/challenges`, `/leaderboard`, and the current user's profile — those
 * routes don't exist until P6, the links just won't resolve yet.
 */
export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-2 border-r p-4">
      <Link href="/feed" className="text-sm font-semibold">
        meritforge
      </Link>
      <Link href="/challenges" className="text-sm text-muted-foreground hover:text-foreground">
        Challenges
      </Link>
      <Link href="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground">
        Leaderboard
      </Link>
      {user ? (
        <Link
          href={`/u/${user.username}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Profile
        </Link>
      ) : null}
      {user ? (
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto text-left text-sm text-muted-foreground hover:text-foreground"
        >
          Log out
        </button>
      ) : null}
    </nav>
  );
}
