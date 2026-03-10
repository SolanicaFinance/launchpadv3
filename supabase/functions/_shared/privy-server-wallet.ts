/**
 * Privy Server Wallet Helper
 * 
 * Wraps the Privy REST API for server-side wallet operations.
 * Uses Basic Auth with PRIVY_APP_ID:PRIVY_APP_SECRET.
 * 
 * Docs: https://docs.privy.io/reference/rest-auth/
 */

const PRIVY_API_BASE = "https://auth.privy.io";

interface PrivyWalletAccount {
  type: string;
  address: string;
  chain_type: string;
  wallet_client: string;
  wallet_client_type: string;
  connector_type: string;
  id?: string;  // wallet_id for server signing
}

interface PrivyUser {
  id: string;
  linked_accounts: PrivyWalletAccount[];
}

function getAuthHeaders(): Record<string, string> {
  const appId = Deno.env.get("PRIVY_APP_ID");
  const appSecret = Deno.env.get("PRIVY_APP_SECRET");

  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET must be configured");
  }

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
 * Returns { address, walletId } or null.
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
 * Sign and send a Solana transaction using Privy's server-side wallet RPC.
 * 
 * @param walletId - The Privy wallet ID (from linked_accounts[].id)
 * @param serializedTransaction - Base64-encoded serialized transaction
 * @param rpcUrl - Solana RPC URL for broadcasting
 * @returns The transaction signature
 */
export async function signAndSendTransaction(
  walletId: string,
  serializedTransaction: string,
  rpcUrl: string
): Promise<string> {
  const res = await fetch(
    `${PRIVY_API_BASE}/api/v1/wallets/${encodeURIComponent(walletId)}/rpc`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        method: "signAndSendTransaction",
        caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // Solana mainnet
        params: {
          transaction: serializedTransaction,
          encoding: "base64",
          send_options: {
            skip_preflight: true,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy signAndSendTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.hash || data.data?.signature || data.hash || data.signature;
}

/**
 * Sign a Solana transaction without sending (returns signed tx bytes).
 * 
 * @param walletId - The Privy wallet ID
 * @param serializedTransaction - Base64-encoded serialized transaction
 * @returns Base64-encoded signed transaction
 */
export async function signTransaction(
  walletId: string,
  serializedTransaction: string
): Promise<string> {
  const res = await fetch(
    `${PRIVY_API_BASE}/api/v1/wallets/${encodeURIComponent(walletId)}/rpc`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        method: "signTransaction",
        caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        params: {
          transaction: serializedTransaction,
          encoding: "base64",
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Privy signTransaction failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.data?.signed_transaction || data.signed_transaction;
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
