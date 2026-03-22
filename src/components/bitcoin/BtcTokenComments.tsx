import { useState, useEffect } from 'react';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Comment {
  id: string;
  wallet_address: string;
  content: string;
  created_at: string;
}

interface BtcTokenCommentsProps {
  tokenId: string;
}

export function BtcTokenComments({ tokenId }: BtcTokenCommentsProps) {
  const { address, isConnected } = useBtcWallet();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = () => {
    supabase
      .from('btc_token_comments')
      .select('*')
      .eq('btc_token_id', tokenId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setComments(data);
      });
  };

  useEffect(() => {
    fetchComments();
  }, [tokenId]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !address) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('btc_token_comments').insert({
        btc_token_id: tokenId,
        wallet_address: address,
        content: newComment.trim(),
      });
      if (error) throw error;
      setNewComment('');
      fetchComments();
      toast.success('Comment posted');
    } catch (e) {
      toast.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-sm font-bold text-foreground mb-4">
        Comments ({comments.length})
      </h3>

      {/* Post comment */}
      {isConnected ? (
        <div className="mb-4 space-y-2">
          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">
              Posting as {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || submitting}
              size="sm"
              className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
            >
              {submitting ? 'Posting...' : 'Post'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-4">Connect wallet to comment</p>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map(comment => (
            <div key={comment.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <a
                  href={`https://mempool.space/address/${comment.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-primary hover:underline"
                >
                  {comment.wallet_address.slice(0, 8)}...{comment.wallet_address.slice(-4)}
                </a>
                <span className="text-[10px] text-muted-foreground">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-foreground">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
