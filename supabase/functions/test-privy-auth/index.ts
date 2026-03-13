/**
 * Diagnostic: Test Privy authorization key validity
 * Makes a simple signed request to verify the key works.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, unknown> = {};

  try {
    // 1. Check env vars
    const appId = Deno.env.get("PRIVY_APP_ID");
    const appSecret = Deno.env.get("PRIVY_APP_SECRET");
    const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY");

    results.hasAppId = !!appId;
    results.hasAppSecret = !!appSecret;
    results.hasAuthKey = !!authKeyRaw;
    results.authKeyLength = authKeyRaw?.length || 0;
    results.authKeyPrefix = authKeyRaw?.substring(0, 20) || "";
    results.hasWalletAuthPrefix = authKeyRaw?.startsWith("wallet-auth:") || false;

    if (!appId || !appSecret) {
      results.error = "Missing PRIVY_APP_ID or PRIVY_APP_SECRET";
      return new Response(JSON.stringify(results, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Test basic API auth (no authorization signature needed for GET)
    const credentials = btoa(`${appId}:${appSecret}`);
    const testRes = await fetch("https://api.privy.io/v1/apps/current", {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        "privy-app-id": appId,
      },
    });
    results.basicAuthStatus = testRes.status;
    results.basicAuthOk = testRes.ok;
    if (!testRes.ok) {
      results.basicAuthError = await testRes.text();
    }

    // 3. Test authorization key import
    if (authKeyRaw) {
      try {
        const privateKeyAsString = authKeyRaw.replace("wallet-auth:", "").trim();
        results.strippedKeyLength = privateKeyAsString.length;

        // Decode base64
        const binaryString = atob(privateKeyAsString);
        const keyBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          keyBytes[i] = binaryString.charCodeAt(i);
        }
        results.keyBytesLength = keyBytes.length;

        // Import as ECDSA P-256
        const privateKey = await crypto.subtle.importKey(
          "pkcs8",
          keyBytes,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
        );
        results.keyImportSuccess = true;
        results.keyAlgorithm = privateKey.algorithm;

        // 4. Try a real signed request - list wallets (simple POST)
        // Use a dummy wallet ID to test just the signing
        const testUrl = `https://api.privy.io/v1/wallets`;
        const testBody = { chain_type: "solana" };

        const payload = {
          version: 1,
          method: "POST",
          url: testUrl,
          body: testBody,
          headers: {
            "privy-app-id": appId,
          },
        };

        const serialized = canonicalize(payload) as string;
        results.canonicalizedPayloadPreview = serialized.substring(0, 200);
        const payloadBuffer = new TextEncoder().encode(serialized);

        const sigBuffer = await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          privateKey,
          payloadBuffer
        );
        results.rawSignatureLength = sigBuffer.byteLength;

        // Convert P1363 to DER
        const derSig = p1363ToDer(new Uint8Array(sigBuffer));
        results.derSignatureLength = derSig.length;

        const signature = btoa(String.fromCharCode(...derSig));
        results.base64SignatureLength = signature.length;

        // Make the actual API call to test signature validity
        // POST /v1/wallets with chain_type is a "create wallet" call which
        // requires authorization. This will tell us if our signature is valid.
        const signedRes = await fetch(testUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "privy-app-id": appId,
            "Content-Type": "application/json",
            "privy-authorization-signature": signature,
          },
          body: JSON.stringify(testBody),
        });

        results.signedRequestStatus = signedRes.status;
        const signedBody = await signedRes.text();
        results.signedRequestResponse = signedBody.substring(0, 500);

        // If status is 401, our signature is bad
        // If status is 200/201, our signing works!
        // If status is 400/422, signing works but request params are wrong (which is fine)
        if (signedRes.status === 401) {
          results.diagnosis = "AUTHORIZATION_KEY_INVALID_OR_EXPIRED";
          results.action = "Generate a new authorization key in Privy Dashboard → Settings → Authorization Keys";
        } else if (signedRes.status === 200 || signedRes.status === 201) {
          results.diagnosis = "SIGNING_WORKS_PERFECTLY";
        } else {
          results.diagnosis = "SIGNING_WORKS_BUT_REQUEST_REJECTED";
          results.note = "The signature was accepted (not 401), so authorization key is valid. The error is about the request itself.";
        }

      } catch (keyErr) {
        results.keyImportSuccess = false;
        results.keyError = keyErr instanceof Error ? keyErr.message : String(keyErr);
        results.diagnosis = "KEY_FORMAT_ERROR";
      }
    }

  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err);
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
