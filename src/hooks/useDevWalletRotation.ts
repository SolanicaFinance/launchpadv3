/**
 * Dev Wallet Rotation Hook
 *
 * Orchestrates the full CEX-routed wallet rotation flow:
 * 1. Detect existing launches
 * 2. Create new Privy embedded wallet
 * 3. User selects CEX (manual) & previews quote
 * 4. Create order → Send SOL to deposit
 * 5. Poll order status
 * 6. Switch to new wallet, hide old
 */

import { useState, useCallback } from "react";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getRpcUrl } from "@/hooks/useSolanaWallet";
import { useWallets } from "@privy-io/react-auth/solana";

export interface Exchanger {
  id: string;
  name: string;
  category: string;
  eta: number;
  isAvailable: boolean;
  status: { orders: boolean; quotes: boolean; show: boolean };
  website: string;
}

export interface QuotePreview {
  quoteId: string;
  fromAmount: number;
  estimatedReceive: number;
  fee: number;
  rate: number;
  raw: any;
}

export type RotationStep =
  | "idle"
  | "loading_exchangers"
  | "selecting_cex"
  | "previewing_quote"
  | "checking_launches"
  | "creating_wallet"
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
  exchangers: Exchanger[];
  launchCount: number;
  newWalletAddress: string | null;
  selectedCex: string | null;
  balance: number;
  quotePreview: QuotePreview | null;
  quote: any | null;
  order: any | null;
  txSignature: string | null;
  orderStatus: string | null;
  orderStatusText: string | null;
  error: string | null;
  logs: string[];
  minDeposit: number;
  maxDeposit: number | null;
}

const initial: RotationState = {
  step: "idle",
  failedStep: null,
  exchangers: [],
  launchCount: 0,
  newWalletAddress: null,
  selectedCex: null,
  balance: 0,
  quotePreview: null,
  quote: null,
  order: null,
  txSignature: null,
  orderStatus: null,
  orderStatusText: null,
  error: null,
  logs: [],
  minDeposit: 0.05,
  maxDeposit: null,
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

  /** Call splitnow-proxy edge function */
  const splitnowCall = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("splitnow-proxy", {
      body: { action, ...params },
    });
    if (error) throw new Error(`SplitNOW ${action} failed: ${error.message}`);
    return data;
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

  /** Get the Privy wallet signer for the given address */
  const getWalletSigner = useCallback(
    (address: string) => {
      if (!wallets) return null;
      return wallets.find((w: any) => w.address === address) || null;
    },
    [wallets]
  );

  /** Load exchangers and limits from API */
  const loadExchangers = useCallback(async () => {
    update({ step: "loading_exchangers", error: null });
    try {
      const [exchangersData, limitsData] = await Promise.all([
        splitnowCall("exchangers"),
        splitnowCall("limits"),
      ]);

      const available = (exchangersData?.exchangers || [])
        .filter((e: any) => e.isAvailable && e.status?.orders && e.status?.quotes)
        .map((e: any): Exchanger => ({
          id: e.id,
          name: e.name,
          category: e.category,
          eta: e.eta,
          isAvailable: e.isAvailable,
          status: e.status,
          website: e.website,
        }));

      const solLimits = (limitsData?.limits || []).find((l: any) => l.assetId === "sol");

      // Also fetch balance
      const connection = new Connection(rpcUrl, "confirmed");
      const balLamports = await connection.getBalance(new PublicKey(activeWallet.address));
      const balSol = balLamports / LAMPORTS_PER_SOL;

      update({
        step: "selecting_cex",
        exchangers: available,
        balance: balSol,
        minDeposit: solLimits?.minDeposit ?? 0.05,
        maxDeposit: solLimits?.maxDeposit ?? null,
      });
    } catch (err: any) {
      update({ step: "error", error: err.message || "Failed to load exchangers" });
    }
  }, [splitnowCall, update, rpcUrl, activeWallet]);

  /** Fetch a quote preview for the selected CEX */
  const previewQuote = useCallback(async (cexId: string) => {
    update({ step: "previewing_quote", selectedCex: cexId, error: null });
    try {
      const sendAmount = state.balance - 0.005;
      if (sendAmount < state.minDeposit) {
        throw new Error(`Insufficient balance. Min deposit: ${state.minDeposit} SOL, available: ${sendAmount.toFixed(4)} SOL`);
      }

      const quoteData = await splitnowCall("quote", {
        fromAmount: sendAmount,
        fromAssetId: "sol",
        fromNetworkId: "solana",
        toAssetId: "sol",
        toNetworkId: "solana",
        type: "floating_rate",
      });

      // Parse quote legs for rate info
      const legs = quoteData?.quoteLegs || [];
      const firstLeg = legs[0] || {};
      const rate = firstLeg?.rate || 1;
      const estimatedReceive = firstLeg?.toAmount || sendAmount * rate;
      const fee = sendAmount - estimatedReceive;

      update({
        step: "selecting_cex",
        quotePreview: {
          quoteId: quoteData?.quoteId,
          fromAmount: sendAmount,
          estimatedReceive: Number(estimatedReceive),
          fee: Math.max(0, fee),
          rate: Number(rate),
          raw: quoteData,
        },
      });
    } catch (err: any) {
      update({ step: "selecting_cex", error: err.message });
    }
  }, [splitnowCall, update, state.balance, state.minDeposit]);

  /** Run the full rotation flow with a user-selected CEX */
  const startRotation = useCallback(async (selectedCex: string) => {
    if (!activeWallet || running) return;
    setRunning(true);

    let currentStep: RotationStep = "checking_launches";
    const setCurrentStep = (step: RotationStep) => {
      currentStep = step;
      update({ step, failedStep: null });
    };

    setState((prev) => ({
      ...prev,
      step: "checking_launches",
      failedStep: null,
      selectedCex,
      quote: null,
      order: null,
      txSignature: null,
      orderStatus: null,
      orderStatusText: null,
      error: null,
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
      const existingNewAddr = await new Promise<string | null>((resolve) => {
        setState((s) => { resolve(s.newWalletAddress); return s; });
      });
      if (existingNewAddr) {
        newAddr = existingNewAddr;
        log(`Reusing previously created wallet: ${newAddr}`);
      } else {
        log("Generating fresh Privy embedded wallet...");
        newAddr = await createNewWallet();
        update({ newWalletAddress: newAddr });
        log(`New wallet created: ${newAddr}`);
      }

      // Step 3: Get balance
      setCurrentStep("fetching_balance");
      const connection = new Connection(rpcUrl, "confirmed");
      const balLamports = await connection.getBalance(new PublicKey(activeWallet.address));
      const balSol = balLamports / LAMPORTS_PER_SOL;
      update({ balance: balSol });
      log(`Current balance: ${balSol.toFixed(6)} SOL`);

      if (balSol < state.minDeposit) {
        throw new Error(`Insufficient balance (need at least ${state.minDeposit} SOL, have ${balSol.toFixed(4)})`);
      }

      const sendAmount = balSol - 0.005;
      log(`Amount to send (minus fees): ${sendAmount.toFixed(6)} SOL`);

      let depositAddress = newAddr;
      let depositAmount = sendAmount;
      let usedDirectFallback = false;
      let orderId: string | undefined;

      // Step 4: Get quote
      setCurrentStep("getting_quote");
      log("Fetching SplitNOW quote (SOL→SOL, floating_rate)...");

      try {
        const quoteData = await splitnowCall("quote", {
          fromAmount: sendAmount,
          fromAssetId: "sol",
          fromNetworkId: "solana",
          toAssetId: "sol",
          toNetworkId: "solana",
          type: "floating_rate",
        });
        update({ quote: quoteData });
        const quoteId = quoteData?.quoteId;
        log(`Quote received (ID: ${quoteId})`);

        // Step 5: Create order
        setCurrentStep("creating_order");
        log(`Creating order routed through ${selectedCex}...`);

        const orderOutputs = [
          {
            toAddress: newAddr,
            toAssetId: "sol",
            toNetworkId: "solana",
            toPctBips: 10000,
            toExchangerId: selectedCex,
          },
        ];

        const orderData = await splitnowCall("order", {
          quoteId,
          fromAmount: sendAmount,
          fromAssetId: "sol",
          fromNetworkId: "solana",
          orderOutputs,
          type: "floating_rate",
        });

        update({ order: orderData });
        orderId = orderData?.shortId;

        depositAddress =
          orderData?.depositWalletAddress ||
          orderData?.orderInput?.depositWalletAddress ||
          newAddr;
        depositAmount = Number(
          orderData?.orderInput?.fromAmount || sendAmount
        );

        log(`Order created (ID: ${orderId})`);
        log(`Deposit address: ${depositAddress}`);
        log(`Deposit amount: ${depositAmount} SOL`);
      } catch (quoteErr: any) {
        usedDirectFallback = true;
        setCurrentStep("creating_order");
        update({
          quote: null,
          order: null,
          orderStatus: "fallback_direct_transfer",
          orderStatusText: "SplitNOW unavailable, using direct transfer fallback",
        });
        log(`SplitNOW error: ${quoteErr.message}`);
        log("Falling back to a direct transfer to the new wallet.");
        depositAddress = newAddr;
        depositAmount = sendAmount;
      }

      // Step 6: Send SOL
      setCurrentStep("sending_sol");
      log(`Signing and sending SOL to ${usedDirectFallback ? "new wallet" : "deposit address"}...`);
      const signer = getWalletSigner(activeWallet.address);
      if (!signer) throw new Error("Cannot find wallet signer for active wallet");

      const sendLamports = Math.floor(Number(depositAmount) * LAMPORTS_PER_SOL);
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

      // Step 7: Poll order status
      setCurrentStep("polling_status");

      if (usedDirectFallback || !orderId) {
        update({ orderStatus: "skipped", orderStatusText: "Direct transfer fallback used" });
        log("Skipping CEX processing (direct transfer fallback).");
      } else {
        log("Polling order status...");
        let finalStatus = "pending";
        let statusText = "Waiting...";
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusData = await splitnowCall("status", { orderId });
          finalStatus = statusData?.statusShort || statusData?.status || "pending";
          statusText = statusData?.statusText || finalStatus;
          update({ orderStatus: finalStatus, orderStatusText: statusText });
          log(`Status: ${statusText} (${finalStatus})`);

          if (finalStatus === "completed" || finalStatus === "done") break;
          if (finalStatus === "failed" || finalStatus === "expired" || finalStatus === "error") {
            throw new Error(`Order ${finalStatus}: ${statusText}`);
          }
        }
      }

      // Step 8: Switch wallet
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
  }, [activeWallet, running, rpcUrl, wallets, createNewWallet, switchWallet, hideWallet, checkLaunches, splitnowCall, getWalletSigner, log, update, state.minDeposit]);

  const reset = useCallback(() => {
    setState(initial);
    setRunning(false);
  }, []);

  return {
    state,
    running,
    loadExchangers,
    previewQuote,
    startRotation,
    reset,
    checkLaunches,
  };
}
