import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known Jito tip accounts
const JITO_TIP_ACCOUNTS = new Set([
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4bVqkfRtQ7NmXwkihtCxAB3",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUC67HyGp6cUCExXADiaZHboqquPb4uWvsA",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiDuGET1PmJRK6mBHgn3daSruAraEeyG1gG",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
]);

interface AnalyzeRequest {
  signatures: string[];
  save?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    if (!HELIUS_API_KEY) throw new Error("HELIUS_API_KEY not configured");

    const { signatures, save } = (await req.json()) as AnalyzeRequest;
    if (!signatures?.length) {
      return new Response(JSON.stringify({ error: "No signatures provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch enhanced transactions from Helius
    const heliusRes = await fetch(
      `https://api.helius.xyz/v0/transactions?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: signatures }),
      }
    );

    if (!heliusRes.ok) {
      const errText = await heliusRes.text();
      throw new Error(`Helius API error [${heliusRes.status}]: ${errText}`);
    }

    const transactions = await heliusRes.json();

    // Process each transaction
    const processed = transactions.map((tx: any) => {
      const jitoTips = (tx.nativeTransfers || [])
        .filter((t: any) => JITO_TIP_ACCOUNTS.has(t.toUserAccount))
        .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

      const totalNativeFee = (tx.fee || 0) / 1e9; // lamports to SOL
      const jitoTipSol = jitoTips / 1e9;

      return {
        signature: tx.signature,
        slot: tx.slot,
        timestamp: tx.timestamp,
        feePayer: tx.feePayer,
        fee: totalNativeFee,
        jitoTip: jitoTipSol,
        type: tx.type,
        source: tx.source,
        tokenTransfers: tx.tokenTransfers || [],
        nativeTransfers: tx.nativeTransfers || [],
        accountData: tx.accountData || [],
        description: tx.description || "",
      };
    });

    // Sandwich detection if 3 signatures provided
    let sandwich = null;
    if (processed.length >= 3) {
      // Sort by slot then by index within block (we use the order from Helius which is chronological)
      const sorted = [...processed].sort(
        (a: any, b: any) => (a.slot - b.slot) || (a.timestamp - b.timestamp)
      );

      const frontrun = sorted[0];
      const victim = sorted[1];
      const backrun = sorted[2];

      // Check if same slot or adjacent slots
      const slotSpread = Math.abs(backrun.slot - frontrun.slot);
      const isSameSlot = slotSpread <= 1;

      // Find common token mint
      const allMints = new Set<string>();
      for (const tx of sorted) {
        for (const tt of tx.tokenTransfers) {
          allMints.add(tt.mint);
        }
      }

      // For each common mint, calculate sandwich metrics
      let commonMint = "";
      let botBuyAmount = 0;
      let botBuySol = 0;
      let victimBuyAmount = 0;
      let victimBuySol = 0;
      let botSellAmount = 0;
      let botSellSol = 0;

      for (const mint of allMints) {
        const frontTransfers = frontrun.tokenTransfers.filter(
          (t: any) => t.mint === mint
        );
        const victimTransfers = victim.tokenTransfers.filter(
          (t: any) => t.mint === mint
        );
        const backTransfers = backrun.tokenTransfers.filter(
          (t: any) => t.mint === mint
        );

        if (
          frontTransfers.length > 0 &&
          victimTransfers.length > 0 &&
          backTransfers.length > 0
        ) {
          commonMint = mint;

          // Bot buys in frontrun (receives tokens)
          for (const t of frontTransfers) {
            if (t.toUserAccount === frontrun.feePayer) {
              botBuyAmount += t.tokenAmount || 0;
            }
          }

          // Victim buys (receives tokens)
          for (const t of victimTransfers) {
            if (t.toUserAccount === victim.feePayer) {
              victimBuyAmount += t.tokenAmount || 0;
            }
          }

          // Bot sells in backrun (sends tokens)
          for (const t of backTransfers) {
            if (t.fromUserAccount === backrun.feePayer) {
              botSellAmount += t.tokenAmount || 0;
            }
          }
          break;
        }
      }

      // Calculate SOL flows from native transfers
      for (const nt of frontrun.nativeTransfers) {
        if (
          nt.fromUserAccount === frontrun.feePayer &&
          !JITO_TIP_ACCOUNTS.has(nt.toUserAccount)
        ) {
          botBuySol += (nt.amount || 0) / 1e9;
        }
      }
      for (const nt of victim.nativeTransfers) {
        if (
          nt.fromUserAccount === victim.feePayer &&
          !JITO_TIP_ACCOUNTS.has(nt.toUserAccount)
        ) {
          victimBuySol += (nt.amount || 0) / 1e9;
        }
      }
      for (const nt of backrun.nativeTransfers) {
        if (
          nt.toUserAccount === backrun.feePayer
        ) {
          botSellSol += (nt.amount || 0) / 1e9;
        }
      }

      const botTotalFees = frontrun.fee + backrun.fee + frontrun.jitoTip + backrun.jitoTip;
      const botProfit = botSellSol - botBuySol - botTotalFees;

      // Estimate victim loss: price impact
      const fairPrice = botBuyAmount > 0 ? botBuySol / botBuyAmount : 0;
      const victimPrice = victimBuyAmount > 0 ? victimBuySol / victimBuyAmount : 0;
      const victimLoss = victimBuyAmount > 0 ? (victimPrice - fairPrice) * victimBuyAmount : 0;

      sandwich = {
        confirmed: isSameSlot && commonMint !== "",
        slotSpread,
        commonMint,
        frontrun: {
          signature: frontrun.signature,
          slot: frontrun.slot,
          feePayer: frontrun.feePayer,
          fee: frontrun.fee,
          jitoTip: frontrun.jitoTip,
          tokensBought: botBuyAmount,
          solSpent: botBuySol,
          pricePerToken: botBuyAmount > 0 ? botBuySol / botBuyAmount : 0,
        },
        victim: {
          signature: victim.signature,
          slot: victim.slot,
          feePayer: victim.feePayer,
          fee: victim.fee,
          tokensBought: victimBuyAmount,
          solSpent: victimBuySol,
          pricePerToken: victimPrice,
        },
        backrun: {
          signature: backrun.signature,
          slot: backrun.slot,
          feePayer: backrun.feePayer,
          fee: backrun.fee,
          jitoTip: backrun.jitoTip,
          tokensSold: botSellAmount,
          solReceived: botSellSol,
          pricePerToken: botSellAmount > 0 ? botSellSol / botSellAmount : 0,
        },
        botWallet: frontrun.feePayer,
        victimWallet: victim.feePayer,
        botProfitSol: botProfit,
        victimLossSol: victimLoss,
        botTotalFees,
        botJitoTips: frontrun.jitoTip + backrun.jitoTip,
      };

      // Save to DB if requested
      if (save && sandwich.confirmed) {
        try {
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );
          await supabase.from("mev_analyses").insert({
            victim_signature: victim.signature,
            frontrun_signature: frontrun.signature,
            backrun_signature: backrun.signature,
            victim_wallet: victim.feePayer,
            bot_wallet: frontrun.feePayer,
            token_mint: commonMint,
            bot_profit_sol: botProfit,
            victim_loss_sol: victimLoss,
            bot_fees_sol: botTotalFees,
            jito_tip_sol: frontrun.jitoTip + backrun.jitoTip,
            slot: frontrun.slot,
            block_time: frontrun.timestamp
              ? new Date(frontrun.timestamp * 1000).toISOString()
              : null,
            raw_data: { frontrun, victim, backrun },
          });
        } catch (e) {
          console.error("Failed to save analysis:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ transactions: processed, sandwich }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("mev-analyze error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
