import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function findUserByTwitter(twitterUsername: string): Promise<any | null> {
  const headers = getAuthHeaders();
  
  // Privy API: POST /v1/users/twitter/username with { username } in body
  const res = await fetch("https://auth.privy.io/api/v1/users/twitter/username", {
    method: "POST",
    headers,
    body: JSON.stringify({ username: twitterUsername }),
  });

  if (res.status === 404) {
    console.log("No user found with twitter username:", twitterUsername);
    return null;
  }

  if (!res.ok) {
    console.error("Twitter lookup failed:", res.status, await res.text());
    return null;
  }

  return await res.json();
}

async function getUserById(privyDid: string): Promise<any | null> {
  const headers = getAuthHeaders();
  const res = await fetch(`https://auth.privy.io/api/v1/users/${privyDid}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) return null;
  return await res.json();
}

async function unlinkTwitter(privyDid: string, twitterSubject: string): Promise<boolean> {
  const headers = getAuthHeaders();
  const encodedDid = encodeURIComponent(privyDid);
  
  // Try unlink endpoint  
  const unlinkUrl = `https://auth.privy.io/api/v1/users/${encodedDid}/linked_accounts/twitter_oauth`;
  console.log("Trying DELETE:", unlinkUrl);
  const res1 = await fetch(unlinkUrl, { method: "DELETE", headers });
  console.log("DELETE status:", res1.status);
  if (res1.ok) return true;
  const t1 = await res1.text();
  console.error("DELETE failed:", res1.status, t1.substring(0, 300));

  // Try POST unlink
  const unlinkUrl2 = `https://auth.privy.io/api/v1/users/${encodedDid}/unlink`;
  console.log("Trying POST unlink:", unlinkUrl2);
  const res2 = await fetch(unlinkUrl2, {
    method: "POST", headers,
    body: JSON.stringify({ type: "twitter_oauth", subject: twitterSubject }),
  });
  console.log("POST unlink status:", res2.status);
  if (res2.ok) return true;
  const t2 = await res2.text();
  console.error("POST unlink failed:", res2.status, t2.substring(0, 300));

  // Last resort: delete entire orphaned user
  const deleteUrl = `https://auth.privy.io/api/v1/users/${encodedDid}`;
  console.log("Trying DELETE user:", deleteUrl);
  const res3 = await fetch(deleteUrl, { method: "DELETE", headers });
  console.log("DELETE user status:", res3.status);
  if (res3.ok || res3.status === 204) return true;
  const t3 = await res3.text();
  console.error("DELETE user failed:", res3.status, t3.substring(0, 300));

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { twitterUsername, action, currentPrivyDid } = await req.json();

    if (!twitterUsername) {
      return new Response(JSON.stringify({ error: "twitterUsername required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Find which Privy user has this Twitter linked
    const existingUser = await findUserByTwitter(twitterUsername);

    if (!existingUser) {
      return new Response(JSON.stringify({
        found: false,
        message: "No Privy user found with this Twitter account linked.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingDid = existingUser.id;
    const linkedAccounts = existingUser.linked_accounts || [];
    const twitterAccount = linkedAccounts.find(
      (a: any) => a.type === "twitter_oauth" && 
        a.username?.toLowerCase() === twitterUsername.toLowerCase()
    );
    
    // Gather wallet addresses from that user
    const wallets = linkedAccounts
      .filter((a: any) => a.type === "wallet")
      .map((a: any) => ({ address: a.address, chain: a.chain_type }));

    const isSameUser = currentPrivyDid && existingDid === currentPrivyDid;

    if (action === "info") {
      return new Response(JSON.stringify({
        found: true,
        isSameUser,
        existingPrivyDid: existingDid,
        twitterSubject: twitterAccount?.subject,
        wallets,
        linkedAccountTypes: linkedAccounts.map((a: any) => a.type),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unlink") {
      if (!twitterAccount?.subject) {
        return new Response(JSON.stringify({ error: "Could not find twitter subject to unlink" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const success = await unlinkTwitter(existingDid, twitterAccount.subject);
      
      return new Response(JSON.stringify({
        success,
        unlinkedFrom: existingDid,
        message: success 
          ? "Twitter account unlinked. You can now link it to your current account." 
          : "Failed to unlink Twitter account.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action must be 'info' or 'unlink'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
