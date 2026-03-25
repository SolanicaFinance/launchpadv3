/**
 * Shared Telegram + CAPTCHA.social notification helper for all trade/launch edge functions.
 * Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars for Telegram.
 * Uses CAPTCHA_SOCIAL_API_KEY for captcha.social auto-posting.
 */

const BOT_TOKEN_KEY = "TELEGRAM_BOT_TOKEN";
const CHAT_ID_KEY = "TELEGRAM_CHAT_ID";
const CAPTCHA_API_BASE = "https://proficient-magpie-162.convex.site/api/v1";

function shortWallet(addr?: string): string {
  if (!addr) return "Unknown";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export async function sendTelegramNotification(text: string): Promise<void> {
  const botToken = Deno.env.get(BOT_TOKEN_KEY);
  const chatId = Deno.env.get(CHAT_ID_KEY);
  if (!botToken || !chatId) {
    console.warn("[telegram-notify] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error("[telegram-notify] Send failed:", res.status, errBody);
    }
  } catch (err) {
    console.error("[telegram-notify] Error:", err);
  }
}

/** Post to captcha.social (fire-and-forget style, errors are logged not thrown) */
async function postToCaptcha(content: string): Promise<void> {
  const apiKey = Deno.env.get("CAPTCHA_SOCIAL_API_KEY");
  if (!apiKey) return;

  try {
    const res = await fetch(`${CAPTCHA_API_BASE}/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, type: "post" }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error("[captcha-notify] Post failed:", res.status, errBody);
    } else {
      console.log("[captcha-notify] ✅ Posted to CAPTCHA.social");
    }
  } catch (err) {
    console.error("[captcha-notify] Error:", err);
  }
}

// ── SOL trade notification ──
export async function notifySolTrade(params: {
  tradeType: "buy" | "sell";
  ticker: string;
  tokenName: string;
  amountSol: number;
  estimatedOutput: number;
  walletAddress: string;
  signature: string;
  mintAddress: string;
}) {
  const isBuy = params.tradeType === "buy";
  const emoji = isBuy ? "🟢" : "🔴";
  const action = isBuy ? "BUY" : "SELL";
  const sw = shortWallet(params.walletAddress);
  const label = params.ticker || params.tokenName || "SOL Token";

  const text = `${emoji} <b>${action}</b> $${label} 🟣 SOL

💰 ${params.amountSol.toFixed(4)} SOL${params.estimatedOutput ? ` → ${params.estimatedOutput.toLocaleString()} ${params.ticker || "tokens"}` : ""}
👤 ${sw}
🔗 <a href="https://solscan.io/tx/${params.signature}">View TX</a>

<a href="https://saturntrade.lovable.app/token/${params.mintAddress}">Trade on Saturn</a>`;

  await sendTelegramNotification(text);
}

// ── SOL token launch notification ──
export async function notifySolLaunch(params: {
  name: string;
  ticker: string;
  creatorWallet: string;
  mintAddress: string;
}) {
  const sw = shortWallet(params.creatorWallet);

  const text = `🚀 <b>NEW LAUNCH</b> $${params.ticker} (${params.name}) 🟣 SOL

🪙 Chain: Solana
👤 Creator: ${sw}
📋 CA: <code>${params.mintAddress}</code>

<a href="https://saturntrade.lovable.app/token/${params.mintAddress}">Trade on Saturn</a>`;

  await sendTelegramNotification(text);

  await postToCaptcha(`🚀 NEW LAUNCH: $${params.ticker} (${params.name}) on Solana!\n\nCA: ${params.mintAddress}\n\nTrade now → saturntrade.lovable.app/token/${params.mintAddress}`);
}

// ── BNB trade notification ──
export async function notifyBnbTrade(params: {
  tradeType: "buy" | "sell";
  ticker: string;
  tokenName: string;
  amountBnb: number;
  estimatedOutput: number;
  walletAddress: string;
  txHash: string;
  tokenAddress: string;
}) {
  const isBuy = params.tradeType === "buy";
  const emoji = isBuy ? "🟢" : "🔴";
  const action = isBuy ? "BUY" : "SELL";
  const sw = shortWallet(params.walletAddress);
  const label = params.ticker || params.tokenName || "BNB Token";

  const text = `${emoji} <b>${action}</b> $${label} 🟡 BNB

💰 ${params.amountBnb.toFixed(4)} BNB${params.estimatedOutput ? ` → ${params.estimatedOutput.toLocaleString()} ${params.ticker || "tokens"}` : ""}
🔗 <a href="https://bscscan.com/tx/${params.txHash}">View TX</a>
👤 ${sw}

<a href="https://saturntrade.lovable.app/trade/${params.tokenAddress}">Trade on Saturn</a>`;

  await sendTelegramNotification(text);
}

// ── BNB token launch notification ──
export async function notifyBnbLaunch(params: {
  name: string;
  ticker: string;
  creatorWallet: string;
  tokenAddress: string;
  txHash: string;
}) {
  const sw = shortWallet(params.creatorWallet);

  const text = `🚀 <b>NEW LAUNCH</b> $${params.ticker} (${params.name}) 🟡 BNB

🪙 Chain: BNB
👤 Creator: ${sw}
📋 CA: <code>${params.tokenAddress}</code>
🔗 <a href="https://bscscan.com/tx/${params.txHash}">View TX</a>

<a href="https://saturntrade.lovable.app/trade/${params.tokenAddress}">Trade on Saturn</a>`;

  await sendTelegramNotification(text);

  await postToCaptcha(`🚀 NEW LAUNCH: $${params.ticker} (${params.name}) on BNB Chain!\n\nCA: ${params.tokenAddress}\n\nTrade now → saturntrade.lovable.app/trade/${params.tokenAddress}`);
}

// ── BTC trade notification (with throttling) ──
export async function notifyBtcTrade(params: {
  tradeType: "buy" | "sell";
  ticker: string;
  tokenName: string;
  btcAmount: number;
  tokenAmount: number;
  priceBtc: number;
  realBtcReserves: number;
  walletAddress: string;
  bondingProgress: number;
  tokenId: string;
}) {
  const isBuy = params.tradeType === "buy";
  const emoji = isBuy ? "🟢" : "🔴";
  const action = isBuy ? "BUY" : "SELL";
  const sw = shortWallet(params.walletAddress);
  const label = params.ticker || params.tokenName || "BTC Token";

  // Show real BTC reserves (actual sats deposited) instead of virtual mcap
  const poolStr = params.realBtcReserves < 0.001
    ? `${(params.realBtcReserves * 1e8).toFixed(0)} sats`
    : `${params.realBtcReserves.toFixed(6)} BTC`;

  const text = `${emoji} <b>${action}</b> $${label} 🟠 BTC

💰 ${params.btcAmount.toFixed(8)} BTC → ${params.tokenAmount.toLocaleString()} ${params.ticker}
📊 Pool: ${poolStr} | Progress: ${params.bondingProgress.toFixed(1)}%
👤 ${sw}

<a href="https://saturntrade.lovable.app/btc/meme/${params.tokenId}">Trade on Saturn</a>`;

  await sendTelegramNotification(text);
}

// ── BTC token launch notification ──
export async function notifyBtcLaunch(params: {
  name: string;
  ticker: string;
  creatorWallet: string;
  tokenId: string;
}) {
  const sw = shortWallet(params.creatorWallet);

  const text = `🚀 <b>NEW LAUNCH</b> $${params.ticker} (${params.name}) 🟠 BTC

🪙 Chain: Bitcoin (TAT Protocol)
👤 Creator: ${sw}

<a href="https://saturntrade.lovable.app/btc/meme/${params.tokenId}">Trade on Saturn</a>`;

  await sendTelegramNotification(text);

  await postToCaptcha(`🚀 NEW LAUNCH: $${params.ticker} (${params.name}) on Bitcoin (TAT Protocol)!\n\nTrade now → saturntrade.lovable.app/btc/meme/${params.tokenId}`);
}
