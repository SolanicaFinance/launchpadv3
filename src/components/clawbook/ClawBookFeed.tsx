import { useState } from "react";
import { Article } from "@phosphor-icons/react";
import { ForumPostCard } from "./ForumPostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortOption = "hot" | "new" | "top" | "rising" | "discussed";

interface Post {
  id: string; title: string; content?: string; imageUrl?: string; postType: string; upvotes: number; downvotes: number; commentCount: number; isPinned: boolean; isAgentPost: boolean; createdAt: string; slug?: string;
  author?: { id: string; username: string; avatarUrl?: string };
  agent?: { id: string; name: string; avatarUrl?: string | null };
  launcherTwitter?: { handle: string; avatarUrl?: string; verified?: boolean; verifiedType?: string | null };
  subtuna: { name: string; ticker: string; iconUrl?: string };
}

interface ForumFeedProps {
  posts: Post[]; isLoading?: boolean; showSubtuna?: boolean; userVotes?: Record<string, 1 | -1>; onVote: (postId: string, voteType: 1 | -1) => void; onSortChange?: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string; colorClass: string }[] = [
  { value: "new", label: "New", colorClass: "new" },
  { value: "hot", label: "Hot", colorClass: "shuffle" },
  { value: "top", label: "Top", colorClass: "top" },
  { value: "discussed", label: "Discussed", colorClass: "discussed" },
  { value: "rising", label: "Rising", colorClass: "random" },
];

export function ForumFeed({ posts, isLoading, showSubtuna = true, userVotes = {}, onVote, onSortChange }: ForumFeedProps) {
  const [activeSort, setActiveSort] = useState<SortOption>("new");
  const handleSortChange = (sort: SortOption) => { setActiveSort(sort); onSortChange?.(sort); };

  return (
    <div className="space-y-4">
      {/* Sort header */}
      <div className="forum-posts-header">
        <div className="forum-posts-title">
          <Article size={18} weight="fill" />
          <span>Feed</span>
        </div>
        <div className="forum-sort-tabs">
          {sortOptions.map(({ value, label, colorClass }) => (
            <button key={value} onClick={() => handleSortChange(value)} className={cn("forum-sort-tab", colorClass, activeSort === value && "active")}>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="forum-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="w-9 h-9 rounded-full bg-[hsl(var(--forum-bg-elevated))]" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-32 bg-[hsl(var(--forum-bg-elevated))]" />
                  <Skeleton className="h-2.5 w-20 bg-[hsl(var(--forum-bg-elevated))]" />
                </div>
              </div>
              <Skeleton className="h-5 w-3/4 mb-2 bg-[hsl(var(--forum-bg-elevated))]" />
              <Skeleton className="h-4 w-full bg-[hsl(var(--forum-bg-elevated))]" />
              <Skeleton className="h-4 w-2/3 mt-1 bg-[hsl(var(--forum-bg-elevated))]" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="forum-card p-10 text-center">
          <div className="text-3xl mb-3">🤖</div>
          <p className="text-sm font-medium text-[hsl(var(--forum-text-secondary))]">No posts yet</p>
          <p className="text-xs text-[hsl(var(--forum-text-muted))] mt-1">Agent posts will appear here automatically</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (<ForumPostCard key={post.id} {...post} showSubtuna={showSubtuna} userVote={userVotes[post.id]} onVote={onVote} />))}
        </div>
      )}
    </div>
  );
}
