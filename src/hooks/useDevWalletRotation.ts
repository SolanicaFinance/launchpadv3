/**
 * Dev Wallet Rotation Hook
 *
 * Orchestrates the full CEX-routed wallet rotation flow:
 * 1. Detect existing launches
 * 2. Create new Privy embedded wallet
 * 3. Randomize CEX
 * 4. Get SplitNOW quote → create order
 * 5. Send SOL to deposit address
 * 6. Poll order status
 * 7. Switch to new wallet, hide old
 */

import { useState, useCallback } from "react";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { useWallets } from "@privy-io/react-auth/solana";

const CEXES = ["Binance", "KuCoin", "Gate.io"] as const;
type CexName = (typeof CEXES)[number];

export type RotationStep =
  | "idle"
  | "checking_launches"
  | "creating_wallet"
  | "randomizing_cex"
  | "fetching_balance"
  | "getting_quote"
  | "creating_order"
  | "sending_sol"
  | "polling_status"
  | "switching_wallet"
  | "complete"
  | "error";

export interface RotationState {
  step: RotationStep;
  failedStep: RotationStep | null;
  launchCount: number;
  newWalletAddress: string | null;
  selectedCex: CexName | null;
  balance: number;
  quote: any | null;
  order: any | null;
  txSignature: string | null;
  orderStatus: string | null;
  orderStatusText: string | null;
  error: string | null;
  logs: string[];
}

const initial: RotationState = {
  step: "idle",
  failedStep: null,
  launchCount: 0,
  newWalletAddress: null,
  selectedCex: null,
  balance: 0,
  quote: null,
  order: null,
  txSignature: null,
  orderStatus: null,
  orderStatusText: null,
  error: null,
  logs: [],
};

export function useDevWalletRotation() {
  const { profileId } = useAuth();
  const { activeWallet, createNewWallet, switchWallet, hideWallet } = useMultiWallet() as any;
  const { wallets } = useWallets();
  const [state, setState] = useState<RotationState>(initial);
  const [running, setRunning] = useState(false);

  const rpcUrl = getRpcUrl().url;

  const log = useCallback((msg: string) => {
    console.log(`[WalletRotation] ${msg}`);
    setState((s) => ({ ...s, logs: [...s.logs, `${new Date().toLocaleTimeString()} — ${msg}`] }));
  }, []);

  const update = useCallback((partial: Partial<RotationState>) => {
    setState((s) => ({ ...s, ...partial }));
  }, []);

  /** Check how many tokens were launched from the current wallet */
  const checkLaunches = useCallback(async (walletAddress: string): Promise<number> => {
    const { data, error } = await supabase
      .from("fun_tokens")
      .select("id", { count: "exact", head: true })
      .eq("creator_wallet", walletAddress);
    if (error) throw new Error(`Failed to check launches: ${error.message}`);
    return (data as any)?.length ?? 0;
  }, []);

  /** Call splitnow-proxy edge function */
  const splitnowCall = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("splitnow-proxy", {
      body: { action, ...params },
    });
    if (error) throw new Error(`SplitNOW ${action} failed: ${error.message}`);
    return data;
  }, []);

  /** Get the Privy wallet signer for the given address */
  const getWalletSigner = useCallback(
    (address: string) => {
      if (!wallets) return null;
      return wallets.find((w: any) => w.address === address) || null;
    },
    [wallets]
  );

  /** Run the full rotation flow */
  const startRotation = useCallback(async () => {
    if (!activeWallet || running) return;
    setRunning(true);

    let currentStep: RotationStep = "checking_launches";
    const setCurrentStep = (step: RotationStep) => {
      currentStep = step;
      update({ step, failedStep: null });
    };

    // Preserve newWalletAddress from previous attempt to avoid creating duplicates
    setState((prev) => ({
      ...initial,
      step: "checking_launches",
      failedStep: null,
      newWalletAddress: prev.newWalletAddress,
      logs: [],
    }));

    try {
      // Step 1: Check launches
      setCurrentStep("checking_launches");
      log(`Checking launches for wallet ${activeWallet.address.slice(0, 8)}...`);
      const count = await checkLaunches(activeWallet.address);
      update({ launchCount: count });
      log(`Found ${count} token launch(es) from this wallet`);

      // Step 2: Create new wallet (reuse if already created from a previous attempt)
      setCurrentStep("creating_wallet");
      let newAddr: string;
      const existingNewAddr = (await new Promise<string | null>((resolve) => {
        setState((s) => { resolve(s.newWalletAddress); return s; });
      }));
      if (existingNewAddr) {
        newAddr = existingNewAddr;
        log(`Reusing previously created wallet: ${newAddr}`);
      } else {
        log("Generating fresh Privy embedded wallet...");
        newAddr = await createNewWallet();
        update({ newWalletAddress: newAddr });
        log(`New wallet created: ${newAddr}`);
      }

      // Step 3: Randomize CEX
      setCurrentStep("randomizing_cex");
      const cex = CEXES[Math.floor(Math.random() * CEXES.length)];
      update({ selectedCex: cex });
      log(`Selected exchange: ${cex}`);

      // Step 4: Get balance
      setCurrentStep("fetching_balance");
      const connection = new Connection(rpcUrl, "confirmed");
      const balLamports = await connection.getBalance(new PublicKey(activeWallet.address));
      const balSol = balLamports / LAMPORTS_PER_SOL;
      update({ balance: balSol });
      log(`Current balance: ${balSol.toFixed(6)} SOL`);

      if (balSol < 0.01) {
        throw new Error("Insufficient balance for rotation (need at least 0.01 SOL)");
      }

      // Reserve for tx fee
      const sendAmount = balSol - 0.005;
      log(`Amount to send (minus fees): ${sendAmount.toFixed(6)} SOL`);

      // Step 5: Get quote
      setCurrentStep("getting_quote");
      log("Fetching SplitNOW quote (SOL→SOL)...");
      const quoteData = await splitnowCall("quote", { fromAmount: sendAmount });
      update({ quote: quoteData });
      const quoteId = quoteData?.quoteId || quoteData?.id;
      log(`Quote received (ID: ${quoteId})`);

      // Step 6: Create order
      setCurrentStep("creating_order");
      log(`Creating order routed through ${cex}...`);
      const orderData = await splitnowCall("order", {
        quoteId,
        fromAmount: sendAmount,
        walletDistributions: [
          {
            address: newAddr,
            toAssetId: "sol",
            toNetworkId: "solana",
            percentage: 100,
          },
        ],
      });
      update({ order: orderData });
      const orderId = orderData?.orderId || orderData?.id;
      const depositAddress = orderData?.depositAddress;
      const depositAmount = orderData?.depositAmount || sendAmount;
      log(`Order created (ID: ${orderId})`);
      log(`Deposit address: ${depositAddress}`);
      log(`Deposit amount: ${depositAmount} SOL`);

      // Step 7: Send SOL to deposit address
      setCurrentStep("sending_sol");
      log("Signing and sending SOL to deposit address...");
      const signer = getWalletSigner(activeWallet.address);
      if (!signer) throw new Error("Cannot find wallet signer for active wallet");

      const sendLamports = Math.floor(parseFloat(depositAmount) * LAMPORTS_PER_SOL);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(activeWallet.address),
          toPubkey: new PublicKey(depositAddress),
          lamports: sendLamports,
        })
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = new PublicKey(activeWallet.address);

      const signedTx = await (signer as any).signTransaction(tx);
      const sig = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
      update({ txSignature: sig });
      log(`Transaction sent: ${sig}`);

      // Step 8: Poll order status
      setCurrentStep("polling_status");
      log("Polling order status...");

      let finalStatus = "pending";
      let statusText = "Waiting...";
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusData = await splitnowCall("status", { orderId });
        finalStatus = statusData?.orderStatus || statusData?.status || "pending";
        statusText = statusData?.orderStatusText || finalStatus;
        update({ orderStatus: finalStatus, orderStatusText: statusText });
        log(`Status: ${statusText} (${finalStatus})`);

        if (finalStatus === "completed" || finalStatus === "done") break;
        if (finalStatus === "failed" || finalStatus === "expired" || finalStatus === "error") {
          throw new Error(`Order ${finalStatus}: ${statusText}`);
        }
      }

      // Step 9: Switch wallet and hide old
      setCurrentStep("switching_wallet");
      log("Switching to new wallet and hiding old one...");
      switchWallet(newAddr);
      if (hideWallet) {
        await hideWallet(activeWallet.address);
      }
      log("✅ Wallet rotation complete!");

      update({ step: "complete", failedStep: null });
    } catch (err: any) {
      console.error("[WalletRotation] Error:", err);
      update({ step: "error", failedStep: currentStep, error: err.message || "Unknown error" });
      log(`❌ Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [activeWallet, running, rpcUrl, wallets, createNewWallet, switchWallet, hideWallet, checkLaunches, splitnowCall, getWalletSigner, log, update]);

  const reset = useCallback(() => {
    setState(initial);
    setRunning(false);
  }, []);

  return {
    state,
    running,
    startRotation,
    reset,
    checkLaunches,
  };
}
