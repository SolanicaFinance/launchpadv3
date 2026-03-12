const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TokenAccount {
  mint: string;
  balance: number;
  decimals: number;
}

async function getTokenAccounts(
  rpcUrl: string,
  walletAddress: string,
  programId: string
): Promise<TokenAccount[]> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getTokenAccountsByOwner",
    params: [
      walletAddress,
      { programId },
      { encoding: "jsonParsed" },
    ],
  };

  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`RPC error for ${programId}:`, text);
    return [];
  }

  const json = await res.json();
  const accounts = json?.result?.value ?? [];

  return accounts
    .map((acc: any) => {
      const info = acc?.account?.data?.parsed?.info;
      if (!info) return null;
      const amount = Number(info.tokenAmount?.uiAmount ?? 0);
      if (amount <= 0) return null;
      return {
        mint: info.mint as string,
        balance: amount,
        decimals: Number(info.tokenAmount?.decimals ?? 0),
      };
    })
    .filter(Boolean) as TokenAccount[];
}

async function fetchHoldingsFromRpc(
  rpcUrl: string,
  walletAddress: string
): Promise<TokenAccount[]> {
  const SPL_TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

  const [splTokens, token2022Tokens] = await Promise.all([
    getTokenAccounts(rpcUrl, walletAddress, SPL_TOKEN),
    getTokenAccounts(rpcUrl, walletAddress, TOKEN_2022),
  ]);

  return [...splTokens, ...token2022Tokens];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { walletAddress } = await req.json();
    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(JSON.stringify({ error: "walletAddress required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try Alchemy first (faster, more reliable), fall back to Helius
    const alchemyUrl = (Deno.env.get("ALCHEMY_SOLANA_RPC_URL") ?? "").trim();
    const heliusUrl = (Deno.env.get("HELIUS_RPC_URL") ?? "").trim();

    let holdings: TokenAccount[] = [];
    let usedProvider = "none";

    if (alchemyUrl) {
      try {
        holdings = await fetchHoldingsFromRpc(alchemyUrl, walletAddress);
        usedProvider = "alchemy";
      } catch (e) {
        console.error("Alchemy RPC failed, falling back to Helius:", e);
      }
    }

    if (usedProvider === "none" && heliusUrl) {
      try {
        holdings = await fetchHoldingsFromRpc(heliusUrl, walletAddress);
        usedProvider = "helius";
      } catch (e) {
        console.error("Helius RPC also failed:", e);
      }
    }

    if (usedProvider === "none") {
      return new Response(JSON.stringify({ error: "No RPC configured or all providers failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ holdings }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-wallet-holdings error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to fetch holdings" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
