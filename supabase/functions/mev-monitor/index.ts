import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    if (!HELIUS_API_KEY) throw new Error("HELIUS_API_KEY not configured");

    const { walletAddress, limit = 50 } = await req.json();
    if (!walletAddress) {
      return new Response(JSON.stringify({ error: "walletAddress required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch transaction history for the wallet
    const historyRes = await fetch(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=${limit}`,
    );

    if (!historyRes.ok) {
      const errText = await historyRes.text();
      throw new Error(`Helius history error [${historyRes.status}]: ${errText}`);
    }

    const history = await historyRes.json();

    // Group transactions by slot to find potential sandwiches
    const slotGroups: Record<number, any[]> = {};
    for (const tx of history) {
      const slot = tx.slot;
      if (!slotGroups[slot]) slotGroups[slot] = [];
      slotGroups[slot].push(tx);
    }

    // Look for slots where user's swap is bracketed by another wallet's txs
    const potentialSandwiches: any[] = [];

    for (const [slot, txs] of Object.entries(slotGroups)) {
      if (txs.length < 2) continue;

      // Find user's swap txs in this slot
      const userTxs = txs.filter((t: any) => t.feePayer === walletAddress);
      const otherTxs = txs.filter((t: any) => t.feePayer !== walletAddress);

      if (userTxs.length === 0 || otherTxs.length === 0) continue;

      // Check if any other wallet has multiple txs in same slot (frontrun + backrun pattern)
      const otherWallets: Record<string, any[]> = {};
      for (const tx of otherTxs) {
        if (!otherWallets[tx.feePayer]) otherWallets[tx.feePayer] = [];
        otherWallets[tx.feePayer].push(tx);
      }

      for (const [botWallet, botTxs] of Object.entries(otherWallets)) {
        if (botTxs.length >= 2) {
          // Potential sandwich: bot has 2+ txs in same slot as user's swap
          for (const userTx of userTxs) {
            // Check for common token mints
            const userMints = new Set(
              (userTx.tokenTransfers || []).map((t: any) => t.mint)
            );
            const botMints = new Set(
              botTxs.flatMap((t: any) => (t.tokenTransfers || []).map((tt: any) => tt.mint))
            );

            const commonMints = [...userMints].filter((m) => botMints.has(m));

            if (commonMints.length > 0) {
              potentialSandwiches.push({
                slot: Number(slot),
                timestamp: userTx.timestamp,
                victimSignature: userTx.signature,
                botWallet,
                botSignatures: botTxs.map((t: any) => t.signature),
                commonMints,
                victimFee: (userTx.fee || 0) / 1e9,
                victimDescription: userTx.description || "",
                botDescriptions: botTxs.map((t: any) => t.description || ""),
              });
            }
          }
        }
      }
    }

    // Also check adjacent slots (slot-1 and slot+1)
    const userSlots = new Set(
      history
        .filter((t: any) => t.feePayer === walletAddress && (t.type === "SWAP" || t.source === "JUPITER" || t.source === "RAYDIUM"))
        .map((t: any) => t.slot)
    );

    for (const userSlot of userSlots) {
      for (const adjSlot of [userSlot - 1, userSlot + 1]) {
        if (slotGroups[adjSlot]) {
          const adjTxs = slotGroups[adjSlot].filter(
            (t: any) => t.feePayer !== walletAddress
          );
          const userTxsInSlot = history.filter(
            (t: any) => t.slot === userSlot && t.feePayer === walletAddress
          );

          for (const adjTx of adjTxs) {
            for (const userTx of userTxsInSlot) {
              const userMints = new Set(
                (userTx.tokenTransfers || []).map((t: any) => t.mint)
              );
              const adjMints = new Set(
                (adjTx.tokenTransfers || []).map((t: any) => t.mint)
              );
              const common = [...userMints].filter((m) => adjMints.has(m));

              if (common.length > 0) {
                const exists = potentialSandwiches.some(
                  (s) => s.victimSignature === userTx.signature && s.botWallet === adjTx.feePayer
                );
                if (!exists) {
                  potentialSandwiches.push({
                    slot: userSlot,
                    adjacentSlot: adjSlot,
                    timestamp: userTx.timestamp,
                    victimSignature: userTx.signature,
                    botWallet: adjTx.feePayer,
                    botSignatures: [adjTx.signature],
                    commonMints: common,
                    victimFee: (userTx.fee || 0) / 1e9,
                    victimDescription: userTx.description || "",
                    botDescriptions: [adjTx.description || ""],
                  });
                }
              }
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        wallet: walletAddress,
        totalTransactions: history.length,
        potentialSandwiches,
        sandwichCount: potentialSandwiches.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("mev-monitor error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
