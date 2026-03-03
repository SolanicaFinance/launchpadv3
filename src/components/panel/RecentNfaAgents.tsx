import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, ExternalLink, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NfaMint {
  id: string;
  slot_number: number;
  minter_wallet: string;
  status: string;
  agent_name: string | null;
  agent_image_url: string | null;
  nfa_mint_address: string | null;
  created_at: string;
}

export default function RecentNfaAgents() {
  const { data: mints = [], isLoading } = useQuery({
    queryKey: ["recent-nfa-mints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("nfa_mints" as any)
        .select("id, slot_number, minter_wallet, status, agent_name, agent_image_url, nfa_mint_address, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as unknown as NfaMint[];
    },
    staleTime: 30_000,
  });

  const shortenWallet = (w: string) => `${w.slice(0, 4)}...${w.slice(-4)}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold font-mono tracking-wide text-[#F1F5F9]">
          RECENT NFA AGENTS
        </h3>
        <span className="text-[10px] text-[#64748B] font-mono">
          {mints.length > 0 ? `${mints.length} minted` : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-4 h-4 border-2 border-transparent border-t-[#F97316] rounded-full animate-spin" />
        </div>
      ) : mints.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-10 text-center max-w-[700px] mx-auto"
          style={{
            background: "rgba(30,41,59,0.45)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(51,65,85,0.4)",
          }}
        >
          <Bot className="h-16 w-16 mx-auto mb-4 text-primary/50" />
          <p className="text-base font-semibold text-foreground mb-1.5">No NFA agents minted yet</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Be the first to mint an autonomous agent
          </p>
          <span
            className="inline-block text-xs font-medium px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20"
          >
            Mint from the NFAs tab above ↑
          </span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {mints.map((mint) => (
            <div
              key={mint.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.03]"
              style={{ border: "1px solid rgba(51,65,85,0.25)" }}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-[#1E293B] flex items-center justify-center">
                {mint.agent_image_url ? (
                  <img src={mint.agent_image_url} alt="" className="w-9 h-9 object-cover" />
                ) : (
                  <Bot className="w-4 h-4 text-[#475569]" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#E2E8F0] truncate">
                  {mint.agent_name || `NFA #${mint.slot_number}`}
                </p>
                <p className="text-[11px] text-[#64748B] font-mono">
                  {shortenWallet(mint.minter_wallet)}
                  <span className="mx-1.5">·</span>
                  {formatDistanceToNow(new Date(mint.created_at), { addSuffix: false })} ago
                </p>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    background: mint.status === "completed" ? "rgba(34,197,94,0.1)" : "rgba(249,115,22,0.1)",
                    color: mint.status === "completed" ? "#4ade80" : "#F97316",
                    border: `1px solid ${mint.status === "completed" ? "rgba(34,197,94,0.2)" : "rgba(249,115,22,0.2)"}`,
                  }}
                >
                  <Zap className="w-2.5 h-2.5" />
                  {mint.status === "completed" ? "Active" : "Pending"}
                </span>
                {mint.nfa_mint_address && (
                  <a
                    href={`https://solscan.io/token/${mint.nfa_mint_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#475569] hover:text-[#94A3B8] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
