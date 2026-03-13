/**
 * Test: Try signAndSendTransaction via auth.privy.io (old embedded wallet API)
 * The old API may not enforce owner_id for embedded wallets
 */

import canonicalize from "npm:canonicalize@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function p1363ToDer(p1363: Uint8Array): Uint8Array {
  const half = p1363.length / 2;
  const r = p1363.slice(0, half);
  const s = p1363.slice(half);
  function encodeInteger(bytes: Uint8Array): Uint8Array {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    const needsPad = trimmed[0] & 0x80;
    const result = new Uint8Array((needsPad ? 1 : 0) + trimmed.length + 2);
    result[0] = 0x02;
    result[1] = trimmed.length + (needsPad ? 1 : 0);
    if (needsPad) result[2] = 0x00;
    result.set(trimmed, 2 + (needsPad ? 1 : 0));
    return result;
  }
  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  const seq = new Uint8Array(2 + rDer.length + sDer.length);
  seq[0] = 0x30;
  seq[1] = rDer.length + sDer.length;
  seq.set(rDer, 2);
  seq.set(sDer, 2 + rDer.length);
  return seq;
}

async function sign(url: string, body: Record<string, unknown>): Promise<string> {
  const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY")!;
  const appId = Deno.env.get("PRIVY_APP_ID")!;

  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: { "privy-app-id": appId },
  };

  const serialized = canonicalize(payload) as string;
  const payloadBuffer = new TextEncoder().encode(serialized);

  const privateKeyAsString = authKeyRaw.replace("wallet-auth:", "").trim();
  const binaryString = atob(privateKeyAsString);
  const keyBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBytes[i] = binaryString.charCodeAt(i);
  }

  const privateKey = await crypto.subtle.importKey(
    "pkcs8", keyBytes, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, privateKey, payloadBuffer
  );

  const derSig = p1363ToDer(new Uint8Array(sigBuffer));
  return btoa(String.fromCharCode(...derSig));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, unknown> = {};

  try {
    const { walletId } = await req.json();
    const appId = Deno.env.get("PRIVY_APP_ID")!;
    const appSecret = Deno.env.get("PRIVY_APP_SECRET")!;
    const credentials = btoa(`${appId}:${appSecret}`);
    
    // Dummy base64 tx for testing (will fail validation but tests auth)
    const dummyTx = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB=";

    // Test 1: api.privy.io - signTransaction (new API, requires owner)
    {
      const url = `https://api.privy.io/v1/wallets/${walletId}/rpc`;
      const body = { method: "signTransaction", params: { transaction: dummyTx, encoding: "base64" } };
      const sig = await sign(url, body);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "privy-app-id": appId,
          "Content-Type": "application/json",
          "privy-authorization-signature": sig,
        },
        body: JSON.stringify(body),
      });
      results.test1_api_signTransaction = { status: res.status, body: (await res.text()).substring(0, 300) };
    }

    // Test 2: api.privy.io - signAndSendTransaction (new API)
    {
      const url = `https://api.privy.io/v1/wallets/${walletId}/rpc`;
      const body = {
        method: "signAndSendTransaction",
        caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        params: { transaction: dummyTx, encoding: "base64" },
      };
      const sig = await sign(url, body);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "privy-app-id": appId,
          "Content-Type": "application/json",
          "privy-authorization-signature": sig,
        },
        body: JSON.stringify(body),
      });
      results.test2_api_signAndSend = { status: res.status, body: (await res.text()).substring(0, 300) };
    }

    // Test 3: api.privy.io - NO authorization signature (to see if embedded wallets bypass)
    {
      const url = `https://api.privy.io/v1/wallets/${walletId}/rpc`;
      const body = { method: "signTransaction", params: { transaction: dummyTx, encoding: "base64" } };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "privy-app-id": appId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      results.test3_noAuthSig = { status: res.status, body: (await res.text()).substring(0, 300) };
    }

  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
