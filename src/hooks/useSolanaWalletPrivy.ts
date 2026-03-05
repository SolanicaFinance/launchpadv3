import { useCallback, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction as usePrivySolanaSignAndSend } from "@privy-io/react-auth/solana";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { getRpcUrl } from "./useSolanaWallet";

// Hook that uses Privy - MUST only be called inside PrivyProvider when privyAvailable is true
// IMPORTANT: This project uses EMBEDDED wallets only. External wallets are intentionally ignored.
export function useSolanaWalletWithPrivy() {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const privySolana = usePrivySolanaSignAndSend();
  const [isConnecting, setIsConnecting] = useState(false);

  const rpcData = getRpcUrl();
  const rpcUrl = rpcData.url;
  const rpcSource = rpcData.source;

  const getConnection = useCallback(() => new Connection(rpcUrl, "confirmed"), [rpcUrl]);

  const isPrivyEmbeddedWallet = useCallback((w: any) => {
    const walletClientType = w?.walletClientType;
    const standardName = w?.standardWallet?.name;
    const name = String(w?.name ?? "").toLowerCase();

    return (
      walletClientType === "privy" ||
      standardName === "Privy" ||
      name.includes("privy") ||
      name.includes("embedded")
    );
  }, []);

  // Embedded wallet ONLY
  const getEmbeddedWallet = useCallback(() => {
    const embedded = wallets?.find((w: any) => isPrivyEmbeddedWallet(w));
    return embedded || null;
  }, [wallets, isPrivyEmbeddedWallet]);

  // Alias kept for compatibility with existing callers
  const getSolanaWallet = useCallback(() => getEmbeddedWallet(), [getEmbeddedWallet]);

  // Wallet address is embedded wallet only (no linkedAccounts fallback)
  const walletAddress = getEmbeddedWallet()?.address || null;

  const isWalletReady = ready && authenticated && !!walletAddress;

  const signAndSendTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
      options?: { skipPreflight?: boolean }
    ): Promise<{ signature: string; confirmed: boolean }> => {
      const wallet = getSolanaWallet();
      if (!wallet) throw new Error("No embedded wallet connected");

      const connection = getConnection();

      try {
        setIsConnecting(true);

        // Use cached blockhash for speed (0ms vs 200-500ms)
        const { getCachedBlockhash } = await import("@/lib/blockhashCache");
        const { blockhash, lastValidBlockHeight } = await getCachedBlockhash();

        // Update legacy transaction blockhash + fee payer
        if (!(transaction as any)?.version) {
          (transaction as Transaction).recentBlockhash = blockhash;
          const { PublicKey } = await import("@solana/web3.js");
          (transaction as Transaction).feePayer = wallet.address ? new PublicKey(wallet.address) : undefined;
        }

        // Serialize transaction to Uint8Array for Privy's standard wallet API
        const serializedTx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });

        console.log("[useSolanaWalletPrivy] Signing via Privy signAndSendTransaction", {
          walletAddress: wallet.address,
          txBytes: serializedTx.length,
        });

        const result = await privySolana.signAndSendTransaction({
          transaction: serializedTx,
          wallet: wallet as any,
          chain: "solana:mainnet" as any,
          options: {
            uiOptions: { showWalletUIs: false },
          },
        });

        // result.signature is Uint8Array — convert to base58 string
        const { default: bs58 } = await import("bs58");
        const signature = typeof result.signature === "string"
          ? result.signature
          : bs58.encode(Buffer.from(result.signature));

        console.log("[useSolanaWalletPrivy] Tx sent, signature:", signature);

        // Parallel submit to ALL Jito endpoints + Helius for maximum speed (fire-and-forget)
        try {
          const { sendRawToAllEndpoints } = await import("@/lib/jitoBundle");
          sendRawToAllEndpoints(serializedTx);
        } catch {
          // Non-fatal: parallel submission is best-effort
        }

        // Optimistic: don't block on confirmation. Poll in background.
        connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        ).then(confirmation => {
          if (confirmation.value.err) {
            console.warn(`[useSolanaWalletPrivy] Tx failed on-chain: ${confirmation.value.err}`);
          } else {
            console.log(`[useSolanaWalletPrivy] Tx confirmed: ${signature}`);
          }
        }).catch(err => {
          console.warn('[useSolanaWalletPrivy] Confirmation poll error:', err);
        });

        return { signature, confirmed: true };
      } finally {
        setIsConnecting(false);
      }
    },
    [getSolanaWallet, getConnection, privySolana]
  );

  const getBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;

    try {
      const connection = getConnection();
      const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const pubkey = new PublicKey(walletAddress);
      const balance = await connection.getBalance(pubkey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("[useSolanaWalletWithPrivy] Balance error:", error);
      return 0;
    }
  }, [walletAddress, getConnection]);

  const getBalanceStrict = useCallback(async (): Promise<number> => {
    if (!walletAddress) throw new Error("No wallet address");

    const connection = getConnection();
    const { PublicKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const pubkey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pubkey);
    return balance / LAMPORTS_PER_SOL;
  }, [walletAddress, getConnection]);

  const debug = useMemo(
    () => ({
      rpcUrl,
      rpcSource,
      privyReady: ready,
      authenticated,
      walletAddress,
      walletSource: walletAddress ? "useWallets_embedded" : "none",
      wallets: (wallets ?? []).map((w: any) => ({
        walletClientType: w?.walletClientType,
        standardName: w?.standardWallet?.name,
        address: w?.address,
      })),
      privyUserWallet: (user as any)?.wallet?.address ?? null,
      linkedAccountsCount: (user as any)?.linkedAccounts?.length ?? 0,
    }),
    [rpcUrl, rpcSource, ready, authenticated, walletAddress, wallets, user]
  );

  const getTokenBalance = useCallback(async (_mintAddress: string): Promise<number> => {
    // Token balances are tracked in the database for bonding curve tokens
    return 0;
  }, []);

  return {
    walletAddress,
    isWalletReady,
    isConnecting,
    rpcUrl,
    debug,
    getConnection,
    getBalance,
    getBalanceStrict,
    getTokenBalance,
    signAndSendTransaction,
    getSolanaWallet,
    getEmbeddedWallet,
  };
}
