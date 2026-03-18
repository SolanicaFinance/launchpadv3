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
  
  // Search for user by twitter subject
  const res = await fetch("https://auth.privy.io/api/v1/users/search", {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: twitterUsername,
    }),
  });

  if (!res.ok) {
    console.error("Search failed:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const users = data.data || data.users || data || [];
  
  // Find user with this twitter linked
  for (const user of (Array.isArray(users) ? users : [])) {
    const linkedAccounts = user.linked_accounts || [];
    const twitterAccount = linkedAccounts.find(
      (a: any) => a.type === "twitter_oauth" && 
        a.username?.toLowerCase() === twitterUsername.toLowerCase()
    );
    if (twitterAccount) return user;
  }
  
  return null;
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
  const res = await fetch(`https://auth.privy.io/api/v1/users/${privyDid}/linked_accounts/${twitterSubject}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    console.error("Unlink failed:", res.status, await res.text());
    return false;
  }
  return true;
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
