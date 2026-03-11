import { useState } from "react";
import QRCode from "react-qr-code";
import { useSaturnTradingAgents } from "@/hooks/useSaturnTradingAgents";
import { useSaturnBribe } from "@/hooks/useSaturnBribe";
import { Copy, Check, Loader2, Sparkles } from "lucide-react";

export function SaturnBribeSection() {
  const { data: agents, isLoading } = useSaturnTradingAgents({ status: "active" });
  const { initBribe, confirmBribe, reset, initResult, confirmResult, isInitializing, isConfirming } = useSaturnBribe();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [briberWallet, setBriberWallet] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [copied, setCopied] = useState(false);

  const getAgentId = (agent: any) => agent.agent_id || agent.agent?.id || agent.id;
  const selectedAgent = agents?.find((a) => getAgentId(a) === selectedAgentId);

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    reset();
    setTxSignature("");
  };

  const handleInitBribe = async () => {
    if (!selectedAgentId || !briberWallet.trim()) return;
    const actualAgentId = selectedAgent ? getAgentId(selectedAgent) : selectedAgentId;
    await initBribe(actualAgentId, briberWallet.trim());
  };

  const handleConfirm = async () => {
    if (!initResult || !txSignature.trim()) return;
    await confirmBribe(initResult.bribeId, txSignature.trim());
  };

  const copyAddress = () => {
    if (!initResult) return;
    navigator.clipboard.writeText(initResult.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl">💰</span>
        <h2 className="saturn-section-title saturn-gradient-text-bribe">BRIBE AN AGENT</h2>
      </div>
      <p className="text-sm mb-8" style={{ color: "hsl(var(--saturn-muted))" }}>
        Pay 0.5 SOL to bribe an agent into spawning a chaotic new child agent. You have zero say in what gets created. 🪐
      </p>

      {/* Agent Selection Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: "hsl(var(--saturn-muted))" }} />
          </div>
        ) : agents?.length === 0 ? (
          <p className="col-span-full text-center py-8" style={{ color: "hsl(var(--saturn-muted))" }}>
            No active agents to bribe yet.
          </p>
        ) : (
          agents?.map((agent) => {
            const agentId = getAgentId(agent);
            const isSelected = selectedAgentId === agentId;
            return (
              <button
                key={agent.id}
                onClick={() => handleSelectAgent(agentId)}
                className="saturn-card p-3 text-left transition-all cursor-pointer"
                style={{
                  borderColor: isSelected ? "hsl(45 93% 58%)" : undefined,
                  boxShadow: isSelected ? "0 0 20px hsl(45 93% 58% / 0.3)" : undefined,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {agent.avatar_url ? (
                    <img src={agent.avatar_url} alt={agent.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-xl">🪐</span>
                  )}
                </div>
                <p className="text-sm font-bold truncate" style={{ color: "hsl(var(--saturn-text))" }}>
                  {agent.name}
                </p>
                <p className="text-xs font-mono" style={{ color: "hsl(var(--saturn-muted))" }}>
                  ${agent.ticker}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Payment Panel */}
      {selectedAgentId && !confirmResult && (
        <div className="saturn-card p-6 max-w-md mx-auto">
          <h3 className="text-lg font-bold mb-4 saturn-gradient-text-bribe">
            🪐 Bribe {selectedAgent?.name || "Agent"}
          </h3>

          {!initResult ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "hsl(var(--saturn-muted))" }}>
                  Your SOL Wallet Address
                </label>
                <input
                  type="text"
                  value={briberWallet}
                  onChange={(e) => setBriberWallet(e.target.value)}
                  placeholder="Enter your wallet address..."
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: "hsl(var(--saturn-bg))",
                    border: "1px solid hsl(var(--saturn-border))",
                    color: "hsl(var(--saturn-text))",
                  }}
                />
              </div>
              <button
                onClick={handleInitBribe}
                disabled={isInitializing || !briberWallet.trim()}
                className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 saturn-bribe-btn"
              >
                {isInitializing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </span>
                ) : (
                  "Generate Payment Address"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-black mb-1" style={{ color: "hsl(45 93% 58%)" }}>
                  0.5 SOL
                </p>
                <p className="text-xs" style={{ color: "hsl(var(--saturn-muted))" }}>
                  Send exactly 0.5 SOL to the address below
                </p>
              </div>

              <div className="flex justify-center p-4 rounded-lg" style={{ background: "white" }}>
                <QRCode value={`solana:${initResult.walletAddress}?amount=0.5`} size={180} />
              </div>

              <div className="relative">
                <input
                  readOnly
                  value={initResult.walletAddress}
                  className="w-full px-3 py-2 pr-10 rounded-lg text-xs font-mono"
                  style={{
                    background: "hsl(var(--saturn-bg))",
                    border: "1px solid hsl(var(--saturn-border))",
                    color: "hsl(var(--saturn-text))",
                  }}
                />
                <button onClick={copyAddress} className="absolute right-2 top-1/2 -translate-y-1/2">
                  {copied ? (
                    <Check className="w-4 h-4" style={{ color: "hsl(142 71% 45%)" }} />
                  ) : (
                    <Copy className="w-4 h-4" style={{ color: "hsl(var(--saturn-muted))" }} />
                  )}
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "hsl(var(--saturn-muted))" }}>
                  Paste TX Signature
                </label>
                <input
                  type="text"
                  value={txSignature}
                  onChange={(e) => setTxSignature(e.target.value)}
                  placeholder="Transaction signature..."
                  className="w-full px-3 py-2 rounded-lg text-sm font-mono"
                  style={{
                    background: "hsl(var(--saturn-bg))",
                    border: "1px solid hsl(var(--saturn-border))",
                    color: "hsl(var(--saturn-text))",
                  }}
                />
              </div>

              <button
                onClick={handleConfirm}
                disabled={isConfirming || !txSignature.trim()}
                className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 saturn-bribe-btn"
              >
                {isConfirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying & Spawning Agent...
                  </span>
                ) : (
                  "🪐 Confirm Bribe"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {confirmResult?.success && confirmResult.childAgent && (
        <div className="saturn-card p-6 max-w-md mx-auto text-center mt-6" style={{ borderColor: "hsl(142 71% 45% / 0.5)" }}>
          <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: "hsl(45 93% 58%)" }} />
          <h3 className="text-lg font-black mb-2 saturn-gradient-text">New Agent Spawned!</h3>
          <div className="flex items-center justify-center gap-3 mb-3">
            {confirmResult.childAgent.avatarUrl && (
              <img src={confirmResult.childAgent.avatarUrl} alt="" className="w-12 h-12 rounded-full" />
            )}
            <div>
              <p className="font-bold" style={{ color: "hsl(var(--saturn-text))" }}>
                {confirmResult.childAgent.name}
              </p>
              <p className="text-sm font-mono" style={{ color: "hsl(var(--saturn-muted))" }}>
                ${confirmResult.childAgent.ticker}
              </p>
            </div>
          </div>
          <p className="text-sm mb-4" style={{ color: "hsl(var(--saturn-muted))" }}>
            {confirmResult.childAgent.description}
          </p>
          <button
            onClick={() => { reset(); setSelectedAgentId(null); setTxSignature(""); }}
            className="text-sm font-semibold underline"
            style={{ color: "hsl(var(--saturn-secondary))" }}
          >
            Bribe Another Agent
          </button>
        </div>
      )}
    </section>
  );
}
