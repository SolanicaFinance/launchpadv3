import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("update-profile received:", JSON.stringify(body));
    
    const { privyUserId, display_name, bio, location, website, avatar_url, cover_url, username, username_changed_at } = body;

    if (!privyUserId) {
      console.error("Missing privyUserId");
      return new Response(
        JSON.stringify({ error: "privyUserId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = await privyUserIdToUuid(privyUserId);
    console.log("Resolved profileId:", profileId);
    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    if (website !== undefined) updates.website = website;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (cover_url !== undefined) updates.cover_url = cover_url;
    if (username !== undefined) updates.username = username;
    if (username_changed_at !== undefined) updates.username_changed_at = username_changed_at;

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No fields to update" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Attempting update with:", JSON.stringify(updates));

    // Use upsert so new profiles are created if they don't exist yet
    const { data, error: updateError } = await supabase
      .from("profiles")
      .upsert({ id: profileId, ...updates }, { onConflict: "id" })
      .select()
      .single();

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Update successful, profile:", JSON.stringify(data));

    return new Response(
      JSON.stringify({ success: true, profile: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in update-profile:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
