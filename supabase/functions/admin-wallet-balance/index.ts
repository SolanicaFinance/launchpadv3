import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  getPrivyUser,
  findSolanaEmbeddedWallet,
} from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ADMIN_PASSWORD = "saturn135@";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function looksLikeSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function normalizePrivyIdentifier(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("did:privy:")) return trimmed;
  if (isUuid(trimmed)) return trimmed;
  if (looksLikeSolanaAddress(trimmed)) return trimmed;
  if (/^[a-z0-9]{10,}$/i.test(trimmed)) return `did:privy:${trimmed}`;

  return trimmed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let walletAddress: string | null = null;
    let userIdentifier: string | null = null;
    let adminPassword: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      walletAddress = url.searchParams.get("walletAddress");
      userIdentifier = url.searchParams.get("userIdentifier");
      adminPassword = url.searchParams.get("adminPassword");
    } else {
      const body = await req.json();
      walletAddress = body.walletAddress ?? null;
      userIdentifier = body.userIdentifier ?? null;
      adminPassword = body.adminPassword ?? null;
    }

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const identifier = normalizePrivyIdentifier(userIdentifier || walletAddress || "");
    if (!identifier) {
      return new Response(JSON.stringify({ error: "userIdentifier or walletAddress is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let resolvedWalletAddress: string | null = null;
    let resolvedPrivyDid: string | null = null;
    let source: "wallet" | "profile" | "privy" = "wallet";

    if (identifier.startsWith("did:privy:")) {
      resolvedPrivyDid = identifier;

      const { data: profile } = await supabase
        .from("profiles")
        .select("solana_wallet_address")
        .eq("privy_did", identifier)
        .maybeSingle();

      resolvedWalletAddress = profile?.solana_wallet_address || null;
      source = "privy";

      if (!resolvedWalletAddress) {
        const user = await getPrivyUser(identifier);
        const wallet = findSolanaEmbeddedWallet(user);
        resolvedWalletAddress = wallet?.address || null;
      }
    } else if (isUuid(identifier)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("privy_did, solana_wallet_address")
        .eq("id", identifier)
        .maybeSingle();

      resolvedWalletAddress = profile?.solana_wallet_address || null;
      resolvedPrivyDid = profile?.privy_did || null;
      source = "profile";

      if (!resolvedWalletAddress && resolvedPrivyDid) {
        const user = await getPrivyUser(resolvedPrivyDid);
        const wallet = findSolanaEmbeddedWallet(user);
        resolvedWalletAddress = wallet?.address || null;
      }
    } else {
      resolvedWalletAddress = identifier;
      source = "wallet";
    }

    if (!resolvedWalletAddress) {
      return new Response(JSON.stringify({ error: "Could not resolve wallet address from this identifier" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const balanceRes = await fetch(heliusRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [resolvedWalletAddress],
      }),
    });

    const balanceData = await balanceRes.json();
    const lamports = balanceData?.result?.value ?? 0;
    const balanceSol = lamports / 1e9;

    return new Response(
      JSON.stringify({
        balanceSol,
        walletAddress: resolvedWalletAddress,
        resolvedPrivyDid,
        source,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});