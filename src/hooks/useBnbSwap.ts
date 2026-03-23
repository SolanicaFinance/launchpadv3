import { useState, useCallback } from "react";
import { useAuthorizationSignature, usePrivy } from "@privy-io/react-auth";
import { supabase } from "@/integrations/supabase/client";

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
  const { generateAuthorizationSignature } = useAuthorizationSignature();

  const executeBnbSwap = useCallback(async (
    tokenAddress: string,
    action: "buy" | "sell",
    amount: number,
    userWallet: string,
    slippage = 3,
  ): Promise<BnbSwapResult> => {
    setIsLoading(true);
    try {
      const baseBody = {
        tokenAddress,
        action,
        amount: amount.toString(),
        userWallet,
        privyUserId: user?.id || undefined,
        slippage,
      };

      let data: any;
      let error: any;

      if (action === "buy") {
        const prepareResponse = await supabase.functions.invoke("bnb-swap", {
          body: {
            ...baseBody,
            mode: "prepare",
          },
        });

        if (prepareResponse.error) throw new Error(prepareResponse.error.message || "Swap failed");

        const preparedData = prepareResponse.data;
        if (preparedData?.requiresAuthorizationSignature && preparedData?.signaturePayload && preparedData?.preparedExecution) {
          const clientAuthorizationSignature = await generateAuthorizationSignature(preparedData.signaturePayload);

          ({ data, error } = await supabase.functions.invoke("bnb-swap", {
            body: {
              ...baseBody,
              mode: "execute",
              preparedExecution: preparedData.preparedExecution,
              clientAuthorizationSignature,
            },
          }));
        } else {
          data = preparedData;
          error = prepareResponse.error;
        }
      } else {
        ({ data, error } = await supabase.functions.invoke("bnb-swap", {
          body: baseBody,
        }));
      }

      if (error) throw new Error(error.message || "Swap failed");
      if (!data?.success) throw new Error(data?.error || "Swap failed");

      return {
        success: true,
        txHash: data.txHash,
        explorerUrl: data.explorerUrl,
        route: data.route,
        estimatedOutput: data.estimatedOutput,
      };
    } catch (err: any) {
      // Parse structured error from edge function
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
  }, [generateAuthorizationSignature, user?.id]);

  return { executeBnbSwap, isLoading };
}
