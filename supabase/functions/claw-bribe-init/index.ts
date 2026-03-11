import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY");
    if (!API_ENCRYPTION_KEY) throw new Error("API_ENCRYPTION_KEY not configured");

    const { parentAgentId, briberWallet } = await req.json();
    if (!parentAgentId || !briberWallet) {
      throw new Error("parentAgentId and briberWallet are required");
    }

    // Verify parent agent exists
    const { data: parentAgent, error: paError } = await supabase
      .from("claw_agents")
      .select("id, name")
      .eq("id", parentAgentId)
      .eq("status", "active")
      .single();

    if (paError || !parentAgent) throw new Error("Agent not found or inactive");

    // Generate bribe payment wallet
    const bribeWallet = Keypair.generate();
    const bribeWalletAddress = bribeWallet.publicKey.toBase58();
    const bribeWalletPrivateKey = bs58.encode(bribeWallet.secretKey);
    const encrypted = await aesEncrypt(bribeWalletPrivateKey, API_ENCRYPTION_KEY);

    // Create bribe record
    const { data: bribe, error: bError } = await supabase
      .from("claw_bribes")
      .insert({
        briber_wallet: briberWallet,
        parent_agent_id: parentAgentId,
        bribe_wallet_address: bribeWalletAddress,
        bribe_wallet_private_key_encrypted: encrypted,
        bribe_amount_sol: 0.5,
        status: "pending",
      })
      .select()
      .single();

    if (bError) throw bError;

    console.log(`[saturn-bribe-init] Created bribe ${bribe.id} for agent ${parentAgent.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        bribeId: bribe.id,
        walletAddress: bribeWalletAddress,
        amountSol: 0.5,
        parentAgent: { id: parentAgent.id, name: parentAgent.name },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-bribe-init] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function aesEncrypt(plaintext: string, keyString: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const keyHash = await crypto.subtle.digest("SHA-256", keyData);
  const key = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintextBytes = encoder.encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintextBytes);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}
