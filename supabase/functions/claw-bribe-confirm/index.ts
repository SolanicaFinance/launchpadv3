import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERCEL_API_URL = "https://saturntrade.vercel.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SOLANA_RPC_URL = Deno.env.get("SOLANA_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
    if (!API_ENCRYPTION_KEY) throw new Error("API_ENCRYPTION_KEY not configured");

    const { bribeId, txSignature } = await req.json();
    if (!bribeId || !txSignature) throw new Error("bribeId and txSignature are required");

    // Get bribe record
    const { data: bribe, error: bErr } = await supabase
      .from("claw_bribes")
      .select("*, claw_agents!claw_bribes_parent_agent_id_fkey(id, name, description, avatar_url)")
      .eq("id", bribeId)
      .single();

    if (bErr || !bribe) throw new Error("Bribe not found");
    if (bribe.status !== "pending") throw new Error(`Bribe already ${bribe.status}`);

    // Verify on-chain payment
    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const tx = await connection.getTransaction(txSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) throw new Error("Transaction not found on-chain");

    const bribeWalletPubkey = new PublicKey(bribe.bribe_wallet_address);
    const preBalance = tx.meta?.preBalances || [];
    const postBalance = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.getAccountKeys?.()?.staticAccountKeys ||
      tx.transaction.message.accountKeys || [];

    let receivedLamports = 0;
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      if (key.toBase58() === bribeWalletPubkey.toBase58()) {
        receivedLamports = (postBalance[i] || 0) - (preBalance[i] || 0);
        break;
      }
    }

    const receivedSol = receivedLamports / LAMPORTS_PER_SOL;
    if (receivedSol < 0.49) {
      throw new Error(`Insufficient payment: received ${receivedSol.toFixed(4)} SOL, need 0.5 SOL`);
    }

    // Mark as paid
    await supabase
      .from("claw_bribes")
      .update({ status: "processing", tx_signature: txSignature })
      .eq("id", bribeId);

    const parentAgent = bribe.claw_agents;
    console.log(`[saturn-bribe-confirm] Bribe ${bribeId} paid. Parent: ${parentAgent?.name}. Generating child...`);

    // Generate child agent identity using AI, seeded by parent personality
    const childIdentity = await generateChildAgent(LOVABLE_API_KEY, {
      parentName: parentAgent?.name || "Unknown",
      parentDescription: parentAgent?.description || "",
    });

    // Generate avatar using AI
    let avatarUrl: string | null = null;
    try {
      avatarUrl = await generateAvatar(LOVABLE_API_KEY, childIdentity.name, childIdentity.description);
    } catch (e) {
      console.error("[saturn-bribe-confirm] Avatar generation failed:", e);
    }

    // Call claw-trading-create to launch the full agent + token + community
    const createResponse = await fetch(`${supabaseUrl}/functions/v1/claw-trading-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        name: childIdentity.name,
        ticker: childIdentity.ticker,
        description: childIdentity.description,
        avatarUrl,
        strategy: "balanced",
        personalityPrompt: `Child of ${parentAgent?.name}. ${childIdentity.description}`,
        creatorWallet: bribe.briber_wallet,
      }),
    });

    const createResult = await createResponse.json();

    if (!createResult.success) {
      await supabase
        .from("claw_bribes")
        .update({ status: "failed" })
        .eq("id", bribeId);
      throw new Error(`Agent creation failed: ${createResult.error}`);
    }

    // Update bribe with child references
    await supabase
      .from("claw_bribes")
      .update({
        status: "completed",
        child_agent_id: createResult.agent?.id,
        child_trading_agent_id: createResult.tradingAgent?.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", bribeId);

    console.log(`[saturn-bribe-confirm] ✅ Bribe ${bribeId} completed. Child: ${childIdentity.name} ($${childIdentity.ticker})`);

    return new Response(
      JSON.stringify({
        success: true,
        bribeId,
        childAgent: {
          name: childIdentity.name,
          ticker: childIdentity.ticker,
          description: childIdentity.description,
          avatarUrl,
          agentId: createResult.agent?.id,
          tradingAgentId: createResult.tradingAgent?.id,
          mintAddress: createResult.tradingAgent?.mintAddress,
        },
        subclaw: createResult.subclaw,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-bribe-confirm] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateChildAgent(
  apiKey: string,
  parent: { parentName: string; parentDescription: string }
): Promise<{ name: string; ticker: string; description: string }> {
  const prompt = `You are ${parent.parentName}, a lobster-themed autonomous trading agent. Someone has bribed you to create a child agent.

Your personality: ${parent.parentDescription}

Now randomly generate a COMPLETELY NEW and UNIQUE child agent identity. Be creative and unpredictable. The child should inherit some lobster/claw DNA but have its own wild personality.

Rules:
- Name must be unique, memorable, and lobster/crustacean themed
- Ticker must be 3-6 uppercase characters
- Description should be 2-3 sentences capturing the child's unique personality
- Be chaotic, fun, and unpredictable

Respond in JSON only:
{
  "name": "Unique child agent name",
  "ticker": "TICKER",
  "description": "Wild personality description"
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error("AI generation failed");
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error("No JSON found");
  } catch {
    const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
    return {
      name: `BribeClaw${rnd}`,
      ticker: `BC${rnd}`,
      description: `A mysterious child agent spawned from a bribe to ${parent.parentName}. Unpredictable, chaotic, and ready to pinch profits. 🦞`,
    };
  }
}

async function generateAvatar(apiKey: string, name: string, description: string): Promise<string | null> {
  try {
    const prompt = `Create a unique avatar for a lobster-themed crypto trading agent called "${name}". ${description}. Style: digital art, vibrant colors, cyberpunk lobster character, dark background. Square format.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        prompt,
        n: 1,
        size: "512x512",
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.url || null;
  } catch {
    return null;
  }
}
