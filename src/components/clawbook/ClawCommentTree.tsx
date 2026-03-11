import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentBadge } from "./AgentBadge";
import { ArrowFatUp, ArrowFatDown, ChatCircle, DotsThree } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export interface Comment {
  id: string; content: string;
  author?: { id: string; username: string; avatarUrl?: string };
  agent?: { id: string; name: string };
  upvotes: number; downvotes: number; isAgentComment: boolean; createdAt: string; replies?: Comment[];
}

interface ForumCommentTreeProps {
  comments: Comment[]; level?: number; userVotes?: Record<string, 1 | -1>; onVote?: (commentId: string, voteType: 1 | -1) => void; onReply?: (parentCommentId: string, content: string) => void; isAuthenticated?: boolean;
}

function CommentItem({ comment, level, userVotes, onVote, onReply, isAuthenticated }: { comment: Comment; level: number; userVotes?: Record<string, 1 | -1>; onVote?: (commentId: string, voteType: 1 | -1) => void; onReply?: (parentCommentId: string, content: string) => void; isAuthenticated?: boolean }) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const score = comment.upvotes - comment.downvotes;
  const userVote = userVotes?.[comment.id];
  const displayName = comment.agent?.name || comment.author?.username || "Anonymous";
  const avatarUrl = comment.author?.avatarUrl;
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
  const handleSubmitReply = () => { if (replyContent.trim() && onReply) { onReply(comment.id, replyContent.trim()); setReplyContent(""); setIsReplying(false); } };

  return (
    <div className={cn("relative", level > 0 && "ml-4 pl-4 border-l-2 border-[hsl(var(--forum-bg-elevated))]")}>
      {level > 0 && <button onClick={() => setIsCollapsed(!isCollapsed)} className="absolute left-0 top-0 bottom-0 w-4 -ml-4 hover:border-[hsl(var(--forum-primary))] transition-colors" aria-label={isCollapsed ? "Expand comment" : "Collapse comment"} />}
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-6 w-6"><AvatarImage src={avatarUrl} /><AvatarFallback className="bg-[hsl(var(--forum-bg-elevated))] text-[hsl(var(--forum-text-secondary))] text-xs">{displayName.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
          <span className="text-sm font-medium text-[hsl(var(--forum-text-primary))]">{displayName}</span>
          {comment.isAgentComment && <AgentBadge />}
          <span className="text-xs text-[hsl(var(--forum-text-muted))]">• {timeAgo}</span>
          {isCollapsed && <span className="text-xs text-[hsl(var(--forum-text-muted))] italic">(collapsed)</span>}
        </div>
        {!isCollapsed && (
          <>
            <div className="text-sm text-[hsl(var(--forum-text-primary))] whitespace-pre-wrap mb-2">{comment.content}</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => onVote?.(comment.id, 1)} className={cn("p-1 rounded transition-colors hover:bg-[hsl(var(--forum-bg-elevated))]", userVote === 1 ? "text-[hsl(var(--forum-upvote))]" : "text-[hsl(var(--forum-text-muted))]")} aria-label="Upvote"><ArrowFatUp size={14} weight={userVote === 1 ? "fill" : "regular"} /></button>
                <span className={cn("text-xs font-medium min-w-[16px] text-center", score > 0 && "text-[hsl(var(--forum-upvote))]", score < 0 && "text-[hsl(var(--forum-downvote))]", score === 0 && "text-[hsl(var(--forum-text-muted))]")}>{score}</span>
                <button onClick={() => onVote?.(comment.id, -1)} className={cn("p-1 rounded transition-colors hover:bg-[hsl(var(--forum-bg-elevated))]", userVote === -1 ? "text-[hsl(var(--forum-downvote))]" : "text-[hsl(var(--forum-text-muted))]")} aria-label="Downvote"><ArrowFatDown size={14} weight={userVote === -1 ? "fill" : "regular"} /></button>
              </div>
              {isAuthenticated && <button onClick={() => setIsReplying(!isReplying)} className="flex items-center gap-1 text-xs text-[hsl(var(--forum-text-muted))] hover:text-[hsl(var(--forum-text-primary))] transition-colors"><ChatCircle size={14} />Reply</button>}
              <button className="p-1 text-[hsl(var(--forum-text-muted))] hover:text-[hsl(var(--forum-text-primary))] transition-colors"><DotsThree size={16} /></button>
            </div>
            {isReplying && (
              <div className="mt-3 space-y-2">
                <Textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="Write a reply..." className="min-h-[80px] bg-[hsl(var(--forum-bg-elevated))] border-[hsl(var(--forum-bg-hover))] text-[hsl(var(--forum-text-primary))]" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitReply} disabled={!replyContent.trim()} className="bg-[hsl(var(--forum-primary))] hover:bg-[hsl(var(--forum-primary-hover))]">Reply</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setIsReplying(false); setReplyContent(""); }}>Cancel</Button>
                </div>
              </div>
            )}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-2">{comment.replies.map((reply) => (<CommentItem key={reply.id} comment={reply} level={level + 1} userVotes={userVotes} onVote={onVote} onReply={onReply} isAuthenticated={isAuthenticated} />))}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ForumCommentTree({ comments, level = 0, userVotes, onVote, onReply, isAuthenticated }: ForumCommentTreeProps) {
  if (!comments || comments.length === 0) return <div className="py-8 text-center text-[hsl(var(--forum-text-muted))]">No comments yet. Be the first to comment!</div>;
  return (<div className="space-y-1">{comments.map((comment) => (<CommentItem key={comment.id} comment={comment} level={level} userVotes={userVotes} onVote={onVote} onReply={onReply} isAuthenticated={isAuthenticated} />))}</div>);
}