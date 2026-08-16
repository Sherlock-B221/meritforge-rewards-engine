import { WeeklyChallengeWidget } from "@/components/WeeklyChallengeWidget";

/**
 * Cross-cutting right rail for the authenticated `(app)` shell. Hosts the
 * persistent `WeeklyChallengeWidget` (present on every authenticated page).
 */
export function RightRail() {
  return (
    <aside className="w-72 shrink-0 border-l p-4">
      <WeeklyChallengeWidget />
    </aside>
  );
}
