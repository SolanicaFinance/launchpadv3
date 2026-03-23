/**
 * Privy Server Wallet Helper
 * 
 * Matches EXACTLY the Privy docs signing example:
 * https://docs.privy.io/controls/authorization-keys/using-owners/sign/direct-implementation
 */

import canonicalize from "npm:canonicalize@2.0.0";
import crypto from "node:crypto";

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

// --- Authorization Signature (EXACTLY per Privy docs) ---

function getAuthorizationSignature(
  url: string,
  body: Record<string, unknown>,
  options: {
    idempotencyKey?: string;
    expiresAt?: string;
  } = {},
): string {
  const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY");
  if (!authKeyRaw) {
    throw new Error("PRIVY_AUTHORIZATION_KEY must be configured");
  }

  const appId = Deno.env.get("PRIVY_APP_ID");
  if (!appId) {
    throw new Error("PRIVY_APP_ID must be configured");
  }

  // Canonical payload exactly per Privy docs: only privy-* headers being signed.
  const payloadHeaders: Record<string, string> = {
    "privy-app-id": appId,
  };
  if (options.idempotencyKey) payloadHeaders["privy-idempotency-key"] = options.idempotencyKey;
  if (options.expiresAt) payloadHeaders["privy-request-expiry"] = options.expiresAt;

  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: payloadHeaders,
  };

  // JSON-canonicalize the payload and convert to buffer
  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = new TextEncoder().encode(serializedPayload);

  // Normalize key input: supports wallet-auth: prefix, raw base64, escaped newlines, or pasted PEM blocks
  const normalizedKeyBody = authKeyRaw
    .replace(/^wallet-auth:/, "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN EC PRIVATE KEY-----/g, "")
    .replace(/-----END EC PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim()
    .replace(/\s+/g, "");

  if (!normalizedKeyBody) {
    throw new Error("invalid PEM private key");
  }

  // Wrap at 64 chars to produce a valid PEM block
  const wrappedKeyBody = normalizedKeyBody.match(/.{1,64}/g)?.join("\n") ?? normalizedKeyBody;
  const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${wrappedKeyBody}\n-----END PRIVATE KEY-----`;

  let privateKey: crypto.KeyObject;
  try {
    privateKey = crypto.createPrivateKey({
      key: privateKeyAsPem,
      format: "pem",
    });
  } catch {
    throw new Error("invalid PEM private key");
  }

  // Sign with ECDSA P-256 using IEEE P1363 encoding (raw r||s, 64 bytes)
  // Privy expects this format, NOT DER encoding
  const signatureBuffer = crypto.sign("sha256", serializedPayloadBuffer, {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  });
  const signature = signatureBuffer.toString("base64");

  console.log("[privy-auth] Signature generated, length:", signature.length, "URL:", url);
  return signature;
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

function normalizeAuthorizationKeyId(rawValue: string): string | null {
  if (!rawValue) return null;

  const looksLikePrivateKey =
    rawValue.startsWith("wallet-auth:") ||
    rawValue.includes("BEGIN PRIVATE KEY") ||
    rawValue.length > 96;

  if (looksLikePrivateKey) {
    console.warn("[privy-auth] PRIVY_AUTHORIZATION_KEY_ID appears invalid (looks like a private key), ignoring it");
    return null;
  }

  return rawValue;
}

async function postPrivyRpc(url: string, bodyObj: Record<string, unknown>): Promise<Response> {
  const rawAuthKeyId = (Deno.env.get("PRIVY_AUTHORIZATION_KEY_ID") || "").trim();
  const authKeyId = normalizeAuthorizationKeyId(rawAuthKeyId);

  const requestHeaders: Record<string, string> = {
    ...getAuthHeaders(),
  };

  if (authKeyId) {
    requestHeaders["privy-authorization-key"] = authKeyId;
  }

  const authSignature = getAuthorizationSignature(url, bodyObj);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...requestHeaders,
      "privy-authorization-signature": authSignature,
    },
    body: JSON.stringify(bodyObj),
  });

  console.log(`[privy-auth] Attempt docs-canonical+key-header(${authKeyId ? "on" : "off"}) → status ${response.status}`);
  return response;
}

async function getWalletAuthDebug(walletId: string): Promise<string> {
  try {
    const res = await fetch(`https://api.privy.io/v1/wallets/${encodeURIComponent(walletId)}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const body = await res.text();
      return `wallet_lookup_failed status=${res.status} body=${body.slice(0, 300)}`;
    }

    const data: any = await res.json();
    return JSON.stringify({
      wallet_id: data?.id || walletId,
      owner_id: data?.owner_id || null,
      policy_ids: Array.isArray(data?.policy_ids) ? data.policy_ids : [],
      additional_signers: Array.isArray(data?.additional_signers) ? data.additional_signers : [],
      authorization_threshold: data?.authorization_threshold ?? null,
    });
  } catch (err) {
    return `wallet_lookup_exception ${(err as Error)?.message || String(err)}`;
  }
}

/**
 * Look up a Privy user and return their linked accounts.
 */
export async function getPrivyUser(privyIdOrDid: string): Promise<PrivyUser> {
  const rawId = privyIdOrDid.replace(/^did:privy:/, "");
  const candidates = Array.from(new Set([privyIdOrDid, rawId, `did:privy:${rawId}`]));

  let lastError = "Unknown error";

  for (const candidate of candidates) {
    const res = await fetch(`${PRIVY_API_BASE}/api/v1/users/${encodeURIComponent(candidate)}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      return res.json();
    }

    lastError = await res.text();
    if (res.status !== 404) {
      throw new Error(`Privy getUser failed (${res.status}): ${lastError}`);
    }
  }

  throw new Error(`Privy getUser failed (404): ${lastError}`);
}

/**
 * Resolve a Privy user by direct lookup first, then by scanning the app's user list.
 */
export async function resolvePrivyUser(privyIdOrDid: string): Promise<PrivyUser | null> {
  try {
    return await getPrivyUser(privyIdOrDid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("(404)")) {
      throw error;
    }
  }

  const rawId = privyIdOrDid.replace(/^did:privy:/, "");
  const candidates = new Set([privyIdOrDid, rawId, `did:privy:${rawId}`]);
  let cursor: string | undefined;

  do {
    const url = new URL(`${PRIVY_API_BASE}/api/v1/users`);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Privy listUsers failed (${res.status}): ${body}`);
    }

    const page = await res.json();
    const users = page.data || page.users || [];

    for (const user of users as PrivyUser[]) {
      const userCandidates = new Set<string>([
        user.id,
        user.id.replace(/^did:privy:/, ""),
      ]);

      const linkedAccounts = Array.isArray(user.linked_accounts) ? user.linked_accounts : [];
      for (const account of linkedAccounts as Array<PrivyWalletAccount & { subject?: string }>) {
        if (account.id) userCandidates.add(account.id);
        if (account.address) userCandidates.add(account.address);
        if (account.subject) userCandidates.add(account.subject);
      }

      for (const candidate of candidates) {
        if (userCandidates.has(candidate)) {
          return user;
        }
      }
    }

    cursor = page.next_cursor || undefined;
  } while (cursor);

  return null;
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
 */
export async function signAndSendTransaction(
  walletId: string,
  serializedTransaction: string,
  _rpcUrl: string
): Promise<string> {
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

  const res = await postPrivyRpc(url, bodyObj);

  if (!res.ok) {
    const body = await res.text();

    if (res.status === 401) {
      const rawAuthKeyId = (Deno.env.get("PRIVY_AUTHORIZATION_KEY_ID") || "").trim();
      const authKeyIdStatus = normalizeAuthorizationKeyId(rawAuthKeyId) ? "present" : "missing_or_invalid";
      const walletAuthDebug = await getWalletAuthDebug(walletId);
      throw new Error(
        `Privy signAndSendTransaction failed (401): ${body} | auth_key_id_status=${authKeyIdStatus} | wallet_auth=${walletAuthDebug}`,
      );
    }

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

  const res = await postPrivyRpc(url, bodyObj);

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

  const res = await postPrivyRpc(url, bodyObj);

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
