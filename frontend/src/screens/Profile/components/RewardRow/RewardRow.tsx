import { timeAgo } from "@/lib/timeAgo";
import type { Reward } from "@/types";

/** Render one reward's value — points amount, or the badge code. */
function formatRewardValue(reward: Reward): string {
  return reward.reward_type === "points" ? `+${reward.amount} pts` : `Badge: ${reward.badge_code}`;
}

/** One row of the reward ledger table: challenge name, reward value, relative time. */
export function RewardRow({ reward }: { reward: Reward }) {
  return (
    <tr className="border-t">
      <td className="px-4 py-3">{reward.challenge_name}</td>
      <td className="px-4 py-3 font-medium text-primary">{formatRewardValue(reward)}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(reward.created_at)}</td>
    </tr>
  );
}
