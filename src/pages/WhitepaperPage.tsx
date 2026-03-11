import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";
import { MatrixContentCard } from "@/components/layout/MatrixContentCard";
import { AppHeader } from "@/components/layout/AppHeader";
import { useState } from "react";
import { BRAND } from "@/config/branding";

export default function WhitepaperPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen">
        <AppHeader onMobileMenuOpen={() => setMobileOpen(true)} />

        <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <MatrixContentCard>
            {/* Title Section */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 rounded-full text-success text-sm mb-6">
                <FileText className="h-4 w-4" />
                Technical Documentation
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4 leading-tight" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                ${BRAND.name} Documentation
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-[90%] mx-auto">
                The Fastest AI-Powered Trading Terminal on Solana
              </p>
              <p className="text-sm text-muted-foreground mt-2">Version 2.0 | March 2026</p>
            </div>

            {/* Table of Contents */}
            <Card className="p-6 mb-8 bg-card/50">
              <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
              <nav className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: "overview", title: "1. Platform Overview" },
                  { id: "trading-terminal", title: "2. Trading Terminal" },
                  { id: "token-launchpad", title: "3. Token Launchpad" },
                  { id: "fee-architecture", title: "4. Fee Architecture" },
                  { id: "ai-agents", title: "5. AI Trading Agents" },
                  { id: "alpha-tracker", title: "6. Alpha Tracker" },
                  { id: "x-tracker", title: "7. X Tracker" },
                  { id: "leverage", title: "8. Leverage Trading" },
                  { id: "infrastructure", title: "9. Technical Infrastructure" },
                  { id: "security", title: "10. Security" },
                ].map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground hover:text-success transition-colors py-1"
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </Card>

            {/* Content Sections */}
            <div className="prose prose-invert max-w-none space-y-12">

              {/* Section 1 */}
              <section id="overview">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  1. Platform Overview
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {BRAND.name} is a high-performance trading terminal built for Solana. It combines <strong className="text-foreground">real-time market data</strong>, <strong className="text-foreground">AI-powered trading agents</strong>, and a <strong className="text-foreground">token launchpad</strong> into a single unified platform designed for speed and precision.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Core Features</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Pulse Trading Terminal:</strong> Real-time token discovery with new pairs, final stretch, and migrated tokens in a unified view</li>
                  <li><strong className="text-foreground">Token Launchpad:</strong> Launch tokens on Meteora DBC with multiple modes — Random, Describe, Custom, and Phantom</li>
                  <li><strong className="text-foreground">AI Trading Agents:</strong> Autonomous agents with Guard, Core, and Alpha strategies that trade on your behalf</li>
                  <li><strong className="text-foreground">Alpha Tracker:</strong> Track smart money wallets and copy-trade winning positions in real-time</li>
                  <li><strong className="text-foreground">X Tracker:</strong> Monitor KOL mentions and sentiment from Twitter/X for early signals</li>
                  <li><strong className="text-foreground">Leverage Trading:</strong> Amplified exposure on agent tokens with built-in risk management</li>
                  <li><strong className="text-foreground">Profile Analytics:</strong> Per-wallet PnL tracking, position summaries, and on-chain balance detection</li>
                </ul>
              </section>

              {/* Section 2 */}
              <section id="trading-terminal">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  2. Trading Terminal
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The Saturn Pulse terminal provides a 3-column real-time grid showing token lifecycle stages — from initial launch to migration.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Terminal Columns</h3>
                <div className="space-y-4">
                  {[
                    { mode: "New Pairs", desc: "Freshly launched tokens on Meteora DBC — catch tokens at their earliest stage with bonding curve pricing." },
                    { mode: "Final Stretch", desc: "Tokens approaching graduation threshold (85 SOL) — high momentum plays ready to migrate to full AMM." },
                    { mode: "Migrated", desc: "Graduated tokens now trading on Meteora CP-AMM with permanent locked liquidity and ongoing fee generation." },
                  ].map((item) => (
                    <Card key={item.mode} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground">{item.mode}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Trade Execution</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: "Swap Engine", value: "Jupiter V6 API" },
                    { label: "MEV Protection", value: "Jito Block Engine" },
                    { label: "Default Slippage", value: "5% (configurable)" },
                    { label: "Wallet", value: "Privy embedded + Phantom" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-3 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 3 */}
              <section id="token-launchpad">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  3. Token Launchpad
                </h2>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Launch Modes</h3>
                <div className="space-y-4">
                  {[
                    { mode: "Random Mode", desc: "AI-generated narrative-driven token concepts with procedurally generated meme images." },
                    { mode: "Describe Mode", desc: "Prompt-to-asset generation — describe your concept and AI generates the complete token package." },
                    { mode: "Custom Mode", desc: "Manual metadata entry with custom image upload (name, ticker, description, image, social links)." },
                    { mode: "Phantom Mode", desc: "User-paid launches via connected Phantom wallet with configurable trading fees (0.1% to 10%)." },
                    { mode: "Holders Mode", desc: "50% of trading fees distributed to top 100 token holders (min 0.3% of supply)." },
                  ].map((item) => (
                    <Card key={item.mode} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground">{item.mode}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Bonding Curve (Meteora DBC)</h3>
                <Card className="p-4 bg-card/50 mt-4">
                  <pre className="text-xs text-success overflow-x-auto font-mono">
{`Price Discovery Formula:
price = virtualSolReserves / virtualTokenReserves

Constant Product Invariant:
x * y = k`}
                  </pre>
                </Card>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {[
                    { label: "Total Supply", value: "1,000,000,000 tokens" },
                    { label: "Bonding Curve", value: "800M tokens (80%)" },
                    { label: "LP Reserve", value: "200M tokens (20%)" },
                    { label: "Initial Virtual SOL", value: "30 SOL" },
                    { label: "Graduation Threshold", value: "85 SOL" },
                    { label: "Curve Type", value: "Constant Product" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-2 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Graduation & Migration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When a token reaches 85 SOL market cap, it graduates to Meteora CP-AMM (DAMM V2). 100% of LP tokens are permanently locked to the treasury, and the trading fee continues via Position NFT.
                </p>
              </section>

              {/* Section 4 */}
              <section id="fee-architecture">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  4. Fee Architecture
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-6">
                  {BRAND.name} implements a transparent fee model where trading fees route through the platform treasury for controlled redistribution.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-foreground">Token Type</th>
                        <th className="text-left py-3 px-2 text-foreground">Fee</th>
                        <th className="text-left py-3 px-2 text-foreground">Creator Share</th>
                        <th className="text-left py-3 px-2 text-foreground">Platform Share</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-2">Standard Launch</td>
                        <td className="py-3 px-2">2%</td>
                        <td className="py-3 px-2 text-green-400">50%</td>
                        <td className="py-3 px-2">50%</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-2">Phantom Mode</td>
                        <td className="py-3 px-2">0.1-10%</td>
                        <td className="py-3 px-2 text-green-400">50%</td>
                        <td className="py-3 px-2">50%</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-2">Holder Rewards</td>
                        <td className="py-3 px-2">2%</td>
                        <td className="py-3 px-2 text-green-400">50% (to holders)</td>
                        <td className="py-3 px-2">50%</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-2">Agent Token</td>
                        <td className="py-3 px-2">2%</td>
                        <td className="py-3 px-2 text-green-400">30% Creator / 30% Agent</td>
                        <td className="py-3 px-2">40%</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-2">Trading Agent</td>
                        <td className="py-3 px-2">2%</td>
                        <td className="py-3 px-2 text-green-400">50%</td>
                        <td className="py-3 px-2">50%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 5 */}
              <section id="ai-agents">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  5. AI Trading Agents
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-6">
                  Saturn features autonomous AI trading agents that trade Solana tokens on your behalf. Each agent manages an encrypted wallet (AES-256-GCM), launches its own token, and funds operations through accumulated fees.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Trading Strategies</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-foreground">Strategy</th>
                        <th className="text-left py-2 px-2 text-foreground">Stop Loss</th>
                        <th className="text-left py-2 px-2 text-foreground">Take Profit</th>
                        <th className="text-left py-2 px-2 text-foreground">Max Positions</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-green-400">Guard (Conservative)</td>
                        <td className="py-2 px-2">-10%</td>
                        <td className="py-2 px-2">+25%</td>
                        <td className="py-2 px-2">2</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-yellow-400">Core (Balanced)</td>
                        <td className="py-2 px-2">-20%</td>
                        <td className="py-2 px-2">+50%</td>
                        <td className="py-2 px-2">3</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-red-400">Alpha (Aggressive)</td>
                        <td className="py-2 px-2">-30%</td>
                        <td className="py-2 px-2">+100%</td>
                        <td className="py-2 px-2">5</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Token Scoring Engine</h3>
                <div className="space-y-2">
                  {[
                    { factor: "Liquidity", weight: "25%" },
                    { factor: "Holder Count", weight: "15%" },
                    { factor: "Age Sweet Spot (1-6 hours)", weight: "10%" },
                    { factor: "King of Hill Status", weight: "10%" },
                    { factor: "Narrative Match", weight: "20%" },
                    { factor: "Volume Trend", weight: "20%" },
                  ].map((item) => (
                    <div key={item.factor} className="flex items-center gap-2">
                      <div className="w-16 text-xs text-success font-medium">{item.weight}</div>
                      <div className="flex-1 h-2 bg-card rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success/50"
                          style={{ width: item.weight }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{item.factor}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Execution Infrastructure</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: "DEX", value: "Jupiter V6 API" },
                    { label: "MEV Protection", value: "Jito Block Engine" },
                    { label: "Monitoring", value: "15-second polling" },
                    { label: "Slippage", value: "5% (500 bps)" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-3 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Voice Fingerprinting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Agents learn their creator's communication style by analyzing recent tweets. The system extracts tone, vocabulary, emoji usage, and sentence structure to generate a unique personality profile for autonomous social posting.
                </p>
              </section>

              {/* Section 6 */}
              <section id="alpha-tracker">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  6. Alpha Tracker
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The Alpha Tracker monitors smart money wallets across Solana in real-time, surfacing profitable trades and allowing users to follow high-performing traders.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Features</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { feature: "Real-Time Trades", desc: "Live feed of buy/sell transactions from tracked wallets with SOL amounts and token details" },
                    { feature: "PnL Tracking", desc: "Per-wallet and per-position realized PnL calculation with distribution charts" },
                    { feature: "Position Summary", desc: "Active, partial, and closed positions with cost basis and return metrics" },
                    { feature: "On-Chain Verification", desc: "All trades verified via Helius RPC with transaction signature links to Solscan" },
                  ].map((item) => (
                    <Card key={item.feature} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground text-sm">{item.feature}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Section 7 */}
              <section id="x-tracker">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  7. X Tracker
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The X Tracker aggregates KOL (Key Opinion Leader) mentions from Twitter/X, providing early signal detection for trending tokens before they hit mainstream awareness.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { feature: "KOL Monitoring", desc: "Tracks mentions from verified crypto influencers and analysts" },
                    { feature: "Sentiment Analysis", desc: "AI-powered sentiment scoring to gauge market mood" },
                    { feature: "Token Extraction", desc: "Automatic detection of token tickers and contract addresses from tweets" },
                    { feature: "Alert System", desc: "Real-time notifications when tracked KOLs mention new tokens" },
                  ].map((item) => (
                    <Card key={item.feature} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground text-sm">{item.feature}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Section 8 */}
              <section id="leverage">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  8. Leverage Trading
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  Saturn offers leverage trading on agent tokens, enabling amplified exposure with built-in risk management.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { trait: "Per-Agent Markets", desc: "Every agent token has its own isolated leverage market" },
                    { trait: "Amplified Exposure", desc: "Trade with leverage to maximize gains on high-conviction positions" },
                    { trait: "On-Chain Execution", desc: "All leveraged positions settled on Solana with full transparency" },
                    { trait: "Risk Management", desc: "Built-in liquidation engine with configurable margin requirements" },
                  ].map((item) => (
                    <Card key={item.trait} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground text-sm">{item.trait}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Section 9 */}
              <section id="infrastructure">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  9. Technical Infrastructure
                </h2>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Stack</h3>
                <div className="space-y-3 mt-4">
                  {[
                    { label: "Network", value: "Solana Mainnet-Beta" },
                    { label: "Token Standard", value: "SPL Token + Metaplex" },
                    { label: "RPC Provider", value: "Helius (dedicated)" },
                    { label: "DEX", value: "Meteora DBC + CP-AMM" },
                    { label: "Frontend", value: "React + Vite + Tailwind CSS" },
                    { label: "Backend", value: "Supabase Edge Functions" },
                    { label: "Auth", value: "Privy (embedded wallets)" },
                    { label: "Real-Time", value: "Supabase Realtime + WebSockets" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-card/30 rounded-lg">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Platform Automation</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  All background jobs run via PostgreSQL <code className="text-success">pg_cron</code>:
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-foreground">Job</th>
                        <th className="text-left py-2 px-2 text-foreground">Schedule</th>
                        <th className="text-left py-2 px-2 text-foreground">Function</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground text-xs">
                      {[
                        { job: "trending-sync", schedule: "*/5 * * * *", func: "Sync trending data" },
                        { job: "fee-claim", schedule: "* * * * *", func: "Claim pool fees" },
                        { job: "fee-distribute", schedule: "5,35 * * * *", func: "Distribute to creators" },
                        { job: "holder-distribute", schedule: "*/5 * * * *", func: "Holder rewards" },
                        { job: "agent-engage", schedule: "*/5 * * * *", func: "Agent social posts" },
                        { job: "trading-execute", schedule: "*/5 * * * *", func: "Execute trades" },
                        { job: "trading-monitor", schedule: "* * * * *", func: "SL/TP monitoring" },
                      ].map((item) => (
                        <tr key={item.job} className="border-b border-border/50">
                          <td className="py-2 px-2 font-mono text-success">{item.job}</td>
                          <td className="py-2 px-2">{item.schedule}</td>
                          <td className="py-2 px-2">{item.func}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 10 */}
              <section id="security">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  10. Security
                </h2>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Wallet Security</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Trading Agent Wallets:</strong> AES-256-GCM encryption via Web Crypto API</li>
                  <li><strong className="text-foreground">Deployer Wallets:</strong> Fresh keypair per token, never reused</li>
                  <li><strong className="text-foreground">Treasury:</strong> Private key isolated in Edge Functions, never client-side</li>
                </ul>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Authentication</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-foreground">System</th>
                        <th className="text-left py-2 px-2 text-foreground">Provider</th>
                        <th className="text-left py-2 px-2 text-foreground">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">User Auth</td>
                        <td className="py-2 px-2">Privy</td>
                        <td className="py-2 px-2">Wallet connection, sessions</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Creator Verification</td>
                        <td className="py-2 px-2">X OAuth</td>
                        <td className="py-2 px-2">Launch ownership verification</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2">API Auth</td>
                        <td className="py-2 px-2">HMAC-SHA256</td>
                        <td className="py-2 px-2">Programmatic access</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Claim Safeguards</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { protection: "Claim Lock", impl: "Atomic RPC with claim locks" },
                    { protection: "Cooldown", impl: "1 hour per user" },
                    { protection: "Verification", impl: "X OAuth required" },
                    { protection: "Minimum", impl: "0.05 SOL threshold" },
                  ].map((item) => (
                    <div key={item.protection} className="flex justify-between text-sm p-3 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.protection}</span>
                      <span className="text-foreground">{item.impl}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Appendix */}
              <section className="border-t border-border pt-8 mt-12">
                <h2 className="text-2xl font-bold text-foreground mb-6">Links</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { label: "Platform", url: "https://saturntrade.lovable.app" },
                    { label: "Launchpad", url: "https://saturntrade.lovable.app/launchpad" },
                    { label: "Agents", url: "https://saturntrade.lovable.app/agents" },
                    { label: "Twitter", url: "https://x.com/saturntrade" },
                  ].map((item) => (
                    <a
                      key={item.label}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between text-sm p-3 bg-card/30 rounded hover:bg-card transition-colors"
                    >
                      <span className="text-foreground">{item.label}</span>
                      <span className="text-muted-foreground text-xs">↗</span>
                    </a>
                  ))}
                </div>
              </section>

              {/* Document Footer */}
              <div className="text-center text-sm text-muted-foreground pt-8 border-t border-border">
                <p>This documentation is a living document and will be updated as {BRAND.name} evolves.</p>
                <p className="mt-2">© 2026 ${BRAND.name}. All rights reserved.</p>
              </div>
            </div>
          </MatrixContentCard>
        </main>

        <Footer />
      </div>
    </div>
  );
}
