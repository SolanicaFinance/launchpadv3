

# Fix Privy Authorization Signature for Server-Send

## Problem
Privy now requires a `privy-authorization-signature` header on all wallet RPC calls (`/v1/wallets/{id}/rpc`). This is an ECDSA P-256 signature over a canonicalized JSON payload.

## Step 1: Add the Secret
I'll prompt you to enter your `PRIVY_AUTHORIZATION_KEY` (the `wallet-auth:...` private key you got from the Privy Dashboard).

## Step 2: Update `supabase/functions/_shared/privy-server-wallet.ts`

Based on the official Privy docs, I'll add:

1. **RFC 8785 JSON canonicalization** — a simple recursive key-sorting function (no npm dependency needed in Deno)
2. **`getAuthorizationSignature(url, body)`** function that:
   - Builds the payload: `{ version: 1, method: "POST", url, body, headers: { "privy-app-id": appId } }`
   - Canonicalizes it
   - Strips the `wallet-auth:` prefix from the key
   - Converts the base64 private key to PEM format
   - Signs with ECDSA P-256 + SHA-256 using Deno's `crypto.subtle` (importing the PKCS8 key)
   - Returns base64 signature
3. **Update `signAndSendTransaction` and `signTransaction`** to include `"privy-authorization-signature"` header on the fetch call

## Step 3: Deploy
Redeploy `server-send` edge function.

## Technical Detail: Signing Implementation (Deno/Web Crypto)

```typescript
// Strip prefix, convert to PKCS8 DER
const privKeyBase64 = PRIVY_AUTHORIZATION_KEY.replace('wallet-auth:', '');
const privKeyDer = Uint8Array.from(atob(privKeyBase64), c => c.charCodeAt(0));

// Import as ECDSA P-256 key
const key = await crypto.subtle.importKey(
  "pkcs8", privKeyDer, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
);

// Sign canonicalized payload
const sig = await crypto.subtle.sign(
  { name: "ECDSA", hash: "SHA-256" }, key, payloadBytes
);
return btoa(String.fromCharCode(...new Uint8Array(sig)));
```

This matches the Privy docs exactly: ECDSA P-256 + SHA-256 over RFC 8785 canonicalized JSON, base64-encoded.

