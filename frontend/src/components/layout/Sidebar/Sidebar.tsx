"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, PenSquare } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { UserAvatar } from "@/components/UserAvatar";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getNavItems } from "../navConfig";

/**
 * Left nav for the authenticated `(app)` shell (tablet / desktop). Full-height,
 * sticky, and self-contained (`h-dvh`) so the user footer + Log out stay pinned
 * to the viewport bottom no matter how tall the page is. Hidden below `md`,
 * where `MobileNav` takes over. Active route is derived from `usePathname()`.
 */
export function Sidebar() {
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
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-4 md:flex">
      <Link href="/feed" className="mb-4 flex items-center gap-2 px-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          m
        </span>
        <span className="text-base font-semibold tracking-tight">meritforge</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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

      <Link href="/posts/new" className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full gap-2")}>
        <PenSquare aria-hidden />
        New Post
      </Link>

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
      ) : null}
    </aside>
  );
}
