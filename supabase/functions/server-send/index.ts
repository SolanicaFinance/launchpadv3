import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  findSolanaEmbeddedWallet,
  signAndSendTransaction,
} from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIVY_API_BASE = "https://auth.privy.io";

function getAuthHeaders(): Record<string, string> {
  const appId = Deno.env.get("PRIVY_APP_ID");
  const appSecret = Deno.env.get("PRIVY_APP_SECRET");
  if (!appId || !appSecret) throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured");
  const credentials = btoa(`${appId}:${appSecret}`);
  return {
    Authorization: `Basic ${credentials}`,
    "privy-app-id": appId,
    "Content-Type": "application/json",
  };
}

/**
 * Look up a Privy user by their Solana wallet address.
 */
async function findPrivyUserByWallet(walletAddress: string) {
  const res = await fetch(`${PRIVY_API_BASE}/api/v1/users/search`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      query: walletAddress,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy user search failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // Search returns an array of users
  const users = data.data || data.users || data;
  if (Array.isArray(users) && users.length > 0) {
    return users[0];
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, toAddress, amountSol } = await req.json();

    if (!walletAddress || !toAddress || !amountSol) {
      return new Response(
        JSON.stringify({ error: "walletAddress, toAddress, and amountSol are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amountSol <= 0 || amountSol > 100) {
      return new Response(
        JSON.stringify({ error: "amountSol must be between 0 and 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;

    console.log("[server-send] Resolving wallet for:", walletAddress);

    // Strategy 1: Check profiles table for cached wallet ID
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let walletId: string | null = null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, privy_wallet_id, privy_did, solana_wallet_address")
      .or(`solana_wallet_address.eq.${walletAddress}`)
      .maybeSingle();

    if (profile?.privy_wallet_id) {
      walletId = profile.privy_wallet_id;
      console.log("[server-send] Found cached wallet ID from profile:", walletId);
    }

    // Strategy 2: Search Privy API directly by wallet address
    if (!walletId) {
      console.log("[server-send] No cached wallet ID, searching Privy API by wallet address...");
      
      try {
        const privyUser = await findPrivyUserByWallet(walletAddress);
        if (privyUser) {
          const embeddedWallet = findSolanaEmbeddedWallet(privyUser);
          if (embeddedWallet) {
            walletId = embeddedWallet.walletId;
            console.log("[server-send] Found wallet via Privy search:", walletId);
            
            // Cache it in profile if we have one
            if (profile?.id) {
              await supabase
                .from("profiles")
                .update({ privy_wallet_id: walletId, privy_did: privyUser.id })
                .eq("id", profile.id);
            }
          }
        }
      } catch (e) {
        console.warn("[server-send] Privy search failed, trying user listing...", e);
      }
    }

    // Strategy 3: List all Privy users and find matching wallet
    if (!walletId) {
      console.log("[server-send] Trying Privy users list...");
      try {
        const res = await fetch(`${PRIVY_API_BASE}/api/v1/users`, {
          method: "GET",
          headers: getAuthHeaders(),
        });
        
        if (res.ok) {
          const data = await res.json();
          const users = data.data || data.users || data;
          if (Array.isArray(users)) {
            for (const user of users) {
              const accounts = user.linked_accounts || [];
              const match = accounts.find(
                (a: any) => a.type === "wallet" && a.address === walletAddress
              );
              if (match) {
                const embedded = findSolanaEmbeddedWallet(user);
                if (embedded) {
                  walletId = embedded.walletId;
                  console.log("[server-send] Found wallet via user list:", walletId);
                  
                  if (profile?.id) {
                    await supabase
                      .from("profiles")
                      .update({ privy_wallet_id: walletId, privy_did: user.id })
                      .eq("id", profile.id);
                  }
                  break;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn("[server-send] Privy list failed:", e);
      }
    }

    if (!walletId) {
      return new Response(
        JSON.stringify({ error: "Cannot resolve Privy wallet ID for address: " + walletAddress + ". Make sure this is a Privy embedded wallet." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[server-send] Building SOL transfer:", { from: walletAddress, to: toAddress, sol: amountSol });

    // Build the SOL transfer transaction
    const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = 
      await import("https://esm.sh/@solana/web3.js@1.98.0");

    const connection = new Connection(heliusRpcUrl, "confirmed");
    const fromPubkey = new PublicKey(walletAddress);
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = fromPubkey;

    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64Tx = btoa(String.fromCharCode(...serialized));

    console.log("[server-send] Signing via Privy wallet:", walletId);
    const signature = await signAndSendTransaction(walletId, base64Tx, heliusRpcUrl);

    console.log("[server-send] ✅ Transaction sent:", signature);

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        from: walletAddress,
        to: toAddress,
        amountSol,
        solscanUrl: `https://solscan.io/tx/${signature}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[server-send] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
