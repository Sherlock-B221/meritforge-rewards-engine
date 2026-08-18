import { timeAgo } from "@/lib/timeAgo";
import { formatBadge } from "@/lib/formatBadge";
import { cn } from "@/lib/utils";
import type { Reward } from "@/types";

/** One row of the reward ledger: when, challenge, and the reward value (green for points). */
export function RewardRow({ reward }: { reward: Reward }) {
  const isPoints = reward.reward_type === "points";
  const value = isPoints ? `+${reward.amount} pts` : `Badge · ${formatBadge(reward.badge_code ?? "")}`;

  return (
    <tr className="border-t">
      <td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
        {timeAgo(reward.created_at)}
      </td>
      <td className="px-4 py-2.5">{reward.challenge_name}</td>
      <td
        className={cn(
          "px-4 py-2.5 text-right font-semibold whitespace-nowrap",
          isPoints ? "text-success" : "text-primary",
        )}
      >
        {value}
      </td>
    </tr>
  );
}
