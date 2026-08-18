import { WeeklyChallengeWidget } from "@/components/WeeklyChallengeWidget";
import { TopThisWeekWidget } from "@/components/TopThisWeekWidget";

/**
 * Cross-cutting right rail for the authenticated `(app)` shell. Hosts the
 * persistent `WeeklyChallengeWidget` and `TopThisWeekWidget` (both present on
 * every authenticated page), each in its own `SectionBoundary` so one
 * widget's fetch failure never takes down the other.
 */
export function RightRail() {
  return (
    <aside className="w-72 shrink-0 space-y-4 border-l p-4">
      <WeeklyChallengeWidget />
      <TopThisWeekWidget />
    </aside>
  );
}
