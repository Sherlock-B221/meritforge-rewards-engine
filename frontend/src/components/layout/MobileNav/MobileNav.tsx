"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut, PenSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useAuthModalStore } from "@/store/authModalStore";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { ThemeToggle } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getNavItems } from "../navConfig";

/**
 * Mobile navigation (below `md`): a sticky top app bar (brand + theme + New Post
 * + Log in/out) plus a fixed bottom tab bar mirroring the sidebar. Renders for
 * logged-out visitors: gated tabs and "New Post" open the login popup.
 */
export function MobileNav() {
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
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:hidden">
        <Link href="/feed" className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            m
          </span>
          <span className="font-display text-base font-semibold tracking-tight">meritforge</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {user ? (
            <Link
              href="/posts/new"
              aria-label="New post"
              className="inline-grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"
            >
              <PenSquare className="size-5" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => guard(() => router.push("/posts/new"))}
              aria-label="New post"
              className="inline-grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"
            >
              <PenSquare className="size-5" aria-hidden />
            </button>
          )}
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuth(null, "login")}
              aria-label="Log in"
              className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogIn className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-background md:hidden">
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
                "flex flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
