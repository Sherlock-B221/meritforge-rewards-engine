/** Known badge codes → human labels; unknown codes fall back to Title Case. */
const BADGE_LABELS: Record<string, string> = {
  first_solution: "First Solution",
  ten_answers: "10 Answers",
  week_streak: "Week Streak",
  deploy_verify: "Deploy Verify",
};

export function formatBadge(code: string): string {
  if (BADGE_LABELS[code]) {
    return BADGE_LABELS[code];
  }
  return code
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
