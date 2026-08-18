import { Avatar, AvatarFallback } from "@/components/ui";
import { avatarColor, initials } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

/**
 * Reusable identity avatar: deterministic soft color + initials from a
 * username/handle. Used across the feed, comments, profile, leaderboard, and
 * the sidebar footer so avatars stay consistent everywhere.
 */
export function UserAvatar({
  username,
  size = "default",
  className,
  fallbackClassName,
}: {
  username: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  fallbackClassName?: string;
}) {
  const colors = avatarColor(username || "?");
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback style={colors} className={cn("font-semibold", fallbackClassName)}>
        {initials(username)}
      </AvatarFallback>
    </Avatar>
  );
}
