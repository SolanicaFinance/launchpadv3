import { useCallback, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction as usePrivySolanaSignAndSend, useSignTransaction as usePrivySolanaSign } from "@privy-io/react-auth/solana";
import { Connection, Transaction, VersionedTransaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRpcUrl } from "./useSolanaWallet";
import { getCachedBlockhash } from "@/lib/blockhashCache";
import bs58 from "bs58";
import { sendRawToAllEndpoints } from "@/lib/jitoBundle";

// Hook that uses Privy - MUST only be called inside PrivyProvider when privyAvailable is true
// IMPORTANT: This project uses EMBEDDED wallets only. External wallets are intentionally ignored.
export function useSolanaWalletWithPrivy() {
  const { authenticated, user, ready } = usePrivy();
  const { wallets } = useWallets();
  const privySolana = usePrivySolanaSignAndSend();
  const privySign = usePrivySolanaSign();
  const [isConnecting, setIsConnecting] = useState(false);

  const rpcData = getRpcUrl();
  const rpcUrl = rpcData.url;
  const rpcSource = rpcData.source;

  const getConnection = useCallback(() => new Connection(rpcUrl, { commitment: "confirmed", disableRetryOnRateLimit: true }), [rpcUrl]);

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
      options?: { skipPreflight?: boolean; walletAddress?: string }
    ): Promise<{ signature: string; confirmed: boolean }> => {
      // Support multi-wallet: use specified wallet or default embedded
      let wallet: any;
      if (options?.walletAddress) {
        wallet = wallets?.find((w: any) => w.address === options.walletAddress) || getSolanaWallet();
      } else {
        wallet = getSolanaWallet();
      }
      if (!wallet) throw new Error("No embedded wallet connected");

      const connection = getConnection();

      try {
        setIsConnecting(true);

        // Use cached blockhash for speed (0ms vs 200-500ms)
        const { blockhash, lastValidBlockHeight } = await getCachedBlockhash();

        // Update legacy transaction blockhash + fee payer
        if (!(transaction as any)?.version) {
          (transaction as Transaction).recentBlockhash = blockhash;
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
        const signature = typeof result.signature === "string"
          ? result.signature
          : bs58.encode(Buffer.from(result.signature));

        console.log("[useSolanaWalletPrivy] Tx sent, signature:", signature);

        // Parallel submit to ALL Jito endpoints + Helius for maximum speed (fire-and-forget)
        try {
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
    [getSolanaWallet, getConnection, privySolana, wallets]
  );

  const getBalance = useCallback(async (): Promise<number> => {
    if (!walletAddress) return 0;

    try {
      const connection = getConnection();
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

  const getTokenBalance = useCallback(async (mintAddress: string): Promise<number> => {
    if (!walletAddress || !mintAddress) return 0;
    try {
      const connection = getConnection();
      const owner = new PublicKey(walletAddress);
      const mint = new PublicKey(mintAddress);
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
      if (accounts.value.length === 0) return 0;

      // Sum raw integer amounts via BigInt to avoid floating-point precision loss
      const rawTotal = accounts.value.reduce((sum, acc) => {
        const raw = (acc.account.data as any)?.parsed?.info?.tokenAmount?.amount;
        return sum + BigInt(raw || '0');
      }, BigInt(0));

      const decimals = (accounts.value[0]?.account.data as any)?.parsed?.info?.tokenAmount?.decimals ?? 6;
      // Convert to number only at the end — preserves exact integer for amounts < 2^53
      const balance = Number(rawTotal) / (10 ** decimals);

      console.log(`[getTokenBalance] ${mintAddress.slice(0,8)}… raw: ${rawTotal.toString()}, decimals: ${decimals}, balance: ${balance}`);
      return balance;
    } catch (err) {
      console.error("[getTokenBalance] Error:", err);
      return 0;
    }
  }, [walletAddress, getConnection]);

  /**
   * Get token balance with raw amount string and decimals — for exact 100% sells
   */
  const getTokenBalanceRaw = useCallback(async (mintAddress: string): Promise<{ balance: number; decimals: number; rawAmount: string }> => {
    if (!walletAddress || !mintAddress) return { balance: 0, decimals: 6, rawAmount: '0' };
    try {
      const connection = getConnection();
      const owner = new PublicKey(walletAddress);
      const mint = new PublicKey(mintAddress);
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
      if (accounts.value.length === 0) return { balance: 0, decimals: 6, rawAmount: '0' };

      const rawTotal = accounts.value.reduce((sum, acc) => {
        const raw = (acc.account.data as any)?.parsed?.info?.tokenAmount?.amount;
        return sum + BigInt(raw || '0');
      }, BigInt(0));

      const decimals = (accounts.value[0]?.account.data as any)?.parsed?.info?.tokenAmount?.decimals ?? 6;
      const balance = Number(rawTotal) / (10 ** decimals);
      const rawAmount = rawTotal.toString();

      console.log(`[getTokenBalanceRaw] ${mintAddress.slice(0,8)}… raw: ${rawAmount}, decimals: ${decimals}, balance: ${balance}`);
      return { balance, decimals, rawAmount };
    } catch (err) {
      console.error("[getTokenBalanceRaw] Error:", err);
      return { balance: 0, decimals: 6, rawAmount: '0' };
    }
  }, [walletAddress, getConnection]);

  // Sign-only (no send) — needed for Meteora/Lighthouse flows with ephemeral keypairs
  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(
      transaction: T,
      options?: { walletAddress?: string }
    ): Promise<T> => {
      let wallet: any;
      if (options?.walletAddress) {
        wallet = wallets?.find((w: any) => w.address === options.walletAddress) || getSolanaWallet();
      } else {
        wallet = getSolanaWallet();
      }
      if (!wallet) throw new Error("No embedded wallet connected");

      // Update blockhash for legacy transactions
      const { blockhash } = await getCachedBlockhash();
      if (!(transaction as any)?.version) {
        (transaction as Transaction).recentBlockhash = blockhash;
        (transaction as Transaction).feePayer = wallet.address ? new PublicKey(wallet.address) : undefined;
      }

      const serializedTx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });

      console.log("[useSolanaWalletPrivy] Sign-only via Privy signTransaction", {
        walletAddress: wallet.address,
        txBytes: serializedTx.length,
      });

      const result = await privySign.signTransaction({
        transaction: serializedTx,
        wallet: wallet as any,
        chain: "solana:mainnet" as any,
        options: {
          uiOptions: { showWalletUIs: false },
        },
      });

      // result.signedTransaction is Uint8Array — deserialize back to the appropriate type
      const signedBytes = result.signedTransaction instanceof Uint8Array
        ? result.signedTransaction
        : new Uint8Array(result.signedTransaction);

      // Determine if versioned or legacy and deserialize accordingly
      if ((transaction as any)?.version !== undefined || transaction instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(signedBytes) as T;
      } else {
        return Transaction.from(signedBytes) as T;
      }
    },
    [getSolanaWallet, privySign, wallets]
  );

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
    getTokenBalanceRaw,
    signAndSendTransaction,
    signTransaction,
    getSolanaWallet,
    getEmbeddedWallet,
  };
}
