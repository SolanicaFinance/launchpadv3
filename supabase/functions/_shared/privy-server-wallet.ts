/**
 * Privy Server Wallet Helper
 * 
 * Uses Web Crypto API (native Deno support) for ECDSA P-256 signing.
 * 
 * Docs: https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation
 */

import canonicalize from "npm:canonicalize@2.0.0";
import { createPrivateKey, sign as nodeSign } from "node:crypto";

const PRIVY_API_BASE = "https://auth.privy.io";

interface PrivyWalletAccount {
  type: string;
  address: string;
  chain_type: string;
  wallet_client: string;
  wallet_client_type: string;
  connector_type: string;
  id?: string;
}

interface PrivyUser {
  id: string;
  linked_accounts: PrivyWalletAccount[];
}

// --- Authorization Signature using Web Crypto API ---

async function getAuthorizationSignature(url: string, body: Record<string, unknown>): Promise<string> {
  const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY");
  if (!authKeyRaw) {
    throw new Error("PRIVY_AUTHORIZATION_KEY must be configured for wallet RPC calls");
  }

  const appId = Deno.env.get("PRIVY_APP_ID");
  if (!appId) {
    throw new Error("PRIVY_APP_ID must be configured");
  }

  // Build the payload (per Privy docs)
  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: {
      "privy-app-id": appId,
    },
  };

  // JSON-canonicalize the payload and convert to Uint8Array
  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = new TextEncoder().encode(serializedPayload);

  console.log("[privy-auth] Payload length:", serializedPayload.length, "URL:", url);

  // Strip wallet-auth: prefix (per Privy docs)
  const privateKeyAsString = authKeyRaw.replace("wallet-auth:", "").trim();

  console.log("[privy-auth] Key prefix (first 20 chars):", privateKeyAsString.substring(0, 20) + "...");

  let privateKey: ReturnType<typeof createPrivateKey>;
  try {
    // Privy docs format: key body can be provided without PEM headers.
    const privateKeyPem = privateKeyAsString.includes("BEGIN PRIVATE KEY")
      ? privateKeyAsString
      : `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;

    privateKey = createPrivateKey({ key: privateKeyPem, format: "pem" });
    console.log("[privy-auth] Key loaded via PEM, type:", privateKey.type, "asymmetricKeyType:", privateKey.asymmetricKeyType);
  } catch (pemErr) {
    console.log("[privy-auth] PEM parse failed, trying DER:", (pemErr as Error).message);
    // Fallback: some environments store the key as raw base64 PKCS8 DER bytes.
    const normalized = privateKeyAsString.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const derBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) derBytes[i] = binary.charCodeAt(i);

    privateKey = createPrivateKey({
      key: derBytes,
      format: "der",
      type: "pkcs8",
    });
    console.log("[privy-auth] Key loaded via DER, type:", privateKey.type, "asymmetricKeyType:", privateKey.asymmetricKeyType);
  }

  // Explicitly request DER-encoded ECDSA signature (Privy expects DER format)
  const signatureBuffer = nodeSign("sha256", serializedPayloadBuffer, {
    key: privateKey,
    dsaEncoding: "der",
  });
  const signature = signatureBuffer.toString("base64");

  console.log("[privy-auth] Signature generated, length:", signature.length, "first 20:", signature.substring(0, 20));
  return signature;
}

/** Convert IEEE P1363 signature (r||s) to DER encoding */
function p1363ToDer(p1363: Uint8Array): Uint8Array {
  const half = p1363.length / 2;
  const r = p1363.slice(0, half);
  const s = p1363.slice(half);

  function encodeInteger(bytes: Uint8Array): Uint8Array {
    // Strip leading zeros but keep one if high bit set
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start++;
    const trimmed = bytes.slice(start);
    // Add leading zero if high bit is set (to keep positive)
    const needsPad = trimmed[0] & 0x80;
    const result = new Uint8Array((needsPad ? 1 : 0) + trimmed.length + 2);
    result[0] = 0x02; // INTEGER tag
    result[1] = trimmed.length + (needsPad ? 1 : 0);
    if (needsPad) result[2] = 0x00;
    result.set(trimmed, 2 + (needsPad ? 1 : 0));
    return result;
  }

  const rDer = encodeInteger(r);
  const sDer = encodeInteger(s);
  const seq = new Uint8Array(2 + rDer.length + sDer.length);
  seq[0] = 0x30; // SEQUENCE tag
  seq[1] = rDer.length + sDer.length;
  seq.set(rDer, 2);
  seq.set(sDer, 2 + rDer.length);
  return seq;
}

// --- Auth Headers ---

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
 * Look up a Privy user and return their linked accounts.
 */
export async function getPrivyUser(privyDid: string): Promise<PrivyUser> {
  const res = await fetch(`${PRIVY_API_BASE}/api/v1/users/${encodeURIComponent(privyDid)}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy getUser failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Find the Solana embedded wallet from a Privy user's linked accounts.
 */
export function findSolanaEmbeddedWallet(
  user: PrivyUser
): { address: string; walletId: string } | null {
  const wallet = user.linked_accounts.find(
    (a) =>
      a.type === "wallet" &&
      a.chain_type === "solana" &&
      (a.wallet_client_type === "privy" || a.connector_type === "embedded")
  );

  if (!wallet || !wallet.id) return null;

  return {
    address: wallet.address,
    walletId: wallet.id,
  };
}

/**
 * Find the Ethereum/EVM embedded wallet from a Privy user's linked accounts.
 */
export function findEvmEmbeddedWallet(
  user: PrivyUser
): { address: string; walletId: string } | null {
  const wallet = user.linked_accounts.find(
    (a) =>
      a.type === "wallet" &&
      a.chain_type === "ethereum" &&
      (a.wallet_client_type === "privy" || a.connector_type === "embedded")
  );

  if (!wallet || !wallet.id) return null;

  return {
    address: wallet.address,
    walletId: wallet.id,
  };
}

/**
 * Sign and send a Solana transaction using Privy's server-side wallet RPC.
 * Uses the exact URL format from Privy API docs: https://api.privy.io/v1/wallets/{id}/rpc
 */
export async function signAndSendTransaction(
  walletId: string,
  serializedTransaction: string,
  _rpcUrl: string
): Promise<string> {
  // Use api.privy.io as shown in Privy docs (not auth.privy.io)
  const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "signAndSendTransaction",
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    params: {
      transaction: serializedTransaction,
      encoding: "base64",
    },
  };

  console.log("[privy] signAndSendTransaction URL:", url);

  // Generate authorization signature using Web Crypto API
  const authSignature = await getAuthorizationSignature(url, bodyObj);

  const authKeyId = Deno.env.get("PRIVY_AUTHORIZATION_KEY_ID") || "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "privy-authorization-signature": authSignature,
      ...(authKeyId ? { "privy-authorization-key": authKeyId } : {}),
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy signAndSendTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.hash || data.data?.signature || data.hash || data.signature;
}

/**
 * Sign a Solana transaction without sending.
 */
export async function signTransaction(
  walletId: string,
  serializedTransaction: string
): Promise<string> {
  const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "signTransaction",
    params: {
      transaction: serializedTransaction,
      encoding: "base64",
    },
  };

  const authSignature = await getAuthorizationSignature(url, bodyObj);

  const authKeyId = Deno.env.get("PRIVY_AUTHORIZATION_KEY_ID") || "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "privy-authorization-signature": authSignature,
      ...(authKeyId ? { "privy-authorization-key": authKeyId } : {}),
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy signTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.signed_transaction || data.signed_transaction;
}

/**
 * Send an EVM transaction using Privy's server-side wallet RPC.
 * CAIP-2 for BSC mainnet: eip155:56
 */
export async function evmSendTransaction(
  walletId: string,
  txParams: { to: string; data?: string; value?: string; gas_limit?: string },
  caip2 = "eip155:56"
): Promise<string> {
  const url = `https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}/rpc`;
  const bodyObj = {
    method: "eth_sendTransaction",
    caip2,
    params: {
      transaction: txParams,
    },
  };

  console.log("[privy] eth_sendTransaction URL:", url, "to:", txParams.to);

  const authSignature = await getAuthorizationSignature(url, bodyObj);

  const authKeyId = Deno.env.get("PRIVY_AUTHORIZATION_KEY_ID") || "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "privy-authorization-signature": authSignature,
      ...(authKeyId ? { "privy-authorization-key": authKeyId } : {}),
    },
    body: JSON.stringify(bodyObj),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy eth_sendTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.hash || data.data?.transaction_hash || data.hash || "";
}

/**
 * Convenience: Look up a user by Privy DID, find their Solana wallet,
 * and return everything needed for server-side signing.
 */
export async function resolveUserWallet(privyDid: string): Promise<{
  privyUserId: string;
  walletAddress: string;
  walletId: string;
}> {
  const user = await getPrivyUser(privyDid);
  const wallet = findSolanaEmbeddedWallet(user);

  if (!wallet) {
    throw new Error(`No Solana embedded wallet found for user ${privyDid}`);
  }

  return {
    privyUserId: user.id,
    walletAddress: wallet.address,
    walletId: wallet.walletId,
  };
}

/**
 * Convenience: Look up a user by Privy DID, find their EVM wallet,
 * and return everything needed for server-side signing.
 */
export async function resolveEvmWallet(privyDid: string): Promise<{
  privyUserId: string;
  walletAddress: string;
  walletId: string;
}> {
  const user = await getPrivyUser(privyDid);
  const wallet = findEvmEmbeddedWallet(user);

  if (!wallet) {
    throw new Error(`No EVM embedded wallet found for user ${privyDid}`);
  }

  return {
    privyUserId: user.id,
    walletAddress: wallet.address,
    walletId: wallet.walletId,
  };
}
