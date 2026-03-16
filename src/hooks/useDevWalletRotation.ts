/**
 * Dev Wallet Rotation Hook
 *
 * Orchestrates the full CEX-routed wallet rotation flow per SplitNow SDK docs:
 * 
 * Step 1: createAndFetchQuote → returns quoteId + rates[] per exchange
 * Step 2: createAndFetchOrder → returns depositAddress, depositAmount, orderId
 * Step 3: Send SOL to depositAddress
 * Step 4: getOrderStatus → poll until completed
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

export interface ExchangeRate {
  exchangerId: string;
  exchangerName: string;
  exchangeRate: number;
  estimatedReceive: number;
  eta: number;
  available: boolean;
}

export type RotationStep =
  | "idle"
  | "loading_data"
  | "selecting_cex"
  | "checking_launches"
  | "creating_wallet"
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
  rates: ExchangeRate[];
  quoteId: string | null;
  launchCount: number;
  newWalletAddress: string | null;
  selectedCex: string | null;
  balance: number;
  sendAmount: number;
  quote: any | null;
  order: any | null;
  depositAddress: string | null;
  depositAmount: number | null;
  orderId: string | null;
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
  rates: [],
  quoteId: null,
  launchCount: 0,
  newWalletAddress: null,
  selectedCex: null,
  balance: 0,
  sendAmount: 0,
  quote: null,
  order: null,
  depositAddress: null,
  depositAmount: null,
  orderId: null,
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

  /**
   * Load all data needed for the selection screen:
   * - Exchangers list
   * - SOL deposit limits
   * - Wallet balance
   * - Quote with per-exchange rates
   */
  const loadData = useCallback(async () => {
    if (!activeWallet?.address) {
      update({ step: "error", error: "No active wallet found. Please connect a wallet first." });
      return;
    }

    update({ step: "loading_data", error: null });
    try {
      // Fire wallet pre-creation in background (don't block data loading)
      const walletPromise = (async () => {
        try {
          const addr = await createNewWallet();
          if (addr) update({ newWalletAddress: addr });
          return addr;
        } catch (e) {
          console.warn("[WalletRotation] Pre-create wallet failed, will retry later:", e);
          return null;
        }
      })();

      // Fetch exchangers, limits, and balance in parallel
      const [exchangersData, limitsData, balLamports] = await Promise.all([
        splitnowCall("exchangers"),
        splitnowCall("limits"),
        new Connection(rpcUrl, "confirmed").getBalance(new PublicKey(activeWallet.address)),
      ]);

      const available: Exchanger[] = (exchangersData?.exchangers || [])
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
      const balSol = balLamports / LAMPORTS_PER_SOL;
      const sendAmt = Math.max(0, balSol - 0.005);
      const minDep = solLimits?.minDeposit ?? 0.05;
      const maxDep = solLimits?.maxDeposit ?? null;

      update({
        exchangers: available,
        balance: balSol,
        sendAmount: sendAmt,
        minDeposit: minDep,
        maxDeposit: maxDep,
        newWalletAddress: newAddr,
      });

      // Now fetch quote to get per-exchange rates
      if (sendAmt >= minDep) {
        try {
          const quoteData = await splitnowCall("quote", {
            fromAmount: sendAmt,
            fromAssetId: "sol",
            fromNetworkId: "solana",
            toAssetId: "sol",
            toNetworkId: "solana",
            type: "floating_rate",
          });

          // Parse rates from quoteLegs or rates array
          const rawRates = quoteData?.rates || quoteData?.quoteLegs || [];
          const rates: ExchangeRate[] = rawRates.map((r: any) => {
            const exchanger = available.find((e) => e.id === r.exchangerId);
            return {
              exchangerId: r.exchangerId || r.toExchangerId,
              exchangerName: exchanger?.name || r.exchangerId || "Unknown",
              exchangeRate: Number(r.exchangeRate || r.rate || 0),
              estimatedReceive: Number(r.toAmount || (sendAmt * (r.exchangeRate || r.rate || 1))),
              eta: exchanger?.eta || r.eta || 0,
              available: (r.exchangeRate || r.rate || 0) > 0,
            };
          });

          update({
            step: "selecting_cex",
            quoteId: quoteData?.quoteId,
            quote: quoteData,
            rates,
          });
        } catch (quoteErr: any) {
          // Quote failed but we can still show exchanges without rates
          console.warn("[WalletRotation] Quote failed, showing exchanges without rates:", quoteErr);
          update({ step: "selecting_cex", rates: [] });
        }
      } else {
        update({ step: "selecting_cex" });
      }
    } catch (err: any) {
      update({ step: "error", error: err.message || "Failed to load exchange data" });
    }
  }, [splitnowCall, update, rpcUrl, activeWallet, createNewWallet]);

  /** Run the full rotation flow with a user-selected CEX */
  const startRotation = useCallback(async (selectedCex: string) => {
    if (!activeWallet?.address || running) return;
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
      order: null,
      depositAddress: null,
      depositAmount: null,
      orderId: null,
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

      // Step 3: Create order via SplitNow
      // SDK: createAndFetchOrder({ quoteId, fromAmount, fromAssetId, fromNetworkId, walletDistributions })
      // Returns: { depositAddress, depositAmount, orderId }
      setCurrentStep("creating_order");
      
      const sendAmount = state.sendAmount;
      let depositAddr = newAddr;
      let depositAmt = sendAmount;
      let usedDirectFallback = false;
      let orderIdStr: string | undefined;

      // Get fresh quote if we don't have one
      let quoteId = state.quoteId;
      if (!quoteId) {
        log("Fetching fresh quote...");
        try {
          const quoteData = await splitnowCall("quote", {
            fromAmount: sendAmount,
            fromAssetId: "sol",
            fromNetworkId: "solana",
            toAssetId: "sol",
            toNetworkId: "solana",
            type: "floating_rate",
          });
          quoteId = quoteData?.quoteId;
          update({ quoteId, quote: quoteData });
          log(`Quote received (ID: ${quoteId})`);
        } catch (quoteErr: any) {
          log(`Quote failed: ${quoteErr.message}`);
        }
      }

      if (quoteId) {
        log(`Creating order routed through ${selectedCex}...`);
        try {
          // SDK uses walletDistributions, raw API uses orderOutputs
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

          // SDK docs: order.depositAddress, order.depositAmount, order.orderId
          depositAddr = orderData?.depositAddress || orderData?.depositWalletAddress || newAddr;
          depositAmt = Number(orderData?.depositAmount || orderData?.orderInput?.fromAmount || sendAmount);
          orderIdStr = orderData?.orderId || orderData?.shortId;

          update({ depositAddress: depositAddr, depositAmount: depositAmt, orderId: orderIdStr || null });

          log(`Order created (ID: ${orderIdStr})`);
          log(`Deposit to: ${depositAddr}`);
          log(`Deposit amount: ${depositAmt} SOL`);
        } catch (orderErr: any) {
          usedDirectFallback = true;
          log(`Order failed: ${orderErr.message}`);
          log("Falling back to direct transfer to new wallet.");
          depositAddr = newAddr;
          depositAmt = sendAmount;
        }
      } else {
        usedDirectFallback = true;
        log("No quote available. Using direct transfer to new wallet.");
        depositAddr = newAddr;
        depositAmt = sendAmount;
      }

      // Step 4: Send SOL to deposit address
      setCurrentStep("sending_sol");
      const connection = new Connection(rpcUrl, "confirmed");
      log(`Sending ${depositAmt.toFixed(4)} SOL to ${usedDirectFallback ? "new wallet" : "deposit address"}...`);
      
      const signer = getWalletSigner(activeWallet.address);
      if (!signer) throw new Error("Cannot find wallet signer for active wallet");

      const sendLamports = Math.floor(Number(depositAmt) * LAMPORTS_PER_SOL);
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(activeWallet.address),
          toPubkey: new PublicKey(depositAddr),
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

      // Step 5: Poll order status
      // SDK docs: orderStatus.orderStatus === 'completed' means done
      // orderStatus.orderStatusText for human-readable, orderStatus.orderStatusShort for short
      setCurrentStep("polling_status");

      if (usedDirectFallback || !orderIdStr) {
        update({ orderStatus: "skipped", orderStatusText: "Direct transfer (no CEX routing)" });
        log("Skipping CEX polling (direct transfer fallback).");
      } else {
        log("Polling order status...");
        let finalStatus = "pending";
        let statusText = "Waiting...";
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusData = await splitnowCall("status", { orderId: orderIdStr });
          // SDK fields: orderStatus, orderStatusText, orderStatusShort
          finalStatus = statusData?.orderStatus || statusData?.status || "pending";
          statusText = statusData?.orderStatusText || statusData?.statusText || finalStatus;
          const statusShort = statusData?.orderStatusShort || statusData?.statusShort || "";
          update({ orderStatus: finalStatus, orderStatusText: statusText });
          log(`Status: ${statusShort || statusText} (${finalStatus})`);

          if (finalStatus === "completed") break;
          if (finalStatus === "failed" || finalStatus === "expired" || finalStatus === "error") {
            throw new Error(`Order ${finalStatus}: ${statusText}`);
          }
        }
      }

      // Step 6: Switch wallet
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
  }, [activeWallet, running, rpcUrl, wallets, createNewWallet, switchWallet, hideWallet, checkLaunches, splitnowCall, getWalletSigner, log, update, state.sendAmount, state.quoteId]);

  const reset = useCallback(() => {
    setState(initial);
    setRunning(false);
  }, []);

  return {
    state,
    running,
    loadData,
    startRotation,
    reset,
    checkLaunches,
  };
}
