import { useState, useCallback } from "react";
import { useMultiWallet, ManagedWallet } from "@/hooks/useMultiWallet";
import { useExportWallet } from "@privy-io/react-auth/solana";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wallet, Copy, Check, Key, Plus, RefreshCw, Star, Pencil, ExternalLink, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MyWalletsSection() {
  const {
    managedWallets, activeWallet, switchWallet, createNewWallet,
    renameWallet, refreshBalances, creating, canCreateMore, walletCount,
  } = useMultiWallet();
  const { toast } = useToast();
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [editingAddr, setEditingAddr] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  let exportWalletFn: any = null;
  try {
    const { exportWallet } = useExportWallet();
    exportWalletFn = exportWallet;
  } catch { /* not available */ }

  const handleCopy = useCallback(async (addr: string) => {
    const ok = await copyToClipboard(addr);
    if (ok) {
      setCopiedAddr(addr);
      setTimeout(() => setCopiedAddr(null), 2000);
    }
  }, []);

  const handleExport = useCallback(async (addr: string) => {
    if (!exportWalletFn) {
      toast({ title: "Export not available", variant: "destructive" });
      return;
    }
    try {
      await exportWalletFn({ address: addr });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message, variant: "destructive" });
    }
  }, [exportWalletFn, toast]);

  const handleRename = useCallback(async (addr: string) => {
    if (!editLabel.trim()) return;
    await renameWallet(addr, editLabel.trim());
    setEditingAddr(null);
    toast({ title: "Wallet renamed" });
  }, [editLabel, renameWallet, toast]);

  const handleCreate = useCallback(async () => {
    try {
      await createNewWallet();
      toast({ title: "New wallet created" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    }
  }, [createNewWallet, toast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshBalances();
    setRefreshing(false);
  }, [refreshBalances]);

  if (managedWallets.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <Wallet className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">No wallets found. Log in to see your embedded wallets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          My Wallets
          <span className="text-xs text-muted-foreground font-normal">({walletCount})</span>
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-7 text-[10px] gap-1 font-mono"
          >
            <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            Refresh
          </Button>
          {canCreateMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreate}
              disabled={creating}
              className="h-7 text-[10px] gap-1 font-mono"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              New
            </Button>
          )}
        </div>
      </div>

      {/* Wallet cards */}
      <div className="space-y-2">
        {managedWallets.map((w) => (
          <WalletCard
            key={w.address}
            wallet={w}
            isActive={activeWallet?.address === w.address}
            copiedAddr={copiedAddr}
            editingAddr={editingAddr}
            editLabel={editLabel}
            onSwitch={() => switchWallet(w.address)}
            onCopy={() => handleCopy(w.address)}
            onExport={exportWalletFn ? () => handleExport(w.address) : undefined}
            onStartRename={() => { setEditingAddr(w.address); setEditLabel(w.label); }}
            onCancelRename={() => setEditingAddr(null)}
            onConfirmRename={() => handleRename(w.address)}
            onEditLabelChange={setEditLabel}
          />
        ))}
      </div>
    </div>
  );
}

interface WalletCardProps {
  wallet: ManagedWallet;
  isActive: boolean;
  copiedAddr: string | null;
  editingAddr: string | null;
  editLabel: string;
  onSwitch: () => void;
  onCopy: () => void;
  onExport?: () => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onConfirmRename: () => void;
  onEditLabelChange: (v: string) => void;
}

function WalletCard({
  wallet, isActive, copiedAddr, editingAddr, editLabel,
  onSwitch, onCopy, onExport, onStartRename, onCancelRename, onConfirmRename, onEditLabelChange,
}: WalletCardProps) {
  const isEditing = editingAddr === wallet.address;
  const isCopied = copiedAddr === wallet.address;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all",
        isActive
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card hover:border-border/80"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <button
          onClick={onSwitch}
          className={cn(
            "mt-0.5 p-1.5 rounded-lg transition-colors shrink-0",
            isActive ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
          )}
          title={isActive ? "Active wallet" : "Switch to this wallet"}
        >
          {isActive ? <Star className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Label */}
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editLabel}
                  onChange={(e) => onEditLabelChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") onConfirmRename(); if (e.key === "Escape") onCancelRename(); }}
                  className="h-6 text-xs px-2 w-32"
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={onConfirmRename} className="h-6 w-6 p-0">
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className="text-xs font-semibold text-foreground">{wallet.label}</span>
                {isActive && (
                  <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full uppercase">
                    Active
                  </span>
                )}
                <button onClick={onStartRename} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3 w-3" />
                </button>
              </>
            )}
          </div>

          {/* Address */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {wallet.address}
            </span>
          </div>

          {/* Balance */}
          <div className="text-xs font-mono text-foreground">
            {wallet.balance !== null ? `${wallet.balance.toFixed(4)} SOL` : "—"}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onCopy}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Copy address"
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <a
            href={`https://solscan.io/account/${wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="View on Solscan"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {onExport && (
            <button
              onClick={onExport}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Export private key"
            >
              <Key className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
