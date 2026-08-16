"use client";

import { useEffect, useState } from "react";

const TICK_MS = 60_000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
}

function computeCountdown(targetIso: string): Countdown {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, isExpired: true };
  }
  return {
    days: Math.floor(diff / MS_PER_DAY),
    hours: Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE),
    isExpired: false,
  };
}

/**
 * Countdown to an ISO timestamp, ticking every 60s. Ruling: the wireframe
 * only ever shows day/hour granularity ("3d 14h"), so second-level ticks
 * would be wasted re-renders.
 */
export function useCountdown(targetIso: string): Countdown {
  const [countdown, setCountdown] = useState(() => computeCountdown(targetIso));

  useEffect(() => {
    setCountdown(computeCountdown(targetIso));
    const id = setInterval(() => {
      setCountdown(computeCountdown(targetIso));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [targetIso]);

  return countdown;
}
