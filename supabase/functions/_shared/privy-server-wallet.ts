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

function getAuthorizationSignature(url: string, body: Record<string, unknown>): string {
  const authKeyRaw = Deno.env.get("PRIVY_AUTHORIZATION_KEY");
  if (!authKeyRaw) {
    throw new Error("PRIVY_AUTHORIZATION_KEY must be configured");
  }

  const appId = Deno.env.get("PRIVY_APP_ID");
  if (!appId) {
    throw new Error("PRIVY_APP_ID must be configured");
  }

  // Payload — EXACTLY as shown in Privy docs
  // Only privy-app-id in headers. No privy-authorization-key.
  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: {
      "privy-app-id": appId,
    },
  };

  // JSON-canonicalize the payload and convert to buffer
  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = new TextEncoder().encode(serializedPayload);

  // Normalize key input: supports wallet-auth: prefix, raw base64, escaped newlines, or pasted PEM blocks
  const normalizedKeyBody = authKeyRaw
    .replace(/^wallet-auth:/, "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
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

  // Sign (per docs: crypto.sign with sha256)
  const signatureBuffer = crypto.sign("sha256", serializedPayloadBuffer, privateKey);
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

function postPrivyRpc(url: string, bodyObj: Record<string, unknown>): Promise<Response> {
  // Generate signature — matches EXACTLY the docs example
  const authSignature = getAuthorizationSignature(url, bodyObj);

  // Send request — only privy-authorization-signature header, NO privy-authorization-key
  return fetch(url, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "privy-authorization-signature": authSignature,
    },
    body: JSON.stringify(bodyObj),
  });
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
