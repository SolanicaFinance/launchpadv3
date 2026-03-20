import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Loader2, Search, AlertTriangle, ArrowRight, ExternalLink, Zap, Shield, TrendingDown, TrendingUp, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ── Types ──
interface SandwichData {
  confirmed: boolean;
  slotSpread: number;
  commonMint: string;
  frontrun: TxSummary;
  victim: TxSummary;
  backrun: TxSummary;
  botWallet: string;
  victimWallet: string;
  botProfitSol: number;
  victimLossSol: number;
  botTotalFees: number;
  botJitoTips: number;
}

interface TxSummary {
  signature: string;
  slot: number;
  feePayer: string;
  fee: number;
  jitoTip?: number;
  tokensBought?: number;
  tokensSold?: number;
  solSpent?: number;
  solReceived?: number;
  pricePerToken: number;
}

interface ProcessedTx {
  signature: string;
  slot: number;
  timestamp: number;
  feePayer: string;
  fee: number;
  jitoTip: number;
  type: string;
  source: string;
  description: string;
  tokenTransfers: any[];
  nativeTransfers: any[];
}

interface MonitorResult {
  slot: number;
  timestamp: number;
  victimSignature: string;
  botWallet: string;
  botSignatures: string[];
  commonMints: string[];
  victimFee: number;
  victimDescription: string;
}

// ── Helpers ──
const shortSig = (sig: string) => sig ? `${sig.slice(0, 6)}...${sig.slice(-4)}` : "";
const shortAddr = (addr: string) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : "";
const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;
const solscanAddr = (addr: string) => `https://solscan.io/account/${addr}`;

export default function MevAdminPage() {
  // Analyzer state
  const [sigInput, setSigInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [transactions, setTransactions] = useState<ProcessedTx[]>([]);
  const [sandwich, setSandwich] = useState<SandwichData | null>(null);

  // Monitor state
  const [monitorWallet, setMonitorWallet] = useState("");
  const [monitoring, setMonitoring] = useState(false);
  const [monitorResults, setMonitorResults] = useState<MonitorResult[]>([]);
  const [monitorTotal, setMonitorTotal] = useState(0);

  const handleAnalyze = async () => {
    const sigs = sigInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sigs.length === 0) {
      toast({ title: "Enter at least one signature", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setSandwich(null);
    setTransactions([]);
    try {
      const { data, error } = await supabase.functions.invoke("mev-analyze", {
        body: { signatures: sigs, save: true },
      });
      if (error) throw error;
      setTransactions(data.transactions || []);
      setSandwich(data.sandwich || null);
      if (data.sandwich?.confirmed) {
        toast({ title: "🥪 Sandwich attack confirmed!" });
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMonitor = async () => {
    if (!monitorWallet.trim()) {
      toast({ title: "Enter a wallet address", variant: "destructive" });
      return;
    }
    setMonitoring(true);
    setMonitorResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("mev-monitor", {
        body: { walletAddress: monitorWallet.trim(), limit: 100 },
      });
      if (error) throw error;
      setMonitorResults(data.potentialSandwiches || []);
      setMonitorTotal(data.totalTransactions || 0);
      toast({
        title: `Scanned ${data.totalTransactions} txs`,
        description: `Found ${data.sandwichCount} potential sandwich(es)`,
      });
    } catch (err: any) {
      toast({ title: "Monitor failed", description: err.message, variant: "destructive" });
    } finally {
      setMonitoring(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Section 1: Transaction Analyzer ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-mono uppercase tracking-widest">
            <Zap className="w-4 h-4 text-primary" /> Transaction Analyzer
          </CardTitle>
          <CardDescription>
            Paste 1-3 transaction signatures to analyze. For sandwich detection, provide the front-run, victim, and back-run signatures.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Signatures (one per line or comma-separated)</Label>
            <Textarea
              value={sigInput}
              onChange={(e) => setSigInput(e.target.value)}
              placeholder={`3e8CuS9YVGAX3WCM3vBEkCFZ8DwFrKXLajuepxt4cpY8JSkr5MaMhotphHDiGdCyUdtR2aN2LZLYGimQerspV8tp\n2DzrNsymL7DQxWA1jBWWoLz3aXAy2K38ddfGowhcJrx855SGK5q4DXxpfkvzbd7fPq6W4tcKwGCYyjQF8bQrmMNf`}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
          <Button onClick={handleAnalyze} disabled={analyzing}>
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Analyze
          </Button>

          {/* Transaction results */}
          {transactions.length > 0 && (
            <div className="space-y-3 mt-4">
              <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Parsed Transactions</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Signature</TableHead>
                      <TableHead className="text-xs">Slot</TableHead>
                      <TableHead className="text-xs">Fee Payer</TableHead>
                      <TableHead className="text-xs">Fee (SOL)</TableHead>
                      <TableHead className="text-xs">Jito Tip</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.signature}>
                        <TableCell className="font-mono text-xs">
                          <a href={solscanTx(tx.signature)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            {shortSig(tx.signature)} <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">{tx.slot}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <a href={solscanAddr(tx.feePayer)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {shortAddr(tx.feePayer)}
                          </a>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">{tx.fee.toFixed(6)}</TableCell>
                        <TableCell className="font-mono text-xs tabular-nums">{tx.jitoTip > 0 ? tx.jitoTip.toFixed(6) : "—"}</TableCell>
                        <TableCell className="text-xs">{tx.type || tx.source}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{tx.description}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Sandwich Breakdown ── */}
      {sandwich && (
        <Card className={sandwich.confirmed ? "border-destructive/50" : "border-yellow-500/50"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className={`w-4 h-4 ${sandwich.confirmed ? "text-destructive" : "text-yellow-500"}`} />
              {sandwich.confirmed ? "🥪 Sandwich Attack Confirmed" : "Possible Sandwich (Unconfirmed)"}
            </CardTitle>
            <CardDescription>
              Slot spread: {sandwich.slotSpread} | Token: <span className="font-mono">{shortAddr(sandwich.commonMint)}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Front-run */}
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-red-400">
                  <TrendingUp className="w-3 h-3" /> Front-run (Bot Buys)
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signature</span>
                    <a href={solscanTx(sandwich.frontrun.signature)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline flex items-center gap-1">
                      {shortSig(sandwich.frontrun.signature)} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Slot</span><span className="font-mono tabular-nums">{sandwich.frontrun.slot}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SOL Spent</span><span className="font-mono tabular-nums">{sandwich.frontrun.solSpent?.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tokens Bought</span><span className="font-mono tabular-nums">{sandwich.frontrun.tokensBought?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Price/Token</span><span className="font-mono tabular-nums">{sandwich.frontrun.pricePerToken?.toExponential(4)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-mono tabular-nums">{sandwich.frontrun.fee?.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Jito Tip</span><span className="font-mono tabular-nums">{sandwich.frontrun.jitoTip?.toFixed(6) || "0"}</span></div>
                </div>
              </div>

              {/* Victim */}
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-yellow-400">
                  <AlertTriangle className="w-3 h-3" /> Victim (Your TX)
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signature</span>
                    <a href={solscanTx(sandwich.victim.signature)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline flex items-center gap-1">
                      {shortSig(sandwich.victim.signature)} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Slot</span><span className="font-mono tabular-nums">{sandwich.victim.slot}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SOL Spent</span><span className="font-mono tabular-nums">{sandwich.victim.solSpent?.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tokens Bought</span><span className="font-mono tabular-nums">{sandwich.victim.tokensBought?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Price/Token</span><span className="font-mono tabular-nums">{sandwich.victim.pricePerToken?.toExponential(4)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-mono tabular-nums">{sandwich.victim.fee?.toFixed(6)}</span></div>
                </div>
              </div>

              {/* Back-run */}
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-green-400">
                  <TrendingDown className="w-3 h-3" /> Back-run (Bot Sells)
                </div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Signature</span>
                    <a href={solscanTx(sandwich.backrun.signature)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline flex items-center gap-1">
                      {shortSig(sandwich.backrun.signature)} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Slot</span><span className="font-mono tabular-nums">{sandwich.backrun.slot}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">SOL Received</span><span className="font-mono tabular-nums">{sandwich.backrun.solReceived?.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tokens Sold</span><span className="font-mono tabular-nums">{sandwich.backrun.tokensSold?.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Price/Token</span><span className="font-mono tabular-nums">{sandwich.backrun.pricePerToken?.toExponential(4)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-mono tabular-nums">{sandwich.backrun.fee?.toFixed(6)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Jito Tip</span><span className="font-mono tabular-nums">{sandwich.backrun.jitoTip?.toFixed(6) || "0"}</span></div>
                </div>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Bot Profit</div>
                <div className={`font-mono text-sm font-bold tabular-nums ${sandwich.botProfitSol > 0 ? "text-green-400" : "text-red-400"}`}>
                  {sandwich.botProfitSol.toFixed(6)} SOL
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Your Loss</div>
                <div className="font-mono text-sm font-bold text-red-400 tabular-nums">
                  {sandwich.victimLossSol.toFixed(6)} SOL
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Bot Total Fees</div>
                <div className="font-mono text-sm font-bold tabular-nums">
                  {sandwich.botTotalFees.toFixed(6)} SOL
                </div>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Jito Tips</div>
                <div className="font-mono text-sm font-bold tabular-nums">
                  {sandwich.botJitoTips.toFixed(6)} SOL
                </div>
              </div>
            </div>

            {/* Bot wallet */}
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Bot Wallet:</span>
              <a href={solscanAddr(sandwich.botWallet)} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline flex items-center gap-1">
                {sandwich.botWallet} <ExternalLink className="w-3 h-3" />
              </a>
              <button onClick={() => { navigator.clipboard.writeText(sandwich.botWallet); toast({ title: "Copied" }); }}>
                <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Wallet MEV Monitor ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-mono uppercase tracking-widest">
            <Shield className="w-4 h-4 text-primary" /> Wallet MEV Scanner
          </CardTitle>
          <CardDescription>Scan a wallet's recent transactions for potential sandwich attacks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={monitorWallet}
              onChange={(e) => setMonitorWallet(e.target.value)}
              placeholder="Wallet address..."
              className="font-mono text-xs"
            />
            <Button onClick={handleMonitor} disabled={monitoring} className="shrink-0">
              {monitoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {monitorResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Scanned {monitorTotal} transactions — found {monitorResults.length} potential sandwich(es)
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Slot</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Your TX</TableHead>
                      <TableHead className="text-xs">Bot Wallet</TableHead>
                      <TableHead className="text-xs">Bot TXs</TableHead>
                      <TableHead className="text-xs">Token(s)</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monitorResults.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs tabular-nums">{r.slot}</TableCell>
                        <TableCell className="text-xs">{r.timestamp ? new Date(r.timestamp * 1000).toLocaleString() : "—"}</TableCell>
                        <TableCell>
                          <a href={solscanTx(r.victimSignature)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">
                            {shortSig(r.victimSignature)}
                          </a>
                        </TableCell>
                        <TableCell>
                          <a href={solscanAddr(r.botWallet)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">
                            {shortAddr(r.botWallet)}
                          </a>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.botSignatures.length}</TableCell>
                        <TableCell className="font-mono text-xs">{r.commonMints.map(shortAddr).join(", ")}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{r.victimDescription}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {monitorTotal > 0 && monitorResults.length === 0 && (
            <p className="text-xs text-green-400">✓ No sandwich attacks detected in {monitorTotal} recent transactions.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: MEV Research Reference ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-mono uppercase tracking-widest">
            <Zap className="w-4 h-4 text-primary" /> MEV Replication Research
          </CardTitle>
          <CardDescription>How sandwich bots work and what's needed to run one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-widest text-primary">How Sandwich Bots Work</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li><strong>Mempool monitoring:</strong> Bot watches pending transactions via Geyser plugins or validator shredstreams for swap instructions</li>
              <li><strong>Opportunity detection:</strong> Identifies swaps with high slippage tolerance on liquid pairs</li>
              <li><strong>Bundle construction:</strong> Creates a Jito bundle with 3 txs: front-run buy → victim swap → back-run sell</li>
              <li><strong>Jito submission:</strong> Submits bundle with tip to Jito block engine for guaranteed atomic inclusion</li>
              <li><strong>Profit extraction:</strong> Bot's sell price &gt; buy price due to victim's price impact. Profit = spread - fees - tips</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-widest text-primary">Infrastructure Required</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="font-medium">Geyser Plugin / LaserStream</div>
                <div className="text-muted-foreground">Sub-millisecond transaction visibility. Geyser attaches to validator; LaserStream (by Helius) provides similar via gRPC stream.</div>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="font-medium">Dedicated Validator</div>
                <div className="text-muted-foreground">Running your own validator gives earliest access to shreds and block production. Cost: ~$500-1500/mo for bare metal.</div>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="font-medium">Jito Block Engine Access</div>
                <div className="text-muted-foreground">Bundle submission for guaranteed tx ordering. Tips typically 0.0001-0.01 SOL per bundle.</div>
              </div>
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="font-medium">Co-located RPC</div>
                <div className="text-muted-foreground">Low-latency RPC in same datacenter as validators. ~$300-500/mo for dedicated nodes.</div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-widest text-primary">Useful Tools</h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: "Jito Explorer", url: "https://explorer.jito.wtf" },
                { label: "sandwiched.me", url: "https://sandwiched.me" },
                { label: "Helius LaserStream", url: "https://docs.helius.dev/streams/laserstream" },
                { label: "Jito Bundles Docs", url: "https://jito-labs.gitbook.io/mev/searcher-resources/bundles" },
              ].map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors">
                  {link.label} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-widest text-primary">Estimated Costs</h4>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Component</TableHead>
                    <TableHead className="text-xs">Monthly Cost</TableHead>
                    <TableHead className="text-xs">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { comp: "Dedicated Validator Node", cost: "$500 – $1,500", notes: "Bare metal, 256GB RAM, fast NVMe" },
                    { comp: "Co-located RPC", cost: "$300 – $500", notes: "Same datacenter as major validators" },
                    { comp: "Helius LaserStream", cost: "$499+", notes: "gRPC shred stream, sub-ms latency" },
                    { comp: "Jito Tips (variable)", cost: "0.0001 – 0.01 SOL/bundle", notes: "Competitive; higher tip = better inclusion" },
                    { comp: "Bot Development", cost: "Engineering time", notes: "Rust preferred for speed; also TypeScript viable" },
                  ].map((row) => (
                    <TableRow key={row.comp}>
                      <TableCell className="text-xs font-medium">{row.comp}</TableCell>
                      <TableCell className="text-xs font-mono tabular-nums">{row.cost}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
