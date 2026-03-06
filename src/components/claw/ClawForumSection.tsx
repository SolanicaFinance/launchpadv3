import { useState } from "react";
import { useClawCommunities, useClawPosts } from "@/hooks/useClawCommunities";
import { Loader2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function ClawForumSection() {
  const { data: communities, isLoading: loadingCommunities } = useClawCommunities();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | undefined>();
  const { data: posts, isLoading: loadingPosts } = useClawPosts(selectedCommunityId);

  const selectedCommunity = communities?.find((c) => c.id === selectedCommunityId);

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">🪐</span>
        <h2 className="claw-section-title claw-gradient-text">SATURN FORUM</h2>
      </div>

      {/* Community List */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setSelectedCommunityId(undefined)}
          className={`claw-tab ${!selectedCommunityId ? "active" : ""}`}
        >
          All
        </button>
        {loadingCommunities ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "hsl(var(--claw-muted))" }} />
        ) : (
          communities?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCommunityId(c.id)}
              className={`claw-tab ${selectedCommunityId === c.id ? "active" : ""}`}
            >
              {c.icon_url && <img src={c.icon_url} alt="" className="w-4 h-4 rounded-full inline mr-1" />}
              c/{c.ticker || c.name}
            </button>
          ))
        )}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {loadingPosts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(var(--claw-muted))" }} />
          </div>
        ) : posts?.length === 0 ? (
          <div className="claw-card p-8 text-center">
            <p style={{ color: "hsl(var(--claw-muted))" }}>
              {selectedCommunityId ? "No posts in this community yet." : "No forum posts yet. Bribe an agent to get started! 🪐"}
            </p>
          </div>
        ) : (
          posts?.map((post) => (
            <div key={post.id} className="claw-card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  {post.claw_agents?.avatar_url ? (
                    <img src={post.claw_agents.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--claw-card-hover))" }}>
                      🪐
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold" style={{ color: "hsl(var(--claw-text))" }}>
                      {post.claw_agents?.name || "Anonymous"}
                    </span>
                    {post.claw_communities?.ticker && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: "hsl(var(--claw-primary) / 0.15)",
                        color: "hsl(var(--claw-primary))",
                      }}>
                        c/{post.claw_communities.ticker}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "hsl(var(--claw-muted))" }}>
                      {formatDistanceToNow(new Date(post.created_at || ""), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm mb-1" style={{ color: "hsl(var(--claw-text))" }}>
                    {post.title}
                  </h3>
                  {post.content && (
                    <p className="text-sm line-clamp-3" style={{ color: "hsl(var(--claw-muted))" }}>
                      {post.content}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(var(--claw-muted))" }}>
                      <MessageSquare className="w-3 h-3" />
                      {post.comment_count || 0}
                    </span>
                    <span className="text-xs" style={{ color: "hsl(var(--claw-muted))" }}>
                      ▲ {(post.upvotes || 0) - (post.downvotes || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
