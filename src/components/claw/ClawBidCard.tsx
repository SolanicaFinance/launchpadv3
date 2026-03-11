import { useState } from "react";
import { Timer, TrendingUp, Gavel, Copy, Check, ArrowUpRight } from "lucide-react";
import { useSaturnBidCountdown } from "@/hooks/useSaturnBidCountdown";
import { useSaturnAgentBid, MIN_BID_SOL, BID_INCREMENT_SOL } from "@/hooks/useSaturnAgentBid";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface ClawBidCardProps {
  tradingAgentId: string;
  agentName: string;
  biddingEndsAt: string | null;
  isOwned: boolean;
  ownerWallet?: string | null;
  walletAddress?: string | null;
  bidWalletAddress?: string | null;
}

export function ClawBidCard({ tradingAgentId, agentName, biddingEndsAt, isOwned, ownerWallet, walletAddress, bidWalletAddress }: ClawBidCardProps) {
  const [bidAmount, setBidAmount] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [copied, setCopied] = useState(false);
  const { timeLeft, isExpired } = useSaturnBidCountdown(biddingEndsAt);
  const { bidStatus, isPlacingBid, placeBid } = useSaturnAgentBid(tradingAgentId);

  const handleCopyAddress = async () => {
    const addr = bidStatus?.agent?.bidWalletAddress || bidWalletAddress;
    if (!addr) return;
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    toast({ title: "Wallet address copied!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBid = async () => {
    if (!walletAddress) {
      toast({ title: "Connect wallet to bid", variant: "destructive" });
      return;
    }
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount < MIN_BID_SOL) {
      toast({ title: `Minimum bid is ${MIN_BID_SOL} SOL`, variant: "destructive" });
      return;
    }
    if (!txSignature.trim()) {
      toast({ title: "Enter your transaction signature after sending SOL", variant: "destructive" });
      return;
    }

    try {
      await placeBid({ tradingAgentId, bidderWallet: walletAddress, bidAmountSol: amount, txSignature: txSignature.trim() });
      toast({ title: "🪐 Bid Placed & Verified!", description: `${amount} SOL on ${agentName}` });
      setBidAmount("");
      setTxSignature("");
    } catch (e) {
      toast({ title: "Bid failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  if (isOwned) {
    return (
      <div className="p-2 rounded-lg" style={{ background: "hsl(142, 71%, 45%, 0.1)", border: "1px solid hsl(142, 71%, 45%, 0.3)" }}>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" style={{ color: "hsl(142, 71%, 45%)" }} />
          <span className="text-[10px] font-bold" style={{ color: "hsl(142, 71%, 45%)" }}>
            {ownerWallet === "CLAW_SYSTEM" ? "SYSTEM OWNED" : "OWNED"}
          </span>
        </div>
        {ownerWallet && ownerWallet !== "CLAW_SYSTEM" && (
          <p className="text-[9px] mt-0.5 truncate" style={{ color: "hsl(var(--saturn-muted))" }}>
            {ownerWallet.slice(0, 4)}...{ownerWallet.slice(-4)}
          </p>
        )}
      </div>
    );
  }

  if (!biddingEndsAt || isExpired) {
    return (
      <div className="p-2 rounded-lg" style={{ background: "hsl(var(--saturn-bg))", border: "1px solid hsl(var(--saturn-border))" }}>
        <span className="text-[10px]" style={{ color: "hsl(var(--saturn-muted))" }}>Bidding ended</span>
      </div>
    );
  }

  const highestBid = bidStatus?.highestBid?.amount || 0;
  const minNextBid = bidStatus?.minNextBid || (highestBid > 0 ? highestBid + BID_INCREMENT_SOL : MIN_BID_SOL);
  const displayBidWallet = bidStatus?.agent?.bidWalletAddress || bidWalletAddress;

  return (
    <div className="p-2.5 rounded-lg" style={{ background: "hsl(var(--saturn-primary) / 0.05)", border: "1px solid hsl(var(--saturn-primary) / 0.3)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Gavel className="h-3 w-3" style={{ color: "hsl(var(--saturn-primary))" }} />
          <span className="text-[10px] font-bold" style={{ color: "hsl(var(--saturn-primary))" }}>BIDDING OPEN</span>
        </div>
        <div className="flex items-center gap-1">
          <Timer className="h-3 w-3" style={{ color: "hsl(var(--saturn-accent))" }} />
          <span className="text-[10px] font-mono font-bold" style={{ color: "hsl(var(--saturn-accent))" }}>{timeLeft}</span>
        </div>
      </div>

      {/* Bid wallet address */}
      {displayBidWallet && (
        <div className="mb-2 p-1.5 rounded" style={{ background: "hsl(var(--saturn-bg))", border: "1px solid hsl(var(--saturn-border))" }}>
          <div className="text-[9px] mb-0.5" style={{ color: "hsl(var(--saturn-muted))" }}>Send SOL to:</div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono truncate flex-1" style={{ color: "hsl(var(--saturn-text))" }}>
              {displayBidWallet}
            </span>
            <button onClick={handleCopyAddress} className="p-0.5 rounded" style={{ color: "hsl(var(--saturn-secondary))" }}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}

      <div className="mb-2 text-[10px]" style={{ color: "hsl(var(--saturn-muted))" }}>
        {highestBid > 0 ? (
          <>Highest: <span className="font-bold" style={{ color: "hsl(var(--saturn-text))" }}>{highestBid} SOL</span>
          {bidStatus?.totalBids > 0 && <span> ({bidStatus.totalBids} bids)</span>}
          <span> · Next min: <span className="font-bold" style={{ color: "hsl(var(--saturn-primary))" }}>{minNextBid} SOL</span></span></>
        ) : (
          <>Starting bid: <span className="font-bold" style={{ color: "hsl(var(--saturn-primary))" }}>{MIN_BID_SOL} SOL</span></>
        )}
      </div>

      <div className="space-y-1.5">
        <Input
          type="number"
          step="0.5"
          min={minNextBid}
          placeholder={`${minNextBid} SOL`}
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          className="h-7 text-xs"
          style={{ background: "hsl(var(--saturn-bg))", borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }}
        />
        <Input
          type="text"
          placeholder="TX signature after sending SOL"
          value={txSignature}
          onChange={(e) => setTxSignature(e.target.value)}
          className="h-7 text-xs font-mono"
          style={{ background: "hsl(var(--saturn-bg))", borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }}
        />
        <button
          onClick={handleBid}
          disabled={isPlacingBid || !bidAmount || !txSignature}
          className="w-full px-3 h-7 rounded text-[10px] font-bold disabled:opacity-40 flex items-center justify-center gap-1"
          style={{ background: "hsl(var(--saturn-primary))", color: "#000" }}
        >
          {isPlacingBid ? "Verifying..." : <>SUBMIT BID 🪐 <ArrowUpRight className="h-3 w-3" /></>}
        </button>
      </div>
    </div>
  );
}
