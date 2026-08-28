"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PenSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useAuthModalStore } from "@/store/authModalStore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { UserAvatar } from "@/components/UserAvatar";
import { Button, ThemeToggle, buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getNavItems } from "../navConfig";

/**
 * Left nav for the shared shell (tablet / desktop). Full-height + sticky so the
 * footer stays pinned. Renders for logged-out visitors too: gated nav items and
 * "New Post" open the login popup (and replay-navigate after auth), and the user
 * footer becomes Log in / Sign up. Hidden below `md` (`MobileNav` takes over).
 */
export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const openAuth = useAuthModalStore((state) => state.open);
  const guard = useAuthGuard();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    clearSession();
    router.push("/feed");
  };

  const items = getNavItems(user?.username);

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
      <div className="mb-4 flex items-center justify-between px-2">
        <Link href="/feed" className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            m
          </span>
          <span className="font-display text-base font-semibold tracking-tight">meritforge</span>
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          const requiresAuth = item.gated && !user;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={
                requiresAuth
                  ? (event) => {
                      event.preventDefault();
                      guard(() => router.push(item.href));
                    }
                  : undefined
              }
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user ? (
        <Link href="/posts/new" className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full gap-2")}>
          <PenSquare aria-hidden />
          New Post
        </Link>
      ) : (
        <Button
          size="lg"
          className="mt-4 w-full gap-2"
          onClick={() => guard(() => router.push("/posts/new"))}
        >
          <PenSquare aria-hidden />
          New Post
        </Button>
      )}

      {user ? (
        <div className="mt-auto flex items-center gap-1 border-t pt-3">
          <Link
            href={`/u/${user.username}`}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
          >
            <UserAvatar username={user.username} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.username}</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-2 border-t pt-3">
          <Button className="w-full" onClick={() => openAuth(null, "login")}>
            Log in
          </Button>
          <Button variant="outline" className="w-full" onClick={() => openAuth(null, "register")}>
            Sign up
          </Button>
        </div>
      )}
    </aside>
  );
}
