"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakFlameProps {
  days: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Animated streak flame + day count. Burns (animates) only when the streak is live. */
export function StreakFlame({ days, size = "md", className }: StreakFlameProps) {
  const active = days > 0;
  const iconSize = size === "lg" ? "size-8" : size === "sm" ? "size-4" : "size-5";
  const numSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-lg";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Flame
        aria-hidden
        className={cn(iconSize, active ? "animate-flame text-streak" : "text-muted-foreground")}
        fill={active ? "currentColor" : "none"}
      />
      <span className={cn("font-display font-bold tabular-nums", numSize)}>{days}</span>
    </span>
  );
}
