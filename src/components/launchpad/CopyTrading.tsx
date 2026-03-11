import { useState, useEffect, forwardRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatSolAmount } from "@/hooks/useLaunchpad";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  Trash2, 
  Copy, 
  Bell, 
  BellOff,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Loader2,
  Wallet
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TrackedWallet {
  id: string;
  wallet_address: string;
  wallet_label: string | null;
  is_copy_trading_enabled: boolean;
  copy_amount_sol: number | null;
  max_per_trade_sol: number | null;
  notifications_enabled: boolean;
  total_pnl_sol: number | null;
  trades_copied: number | null;
  created_at: string;
}

interface WalletTrade {
  id: string;
  wallet_address: string;
  token_mint: string;
  token_name: string | null;
  token_ticker: string | null;
  trade_type: 'buy' | 'sell';
  sol_amount: number;
  token_amount: number;
  price_per_token: number;
  signature: string;
  created_at: string;
}

export const CopyTrading = forwardRef<HTMLDivElement, Record<string, never>>(function CopyTrading(_props, ref) {
  const { profileId, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletLabel, setNewWalletLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Fetch tracked wallets
  const { data: trackedWallets = [], isLoading: loadingWallets } = useQuery({
    queryKey: ['tracked-wallets', profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data: resp, error: fnError } = await supabase.functions.invoke('wallet-tracker-manage', {
        body: { action: 'list', user_profile_id: profileId },
      });

      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);
      return (resp?.data || []) as TrackedWallet[];
    },
    enabled: !!profileId,
  });

  // Fetch recent trades from tracked wallets
  const { data: recentTrades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ['wallet-trades', trackedWallets.map(w => w.wallet_address)],
    queryFn: async () => {
      if (trackedWallets.length === 0) return [];
      
      const walletAddresses = trackedWallets.map(w => w.wallet_address);
      const { data, error } = await supabase
        .from('wallet_trades')
        .select('*')
        .in('wallet_address', walletAddresses)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as WalletTrade[];
    },
    enabled: trackedWallets.length > 0,
  });

  // Subscribe to realtime wallet trades
  useEffect(() => {
    if (trackedWallets.length === 0) return;

    const channel = supabase
      .channel('wallet-trades-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wallet_trades' },
        (payload) => {
          const trade = payload.new as WalletTrade;
          const isTracked = trackedWallets.some(w => w.wallet_address === trade.wallet_address);
          
          if (isTracked) {
            queryClient.invalidateQueries({ queryKey: ['wallet-trades'] });
            
            // Show notification
            const wallet = trackedWallets.find(w => w.wallet_address === trade.wallet_address);
            if (wallet?.notifications_enabled) {
              toast({
                title: `${wallet.wallet_label || trade.wallet_address.slice(0, 6)} ${trade.trade_type === 'buy' ? 'bought' : 'sold'}`,
                description: `${formatSolAmount(trade.sol_amount)} SOL of ${trade.token_ticker || 'token'}`,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackedWallets, queryClient, toast]);

  const addWallet = async () => {
    if (!profileId || !newWalletAddress) return;
    
    // Basic Solana address validation
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(newWalletAddress)) {
      toast({ title: "Invalid wallet address", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke('wallet-tracker-manage', {
        body: {
          action: 'add',
          user_profile_id: profileId,
          wallet_address: newWalletAddress,
          wallet_label: newWalletLabel || null,
        },
      });

      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);

      toast({ title: "Wallet added!" });
      setNewWalletAddress('');
      setNewWalletLabel('');
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ['tracked-wallets'] });
    } catch (error: any) {
      toast({ 
        title: "Failed to add wallet", 
        description: error.message?.includes('duplicate') ? "Wallet already tracked" : error.message,
        variant: "destructive" 
      });
    } finally {
      setIsAdding(false);
    }
  };

  const removeWallet = async (id: string) => {
    if (!profileId) return;
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke('wallet-tracker-manage', {
        body: { action: 'remove', user_profile_id: profileId, wallet_id: id },
      });

      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);
      toast({ title: "Wallet removed" });
      queryClient.invalidateQueries({ queryKey: ['tracked-wallets'] });
    } catch (error) {
      toast({ title: "Failed to remove wallet", variant: "destructive" });
    }
  };

  const toggleNotifications = async (id: string, enabled: boolean) => {
    if (!profileId) return;
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke('wallet-tracker-manage', {
        body: { action: 'update', user_profile_id: profileId, wallet_id: id, updates: { notifications_enabled: enabled } },
      });

      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);
      queryClient.invalidateQueries({ queryKey: ['tracked-wallets'] });
    } catch (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const toggleCopyTrading = async (id: string, enabled: boolean) => {
    if (!profileId) return;
    try {
      const { data: resp, error: fnError } = await supabase.functions.invoke('wallet-tracker-manage', {
        body: { action: 'update', user_profile_id: profileId, wallet_id: id, updates: { is_copy_trading_enabled: enabled } },
      });

      if (fnError) throw fnError;
      if (resp?.error) throw new Error(resp.error);
      toast({ title: enabled ? "Copy trading enabled" : "Copy trading disabled" });
      queryClient.invalidateQueries({ queryKey: ['tracked-wallets'] });
    } catch (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  if (!isAuthenticated) {
    return (
      <Card ref={ref} className="p-6 text-center">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-bold text-lg mb-2">Copy Trading</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Track wallets and copy their trades automatically
        </p>
        <Button onClick={() => login()}>
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </Card>
    );
  }

  return (
    <div ref={ref} className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold">Copy Trading</h2>
              <p className="text-xs text-muted-foreground">
                {trackedWallets.length} wallet{trackedWallets.length !== 1 ? 's' : ''} tracked
              </p>
            </div>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Track Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Wallet Address</Label>
                  <Input
                    placeholder="Enter Solana wallet address"
                    value={newWalletAddress}
                    onChange={(e) => setNewWalletAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g., Smart Trader"
                    value={newWalletLabel}
                    onChange={(e) => setNewWalletLabel(e.target.value)}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={addWallet}
                  disabled={isAdding || !newWalletAddress}
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Add Wallet"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      {/* Tracked Wallets */}
      {loadingWallets ? (
        <Card className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </Card>
      ) : trackedWallets.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No wallets tracked yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add a wallet to start receiving trade notifications
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {trackedWallets.map((wallet) => (
            <Card key={wallet.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {wallet.wallet_label?.slice(0, 2) || wallet.wallet_address.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {wallet.wallet_label || `${wallet.wallet_address.slice(0, 6)}...${wallet.wallet_address.slice(-4)}`}
                      </span>
                      {wallet.is_copy_trading_enabled && (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                          <Copy className="h-3 w-3 mr-1" />
                          Copying
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{wallet.trades_copied || 0} trades copied</span>
                      <span>•</span>
                      <span className={wallet.total_pnl_sol && wallet.total_pnl_sol >= 0 ? 'text-green-500' : 'text-red-500'}>
                        {wallet.total_pnl_sol ? `${wallet.total_pnl_sol >= 0 ? '+' : ''}${formatSolAmount(wallet.total_pnl_sol)} SOL` : '0 SOL'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleNotifications(wallet.id, !wallet.notifications_enabled)}
                  >
                    {wallet.notifications_enabled ? (
                      <Bell className="h-4 w-4 text-primary" />
                    ) : (
                      <BellOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                  <a
                    href={`https://solscan.io/account/${wallet.wallet_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeWallet(wallet.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Copy Trading Toggle */}
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Auto Copy Trades</p>
                  <p className="text-xs text-muted-foreground">Automatically copy trades (max 1 SOL per trade)</p>
                </div>
                <Switch
                  checked={wallet.is_copy_trading_enabled}
                  onCheckedChange={(checked) => toggleCopyTrading(wallet.id, checked)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Trades Feed */}
      {recentTrades.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {recentTrades.slice(0, 5).map((trade) => {
              const wallet = trackedWallets.find(w => w.wallet_address === trade.wallet_address);
              return (
                <div key={trade.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`p-1 rounded ${trade.trade_type === 'buy' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                      {trade.trade_type === 'buy' ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {wallet?.wallet_label || `${trade.wallet_address.slice(0, 6)}...`} {trade.trade_type === 'buy' ? 'bought' : 'sold'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trade.token_ticker || 'token'} • {formatDistanceToNow(new Date(trade.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">
                    {formatSolAmount(trade.sol_amount)} SOL
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
});

CopyTrading.displayName = "CopyTrading";