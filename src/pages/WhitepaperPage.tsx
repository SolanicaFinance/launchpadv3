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
                {BRAND.name} Documentation
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground max-w-[90%] mx-auto">
                Multi-Chain AI Trading Terminal — Solana &amp; BNB Chain
              </p>
              <p className="text-sm text-muted-foreground mt-2">Token: <strong className="text-success">$MOON</strong> · Version 2.0 · March 2026</p>
            </div>

            {/* Table of Contents */}
            <Card className="p-6 mb-8 bg-card/50">
              <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
              <nav className="grid sm:grid-cols-2 gap-2">
                {[
                  { id: "overview", title: "1. Platform Overview" },
                  { id: "trading-terminal", title: "2. Pulse Trading Terminal" },
                  { id: "token-launchpad", title: "3. Token Launchpad" },
                  { id: "tokens-discover", title: "4. Tokens & Discover" },
                  { id: "ai-agents", title: "5. AI Trading Agents" },
                  { id: "alpha-tracker", title: "6. Alpha Tracker" },
                  { id: "x-tracker", title: "7. X Tracker" },
                  { id: "leverage", title: "8. Leverage Trading" },
                  { id: "fee-architecture", title: "9. Fee Architecture" },
                  { id: "infrastructure", title: "10. Infrastructure & Security" },
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

              {/* Section 1 — Platform Overview */}
              <section id="overview">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  1. Platform Overview
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {BRAND.name} is a multi-chain AI trading terminal operating on <strong className="text-foreground">Solana</strong> and <strong className="text-foreground">BNB Chain</strong>. It combines real-time market data, autonomous AI trading agents, a dual-chain token launchpad, smart-money tracking, and KOL monitoring into a single high-performance interface built for speed and precision.
                </p>
                 <p className="text-muted-foreground leading-relaxed mb-4">
                   The platform token is <strong className="text-success">$MOON</strong>, which powers governance, fee distribution, and ecosystem incentives.
                 </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Core Features</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Pulse Trading Terminal:</strong> Real-time token discovery across Solana and BNB Chain with new pairs, final stretch, and migrated token views</li>
                  <li><strong className="text-foreground">Token Launchpad:</strong> Launch tokens on Solana (Meteora DBC) or BNB Chain (SaturnPortal bonding curve) with multiple creation modes</li>
                  <li><strong className="text-foreground">Tokens &amp; Discover:</strong> Browse, search, and discover trending tokens via DexScreener integration across both chains</li>
                  <li><strong className="text-foreground">AI Trading Agents:</strong> Autonomous agents with Guard, Core, and Alpha strategies that trade on your behalf</li>
                  <li><strong className="text-foreground">Alpha Tracker:</strong> Track smart-money wallets and copy-trade winning positions in real-time</li>
                  <li><strong className="text-foreground">X Tracker:</strong> Monitor KOL mentions and sentiment from Twitter/X for early signals</li>
                  <li><strong className="text-foreground">Leverage Trading:</strong> Amplified exposure via Aster DEX on BNB Chain with built-in risk management</li>
                  <li><strong className="text-foreground">Merch Store:</strong> Official {BRAND.name} merchandise available directly within the platform</li>
                </ul>
              </section>

              {/* Section 2 — Pulse Trading Terminal */}
              <section id="trading-terminal">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  2. Pulse Trading Terminal
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The {BRAND.name} Pulse terminal provides a 3-column real-time grid showing token lifecycle stages across Solana and BNB Chain. Users can toggle between chains to view chain-specific markets.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Terminal Columns</h3>
                <div className="space-y-4">
                  {[
                    { mode: "New Pairs", desc: "Freshly launched tokens — catch tokens at their earliest stage with bonding curve pricing on either chain." },
                    { mode: "Final Stretch", desc: "Tokens approaching graduation threshold — high momentum plays ready to migrate to full AMM liquidity." },
                    { mode: "Migrated", desc: "Graduated tokens trading on Meteora CP-AMM (Solana) or PancakeSwap (BNB) with permanent locked liquidity." },
                  ].map((item) => (
                    <Card key={item.mode} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground">{item.mode}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Trade Execution by Chain</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-foreground">Component</th>
                        <th className="text-left py-2 px-2 text-foreground">Solana</th>
                        <th className="text-left py-2 px-2 text-foreground">BNB Chain</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Swap Router</td>
                        <td className="py-2 px-2">Jupiter V6 API</td>
                        <td className="py-2 px-2">OpenOcean Aggregator</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">MEV Protection</td>
                        <td className="py-2 px-2">Jito Block Engine</td>
                        <td className="py-2 px-2">—</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Data Feed</td>
                        <td className="py-2 px-2">Codex + DexScreener</td>
                        <td className="py-2 px-2">DexScreener (BSC)</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Default Slippage</td>
                        <td className="py-2 px-2">5% (configurable)</td>
                        <td className="py-2 px-2">5% (configurable)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2">Wallet</td>
                        <td className="py-2 px-2">Privy Embedded + Phantom</td>
                        <td className="py-2 px-2">Privy Embedded + MetaMask</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Section 3 — Token Launchpad */}
              <section id="token-launchpad">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  3. Token Launchpad
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  {BRAND.name} supports token launches on both Solana and BNB Chain. Each chain uses its own bonding curve infrastructure, with shared creation modes across the UI.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Launch Modes</h3>
                <div className="space-y-4">
                  {[
                    { mode: "Random Mode", desc: "AI-generated narrative-driven token concepts with procedurally generated meme images." },
                    { mode: "Describe Mode", desc: "Prompt-to-asset generation — describe your concept and AI generates the complete token package." },
                    { mode: "Custom Mode", desc: "Manual metadata entry with custom image upload (name, ticker, description, image, social links)." },
                    { mode: "Phantom Mode", desc: "User-paid launches via connected wallet with configurable trading fees (0.1% to 10%)." },
                  ].map((item) => (
                    <Card key={item.mode} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground">{item.mode}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Solana — Meteora Dynamic Bonding Curve</h3>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {[
                    { label: "Total Supply", value: "1,000,000,000 tokens" },
                    { label: "Bonding Curve", value: "800M tokens (80%)" },
                    { label: "LP Reserve", value: "200M tokens (20%)" },
                    { label: "Initial Virtual SOL", value: "30 SOL" },
                    { label: "Graduation Threshold", value: "85 SOL" },
                    { label: "Post-Graduation DEX", value: "Meteora CP-AMM (DAMM V2)" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-2 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed mt-4 text-sm">
                  When a Solana token reaches 85 SOL, it graduates to Meteora CP-AMM. 100% of LP tokens are permanently locked, and trading fees continue via Position NFT.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">BNB Chain — SaturnPortal Bonding Curve</h3>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  {[
                    { label: "Total Supply", value: "1,000,000,000 tokens" },
                    { label: "Contract", value: "Flap.sh Portal (0xe2cE…9De0)" },
                    { label: "Graduation Threshold", value: "~16 BNB" },
                    { label: "Post-Graduation DEX", value: "PancakeSwap" },
                    { label: "Token Standard", value: "BEP-20" },
                    { label: "Address Format", value: "CREATE2 salt (ends 7777)" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-2 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed mt-4 text-sm">
                  BNB Chain tokens use the SaturnPortal bonding curve with a Split Vault mechanism for automatic fee distribution. Metadata is uploaded to IPFS. Token addresses are salt-ground to end in <code className="text-success">7777</code> for tax compliance.
                </p>
              </section>

              {/* Section 4 — Tokens & Discover */}
              <section id="tokens-discover">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  4. Tokens &amp; Discover
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The Tokens page provides a comprehensive browser for all tokens launched through {BRAND.name}, with real-time price data, market cap, holder counts, and bonding progress. The Discover page surfaces trending tokens from DexScreener across both Solana and BNB Chain.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { feature: "Token Browser", desc: "Search, filter, and sort all platform-launched tokens with live pricing and bonding curve progress" },
                    { feature: "Trending Tokens", desc: "DexScreener-powered trending feed for Solana and BNB Chain with volume, price change, and liquidity metrics" },
                    { feature: "Chain Toggle", desc: "Seamlessly switch between Solana and BSC networks to view chain-specific trending data" },
                    { feature: "Quick Trade", desc: "One-click navigation to trade any discovered token directly from the browser" },
                  ].map((item) => (
                    <Card key={item.feature} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground text-sm">{item.feature}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Section 5 — AI Trading Agents */}
              <section id="ai-agents">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  5. AI Trading Agents
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-6">
                  {BRAND.name} features autonomous AI trading agents that trade Solana tokens on your behalf. Each agent manages an encrypted wallet (AES-256-GCM), launches its own token, and funds operations through accumulated fees.
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
                        <td className="py-2 px-2 text-success">Guard (Conservative)</td>
                        <td className="py-2 px-2">-10%</td>
                        <td className="py-2 px-2">+25%</td>
                        <td className="py-2 px-2">2</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-warning">Core (Balanced)</td>
                        <td className="py-2 px-2">-20%</td>
                        <td className="py-2 px-2">+50%</td>
                        <td className="py-2 px-2">3</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2 text-destructive">Alpha (Aggressive)</td>
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

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Voice Fingerprinting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Agents learn their creator's communication style by analyzing recent tweets. The system extracts tone, vocabulary, emoji usage, and sentence structure to generate a unique personality profile for autonomous social posting.
                </p>
              </section>

              {/* Section 6 — Alpha Tracker */}
              <section id="alpha-tracker">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  6. Alpha Tracker
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The Alpha Tracker monitors smart-money wallets across Solana and BNB Chain in real-time, surfacing profitable trades and allowing users to follow high-performing traders. Chain-specific block explorer links (Solscan / BscScan) are provided for full transparency.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { feature: "Real-Time Trades", desc: "Live feed of buy/sell transactions from tracked wallets with SOL/BNB amounts and token details" },
                    { feature: "PnL Tracking", desc: "Per-wallet and per-position realized PnL calculation with distribution charts" },
                    { feature: "Position Summary", desc: "Active, partial, and closed positions with cost basis and return metrics" },
                    { feature: "On-Chain Verification", desc: "All trades verified via Helius (Solana) and Alchemy (BNB) with transaction signature links" },
                  ].map((item) => (
                    <Card key={item.feature} className="p-4 bg-card/50">
                      <h4 className="font-semibold text-foreground text-sm">{item.feature}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Section 7 — X Tracker */}
              <section id="x-tracker">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  7. X Tracker
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  The X Tracker aggregates KOL (Key Opinion Leader) mentions from Twitter/X, providing early signal detection for trending tokens before they hit mainstream awareness.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { feature: "KOL Monitoring", desc: "Tracks mentions from verified crypto influencers and analysts across both ecosystems" },
                    { feature: "Sentiment Analysis", desc: "AI-powered sentiment scoring to gauge market mood around specific tokens" },
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

              {/* Section 8 — Leverage Trading */}
              <section id="leverage">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  8. Leverage Trading
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-4">
                  {BRAND.name} provides leverage trading via <strong className="text-foreground">Aster DEX</strong> on BNB Chain, enabling amplified exposure with built-in risk management for perpetual contract trading.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: "Protocol", value: "Aster DEX (BNB Chain)" },
                    { label: "Type", value: "Perpetual Contracts" },
                    { label: "Collateral", value: "BNB / USDT" },
                    { label: "Risk Management", value: "Built-in liquidation engine" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-3 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 9 — Fee Architecture */}
              <section id="fee-architecture">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  9. Fee Architecture
                </h2>

                <p className="text-muted-foreground leading-relaxed mb-6">
                  {BRAND.name} implements transparent fee models on both chains, with trading fees routed through platform infrastructure for controlled redistribution to creators.
                </p>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Solana Fee Structure</h3>
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
                        <td className="py-3 px-2 text-success">50%</td>
                        <td className="py-3 px-2">50%</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-2">Phantom Mode</td>
                        <td className="py-3 px-2">0.1–10%</td>
                        <td className="py-3 px-2 text-success">50%</td>
                        <td className="py-3 px-2">50%</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-3 px-2">Agent Token</td>
                        <td className="py-3 px-2">2%</td>
                        <td className="py-3 px-2 text-success">30% Creator / 30% Agent</td>
                        <td className="py-3 px-2">40%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">BNB Chain Fee Structure — Split Vault</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  BNB Chain uses a <strong className="text-foreground">Split Vault</strong> mechanism (factory <code className="text-success">0xfab7…345F</code>) that automatically distributes fees on each trade:
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: "Platform Fee", value: "1% (to treasury)" },
                    { label: "Creator Fee", value: "Up to 8% (configurable)" },
                    { label: "Treasury Wallet", value: "0xf621…1E37" },
                    { label: "Distribution", value: "Automatic per-trade" },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-sm p-3 bg-card/30 rounded">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section 10 — Infrastructure & Security */}
              <section id="infrastructure">
                <h2 className="text-2xl font-bold text-foreground border-b border-border pb-3 mb-6">
                  10. Infrastructure &amp; Security
                </h2>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Dual-Chain Tech Stack</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-foreground">Component</th>
                        <th className="text-left py-2 px-2 text-foreground">Solana</th>
                        <th className="text-left py-2 px-2 text-foreground">BNB Chain</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">RPC Provider</td>
                        <td className="py-2 px-2">Helius (dedicated)</td>
                        <td className="py-2 px-2">Alchemy (primary)</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Token Standard</td>
                        <td className="py-2 px-2">SPL Token + Metaplex</td>
                        <td className="py-2 px-2">BEP-20</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">DEX</td>
                        <td className="py-2 px-2">Meteora DBC → CP-AMM</td>
                        <td className="py-2 px-2">SaturnPortal → PancakeSwap</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Swap Aggregator</td>
                        <td className="py-2 px-2">Jupiter V6</td>
                        <td className="py-2 px-2">OpenOcean</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2">Explorer</td>
                        <td className="py-2 px-2">Solscan</td>
                        <td className="py-2 px-2">BscScan</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2">Metadata Storage</td>
                        <td className="py-2 px-2">Metaplex / Arweave</td>
                        <td className="py-2 px-2">IPFS</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Shared Infrastructure</h3>
                <div className="space-y-3 mt-4">
                  {[
                    { label: "Frontend", value: "React + Vite + Tailwind CSS" },
                    { label: "Backend", value: "Edge Functions (serverless)" },
                    { label: "Auth", value: "Privy (embedded wallets + social login)" },
                    { label: "Real-Time", value: "WebSockets + Realtime subscriptions" },
                    { label: "Database", value: "PostgreSQL with Row-Level Security" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-card/30 rounded-lg">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Wallet Security</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Trading Agent Wallets:</strong> AES-256-GCM encryption via Web Crypto API</li>
                  <li><strong className="text-foreground">Deployer Wallets:</strong> Fresh keypair per token, never reused</li>
                  <li><strong className="text-foreground">Treasury:</strong> Private keys isolated in Edge Functions, never client-side</li>
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
                        <td className="py-2 px-2">Wallet connection, sessions, social login</td>
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
              </section>

              {/* Appendix — Links */}
              <section className="border-t border-border pt-8 mt-12">
                <h2 className="text-2xl font-bold text-foreground mb-6">Links</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {[
                    { label: "Platform", url: `https://${BRAND.domain}` },
                    { label: "Launchpad", url: `https://${BRAND.domain}/launchpad` },
                    { label: "Agents", url: `https://${BRAND.domain}/agents` },
                    { label: "Tokens", url: `https://${BRAND.domain}/tokens` },
                    { label: "Discover", url: `https://${BRAND.domain}/discover` },
                    { label: "Twitter / X", url: BRAND.twitterUrl },
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
                <p className="mt-2">© 2026 {BRAND.name}. All rights reserved.</p>
              </div>
            </div>
          </MatrixContentCard>
        </main>

        <Footer />
      </div>
    </div>
  );
}
