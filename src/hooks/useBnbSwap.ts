import { useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";

interface BnbSwapResult {
  success: boolean;
  txHash?: string;
  error?: string;
  explorerUrl?: string;
  route?: string;
  reason?: string;
  estimatedOutput?: string;
}

export function useBnbSwap() {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = usePrivy();
  const { wallet: evmWallet } = usePrivyEvmWallet();

  const executeBnbSwap = useCallback(async (
    tokenAddress: string,
    action: "buy" | "sell",
    amount: number,
    userWallet: string,
    slippage = 3,
  ): Promise<BnbSwapResult> => {
    setIsLoading(true);
    try {
      // Step 1: Ask edge function to BUILD the unsigned transaction
      const buildBody = {
        tokenAddress,
        action,
        amount: amount.toString(),
        userWallet,
        privyUserId: user?.id || undefined,
        slippage,
        mode: "build",
      };

      const { data: buildData, error: buildError } = await supabase.functions.invoke("bnb-swap", {
        body: buildBody,
      });

      if (buildError) throw new Error(buildError.message || "Build failed");
      if (!buildData?.success) throw new Error(buildData?.error || "Build failed");

      const { txParams, approveTx, route, estimatedOutput, walletAddress } = buildData;

      if (!txParams) throw new Error("No transaction params returned");

      // Step 2: Get provider from Privy embedded EVM wallet
      if (!evmWallet) throw new Error("EVM wallet not available. Please try again.");

      const provider = await (evmWallet as any).getEthereumProvider();
      if (!provider) throw new Error("Could not get wallet provider");

      // Ensure we're on BSC (chain ID 56 = 0x38)
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      } catch (switchErr: any) {
        // If BSC not added, try adding it
        if (switchErr?.code === 4902) {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x38",
              chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-dataseed.binance.org"],
              blockExplorerUrls: ["https://bscscan.com"],
            }],
          });
        }
      }

      // Step 3: If approval needed, send approve tx first
      if (approveTx) {
        console.log("[bnb-swap] Sending approval tx...");
        const approveTxHash = await provider.request({
          method: "eth_sendTransaction",
          params: [{
            from: walletAddress,
            to: approveTx.to,
            data: approveTx.data,
            value: approveTx.value || "0x0",
          }],
        });
        console.log("[bnb-swap] Approval tx:", approveTxHash);

        // Wait for approval to confirm
        await waitForTx(provider, approveTxHash);
      }

      // Step 4: Send the main swap transaction via client wallet
      console.log("[bnb-swap] Sending swap tx via client wallet...");
      const txHash = await provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: txParams.to,
          data: txParams.data,
          value: txParams.value || "0x0",
          gas: txParams.gas,
        }],
      });

      console.log("[bnb-swap] Swap tx sent:", txHash);

      // Step 5: Record trade in background
      supabase.functions.invoke("bnb-swap", {
        body: {
          tokenAddress,
          action,
          amount: amount.toString(),
          userWallet,
          privyUserId: user?.id || undefined,
          mode: "record",
          txHash,
        },
      }).catch(() => {});

      return {
        success: true,
        txHash,
        explorerUrl: `https://bscscan.com/tx/${txHash}`,
        route: route || "unknown",
        estimatedOutput: estimatedOutput || "0",
      };
    } catch (err: any) {
      let errorMsg = err?.message || "Unknown error";
      let route: string | undefined;
      let reason: string | undefined;

      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed?.error) {
          errorMsg = parsed.error;
          route = parsed.route;
          reason = parsed.reason;
        }
      } catch { /* not JSON */ }

      return {
        success: false,
        error: errorMsg,
        route,
        reason,
      };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, evmWallet]);

  return { executeBnbSwap, isLoading };
}

// Simple poll-based tx receipt wait
async function waitForTx(provider: any, txHash: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt) return;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
}
