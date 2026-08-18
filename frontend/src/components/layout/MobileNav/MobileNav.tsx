"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PenSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { getNavItems } from "../navConfig";

/**
 * Mobile navigation (below `md`): a sticky top app bar (brand + New Post + Log
 * out) plus a fixed bottom tab bar mirroring the sidebar's items. Replaces the
 * desktop `Sidebar`/`RightRail`, which are hidden on small screens. The shell's
 * `<main>` reserves bottom padding so content clears the fixed tab bar.
 */
export function MobileNav() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  const items = getNavItems(user?.username);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:hidden">
        <Link href="/feed" className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            m
          </span>
          <span className="text-base font-semibold tracking-tight">meritforge</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/posts/new"
            aria-label="New post"
            className="inline-grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            <PenSquare className="size-5" aria-hidden />
          </Link>
          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="inline-grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t bg-background md:hidden">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
