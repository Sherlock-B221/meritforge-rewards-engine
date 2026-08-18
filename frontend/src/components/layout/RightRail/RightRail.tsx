import { WeeklyChallengeWidget } from "@/components/WeeklyChallengeWidget";
import { TopThisWeekWidget } from "@/components/TopThisWeekWidget";

/**
 * Right rail for the authenticated `(app)` shell. Full-height + sticky so it
 * stays in view while the feed scrolls, with its own overflow so long content
 * never pushes the layout. Hidden below `lg`; on smaller screens the weekly
 * challenge surfaces via the mobile weekly banner / Challenges page instead.
 */
export function RightRail() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 space-y-4 overflow-y-auto border-l p-4 lg:block">
      <WeeklyChallengeWidget />
      <TopThisWeekWidget />
    </aside>
  );
}
