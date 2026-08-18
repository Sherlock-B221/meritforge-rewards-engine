import type { ComponentType } from "react";
import { CircleUser, Home, Target, Trophy } from "lucide-react";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  isActive: (pathname: string) => boolean;
};

/**
 * Single source of truth for the primary nav, shared by the desktop `Sidebar`
 * and the mobile bottom tab bar so both stay in sync (labels, icons, and the
 * active-route rules). The Profile item only appears once a user is known.
 */
export function getNavItems(username: string | undefined): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/feed",
      label: "Feed",
      icon: Home,
      isActive: (p) => p.startsWith("/feed") || p.startsWith("/posts"),
    },
    {
      href: "/challenges",
      label: "Challenges",
      icon: Target,
      isActive: (p) => p.startsWith("/challenges"),
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      isActive: (p) => p.startsWith("/leaderboard"),
    },
  ];
  if (username) {
    items.push({
      href: `/u/${username}`,
      label: "Profile",
      icon: CircleUser,
      isActive: (p) => p.startsWith("/u/"),
    });
  }
  return items;
}
