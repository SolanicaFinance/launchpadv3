import { useState } from "react";
import { useMultiWallet, type ManagedWallet } from "@/hooks/useMultiWallet";
import { Button } from "@/components/ui/button";
import { Copy, Check, Plus, RefreshCw, Pencil, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function shortenAddr(a: string) {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}

export default function WalletManagerPanel() {
  const {
    managedWallets,
    activeWallet,
    switchWallet,
    createNewWallet,
    renameWallet,
    refreshBalances,
    creating,
    canCreateMore,
    walletCount,
  } = useMultiWallet();
  const { toast } = useToast();
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [editingAddr, setEditingAddr] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    toast({ title: "Copied!", description: "Wallet address copied" });
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const handleCreate = async () => {
    try {
      await createNewWallet();
      toast({ title: "Wallet Created", description: `Wallet ${walletCount + 1} ready` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalances();
    setRefreshing(false);
  };

  const handleRename = async (addr: string) => {
    if (editLabel.trim()) {
      await renameWallet(addr, editLabel.trim());
    }
    setEditingAddr(null);
    setEditLabel("");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#F97316]" />
          <h3 className="text-sm font-bold text-foreground">
            Wallets ({walletCount}/25)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-7 px-2 text-[10px]"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          {canCreateMore && (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating}
              className="h-7 px-3 text-[10px] gap-1 rounded-xl"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", color: "#fff" }}
            >
              <Plus className="h-3 w-3" />
              {creating ? "Creating..." : "New Wallet"}
            </Button>
          )}
        </div>
      </div>

      {/* Wallet List */}
      <div className="space-y-1.5">
        {managedWallets.map((w) => (
          <WalletRow
            key={w.address}
            wallet={w}
            isActive={activeWallet?.address === w.address}
            copied={copiedAddr === w.address}
            editing={editingAddr === w.address}
            editLabel={editLabel}
            onSelect={() => switchWallet(w.address)}
            onCopy={() => handleCopy(w.address)}
            onStartEdit={() => { setEditingAddr(w.address); setEditLabel(w.label); }}
            onEditChange={setEditLabel}
            onSaveEdit={() => handleRename(w.address)}
          />
        ))}
      </div>

      {managedWallets.length === 0 && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(51,65,85,0.2)" }}
        >
          <Wallet className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No wallets found. Connect your account first.</p>
        </div>
      )}
    </div>
  );
}

function WalletRow({
  wallet,
  isActive,
  copied,
  editing,
  editLabel,
  onSelect,
  onCopy,
  onStartEdit,
  onEditChange,
  onSaveEdit,
}: {
  wallet: ManagedWallet;
  isActive: boolean;
  copied: boolean;
  editing: boolean;
  editLabel: string;
  onSelect: () => void;
  onCopy: () => void;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
      style={{
        background: isActive ? "rgba(249,115,22,0.08)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isActive ? "rgba(249,115,22,0.25)" : "rgba(51,65,85,0.15)"}`,
      }}
    >
      {/* Active indicator */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: isActive ? "#F97316" : "rgba(100,116,139,0.3)" }}
      />

      {/* Name */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={editLabel}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={(e) => e.key === "Enter" && onSaveEdit()}
            className="bg-transparent border-b border-[#F97316] text-xs text-foreground outline-none w-full"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate">{wallet.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <span className="text-[10px] font-mono text-muted-foreground">{shortenAddr(wallet.address)}</span>
      </div>

      {/* Balance */}
      <span className="text-xs font-mono font-bold text-foreground shrink-0">
        {wallet.balance !== null ? `${wallet.balance.toFixed(4)} SOL` : "—"}
      </span>

      {/* Copy */}
      <button
        onClick={(e) => { e.stopPropagation(); onCopy(); }}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
