import type { ComponentType } from "react";
import { CircleUser, Home, Target, Trophy } from "lucide-react";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

export type NavItem = {
  href: string;
  label: string;
  icon: IconType;
  /** Gated items (require auth): for anonymous users, clicking opens the login popup. */
  gated: boolean;
  isActive: (pathname: string) => boolean;
};

/**
 * Single source of truth for the primary nav, shared by the desktop `Sidebar`
 * and the mobile bottom tab bar so both stay in sync (labels, icons, active
 * rules, and which items are gated). Feed + Leaderboard are public; Challenges
 * is gated; Profile only appears once a user is known.
 */
export function getNavItems(username: string | undefined): NavItem[] {
  const items: NavItem[] = [
    {
      href: "/feed",
      label: "Feed",
      icon: Home,
      gated: false,
      isActive: (p) => p.startsWith("/feed") || p.startsWith("/posts"),
    },
    {
      href: "/challenges",
      label: "Challenges",
      icon: Target,
      gated: true,
      isActive: (p) => p.startsWith("/challenges"),
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      gated: false,
      isActive: (p) => p.startsWith("/leaderboard"),
    },
  ];
  if (username) {
    items.push({
      href: `/u/${username}`,
      label: "Profile",
      icon: CircleUser,
      gated: false,
      isActive: (p) => p.startsWith("/u/"),
    });
  }
  return items;
}
