import { ArrowFatUp, ArrowFatDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface ForumVoteButtonsProps {
  upvotes: number; downvotes: number; userVote?: 1 | -1 | null; onVote: (voteType: 1 | -1) => void; size?: "sm" | "md" | "lg"; disabled?: boolean;
}

export function ForumVoteButtons({ upvotes, downvotes, userVote, onVote, size = "md", disabled = false }: ForumVoteButtonsProps) {
  const score = upvotes - downvotes;
  const iconSize = size === "sm" ? 16 : size === "lg" ? 24 : 20;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button onClick={() => onVote(1)} disabled={disabled} className={cn("forum-vote-btn", userVote === 1 && "upvoted")} aria-label="Upvote"><ArrowFatUp size={iconSize} weight={userVote === 1 ? "fill" : "regular"} /></button>
      <span className={cn("forum-vote-score tabular-nums", size === "lg" && "text-xl", userVote === 1 && "text-[hsl(var(--forum-upvote))]", userVote === -1 && "text-[hsl(var(--forum-downvote))]", !userVote && "text-[hsl(var(--forum-text-primary))]")}>{score}</span>
      <button onClick={() => onVote(-1)} disabled={disabled} className={cn("forum-vote-btn", userVote === -1 && "downvoted")} aria-label="Downvote"><ArrowFatDown size={iconSize} weight={userVote === -1 ? "fill" : "regular"} /></button>
    </div>
  );
}