import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getPrivyUser, findSolanaEmbeddedWallet } from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-forwarded-for, x-real-ip",
};

const UUID_V5_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error("Invalid UUID");

  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  // Create a fresh ArrayBuffer copy to satisfy strict TS typing for crypto.subtle.digest
  const ab = new ArrayBuffer(data.byteLength);
  new Uint8Array(ab).set(data);
  const digest = await crypto.subtle.digest("SHA-1", ab);
  return new Uint8Array(digest);
}

async function uuidV5(name: string, namespaceUuid: string): Promise<string> {
  const ns = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);

  const toHash = new Uint8Array(ns.length + nameBytes.length);
  toHash.set(ns, 0);
  toHash.set(nameBytes, ns.length);

  const hash = await sha1(toHash);
  const bytes = hash.slice(0, 16);

  // Version 5
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Variant RFC4122
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

async function privyUserIdToUuid(privyUserId: string): Promise<string> {
  return uuidV5(privyUserId, UUID_V5_NAMESPACE_DNS);
}

// Extract client IP from request headers
function getClientIp(req: Request): string | null {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;
  
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { privyUserId, solanaWalletAddress, evmWalletAddress, email, twitterUsername, displayName, avatarUrl } = await req.json();

    if (!privyUserId) {
      return new Response(
        JSON.stringify({ error: "privyUserId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = await privyUserIdToUuid(privyUserId);

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get client IP and user agent
    const clientIp = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || null;

    console.log(`Sync request for user ${profileId} from IP: ${clientIp}`);

    // Check if user is banned
    const { data: userBan } = await supabase
      .from("user_bans")
      .select("id, reason")
      .eq("user_id", profileId)
      .is("expires_at", null)
      .maybeSingle();

    if (userBan) {
      console.log(`User ${profileId} is banned: ${userBan.reason}`);
      return new Response(
        JSON.stringify({ error: "banned", reason: userBan.reason || "Account suspended" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if IP is banned
    if (clientIp) {
      const { data: ipBan } = await supabase
        .from("ip_bans")
        .select("id, reason")
        .eq("ip_address", clientIp)
        .maybeSingle();

      // Also check for unexpired bans
      if (!ipBan) {
        const { data: activeIpBan } = await supabase
          .from("ip_bans")
          .select("id, reason")
          .eq("ip_address", clientIp)
          .or("expires_at.is.null,expires_at.gt.now()")
          .maybeSingle();
        
        if (activeIpBan) {
          console.log(`IP ${clientIp} is banned: ${activeIpBan.reason}`);
          return new Response(
            JSON.stringify({ error: "ip_banned", reason: activeIpBan.reason || "Access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        console.log(`IP ${clientIp} is banned: ${ipBan.reason}`);
        return new Response(
          JSON.stringify({ error: "ip_banned", reason: ipBan.reason || "Access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Log the IP address for this user
    if (clientIp) {
      const { error: ipLogError } = await supabase
        .from("user_ip_logs")
        .upsert(
          {
            user_id: profileId,
            ip_address: clientIp,
            user_agent: userAgent,
            last_seen_at: new Date().toISOString(),
            request_count: 1,
          },
          {
            onConflict: "user_id,ip_address",
          }
        );

      if (ipLogError) {
        console.error("Error logging IP:", ipLogError);
      } else {
        // Update request count and last_seen_at for existing records
        await supabase
          .from("user_ip_logs")
          .update({ 
            last_seen_at: new Date().toISOString(),
            request_count: 1 // Will be incremented by trigger if needed
          })
          .eq("user_id", profileId)
          .eq("ip_address", clientIp);
      }
    }

    // Generate username from available data
    const username = twitterUsername ?? email?.split("@")[0] ?? `user_${profileId.slice(-8)}`;
    const name = displayName ?? username;

    // Fetch Privy wallet ID for server-side signing
    let privyWalletId: string | null = null;
    try {
      const privyUser = await getPrivyUser(privyUserId);
      const embeddedWallet = findSolanaEmbeddedWallet(privyUser);
      if (embeddedWallet) {
        privyWalletId = embeddedWallet.walletId;
        console.log(`Resolved Privy wallet ID: ${privyWalletId} for user ${profileId}`);
      }
    } catch (e) {
      console.warn(`Could not fetch Privy wallet ID: ${e instanceof Error ? e.message : e}`);
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, solana_wallet_address, evm_wallet_address, privy_wallet_id, privy_did")
      .eq("id", profileId)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile
      const updates: Record<string, unknown> = {};

      if (solanaWalletAddress && existingProfile.solana_wallet_address !== solanaWalletAddress) {
        updates.solana_wallet_address = solanaWalletAddress;
      }
      if (evmWalletAddress && existingProfile.evm_wallet_address !== evmWalletAddress) {
        updates.evm_wallet_address = evmWalletAddress;
      }
      if (avatarUrl) updates.avatar_url = avatarUrl;
      if (privyWalletId && existingProfile.privy_wallet_id !== privyWalletId) {
        updates.privy_wallet_id = privyWalletId;
      }
      if (!existingProfile.privy_did) {
        updates.privy_did = privyUserId;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", profileId);

        if (updateError) {
          console.error("Error updating profile:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: "updated", profileId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: profileId,
          username,
          display_name: name,
          avatar_url: avatarUrl,
          solana_wallet_address: solanaWalletAddress,
          evm_wallet_address: evmWalletAddress,
          privy_wallet_id: privyWalletId,
          privy_did: privyUserId,
        });

      if (insertError) {
        console.error("Error creating profile:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, action: "created", profileId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in sync-privy-user:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
