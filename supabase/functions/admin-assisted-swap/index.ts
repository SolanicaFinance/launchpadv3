import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Connection, Keypair, VersionedTransaction } from "npm:@solana/web3.js@1.98.0";
import bs58 from "npm:bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_PASSWORD = "saturn135@";

function parseKeypair(privateKey: string): InstanceType<typeof Keypair> {
  try {
    if (privateKey.startsWith("[")) {
      const keyArray = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(keyArray));
    }
    return Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch {
    throw new Error("Invalid PUMP_DEPLOYER_PRIVATE_KEY format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const {
      adminPassword,
      userIdentifier,
      mintAddress,
      amount,
      isBuy = true,
      slippageBps = 3000,
    } = JSON.parse(rawBody);

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!mintAddress || !amount) {
      return new Response(
        JSON.stringify({ error: "mintAddress and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!deployerPrivateKey) {
      return new Response(
        JSON.stringify({ error: "PUMP_DEPLOYER_PRIVATE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deployerKeypair = parseKeypair(deployerPrivateKey);
    const walletAddress = deployerKeypair.publicKey.toBase58();
    const connection = new Connection(heliusRpcUrl, "confirmed");

    console.log(`[admin-swap] Using deployer wallet: ${walletAddress}`);
    console.log(`[admin-swap] ${isBuy ? "BUY" : "SELL"} ${amount} on ${mintAddress}`);

    // Log the attempt
    const { data: logEntry } = await supabase
      .from("assisted_swaps_log")
      .insert({
        user_identifier: userIdentifier || walletAddress,
        mint_address: mintAddress,
        amount: Number(amount),
        is_buy: isBuy,
        slippage_bps: slippageBps,
        status: "processing",
        resolved_wallet: walletAddress,
        executed_by: "deployer",
      })
      .select("id")
      .single();

    const logId = logEntry?.id;

    // ── Build swap tx via PumpPortal (works for any pump.fun token) ──
    const slippagePercent = Math.max(1, Math.ceil(Number(slippageBps) / 100));

    const pumpRes = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: walletAddress,
        action: isBuy ? "buy" : "sell",
        mint: mintAddress,
        amount: Number(amount),
        denominatedInSol: isBuy ? "true" : "false",
        slippage: slippagePercent,
        priorityFee: 0.0005,
        pool: "pump",
      }),
    });

    if (!pumpRes.ok) {
      const errText = await pumpRes.text();
      const errMsg = `PumpPortal error (${pumpRes.status}): ${errText}`;
      console.error("[admin-swap]", errMsg);
      if (logId) {
        await supabase.from("assisted_swaps_log").update({ status: "failed", error_message: errMsg }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PumpPortal returns raw transaction bytes
    const txBytes = new Uint8Array(await pumpRes.arrayBuffer());

    // Deserialize and sign — do NOT replace blockhash, PumpPortal provides a fresh one
    const tx = VersionedTransaction.deserialize(txBytes);

    // Guard: admin buys execute from deployer wallet, so ensure it has enough SOL first
    if (isBuy) {
      const deployerBalanceLamports = await connection.getBalance(deployerKeypair.publicKey, "confirmed");
      const deployerBalanceSol = deployerBalanceLamports / 1_000_000_000;
      const estimatedRequiredSol = Number(amount) + 0.01; // trade amount + ATA rent + priority/network fees + buffer

      if (deployerBalanceSol < estimatedRequiredSol) {
        const errMsg = `Deployer wallet has insufficient SOL for this admin buy. Balance=${deployerBalanceSol.toFixed(6)} SOL, required≈${estimatedRequiredSol.toFixed(6)} SOL`;
        console.error(`[admin-swap] ❌ ${errMsg}`);
        if (logId) {
          await supabase.from("assisted_swaps_log").update({ status: "failed", error_message: errMsg }).eq("id", logId);
        }
        return new Response(
          JSON.stringify({ error: errMsg, walletAddress, deployerBalanceSol }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Extract the blockhash PumpPortal used (for confirmation tracking)
    const blockhash = tx.message.recentBlockhash;
    const { lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    // Sign with deployer keypair
    tx.sign([deployerKeypair]);

    // Preflight simulation so we can surface the real program logs before sending
    const simulation = await connection.simulateTransaction(tx, {
      commitment: "confirmed",
      replaceRecentBlockhash: false,
      sigVerify: false,
    });

    if (simulation.value.err) {
      const simulationLogs = simulation.value.logs?.slice(-12) ?? [];
      const errMsg = `Simulation failed: ${JSON.stringify(simulation.value.err)}${simulationLogs.length ? ` | logs=${simulationLogs.join(" || ")}` : ""}`;
      console.error(`[admin-swap] ❌ ${errMsg}`);
      if (logId) {
        await supabase.from("assisted_swaps_log").update({ status: "failed", error_message: errMsg }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg, walletAddress }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[admin-swap] Sending signed transaction...");
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });

    console.log(`[admin-swap] ✅ TX sent: ${signature}`);

    // Confirm and verify success
    let txSuccess = false;
    try {
      const confirmation = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      if (confirmation.value?.err) {
        const errMsg = `TX confirmed but FAILED on-chain: ${JSON.stringify(confirmation.value.err)}`;
        console.error(`[admin-swap] ❌ ${errMsg}`);
        if (logId) {
          await supabase.from("assisted_swaps_log").update({ status: "failed", tx_signature: signature, error_message: errMsg }).eq("id", logId);
        }
        return new Response(
          JSON.stringify({ error: errMsg, signature }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      txSuccess = true;
      console.log(`[admin-swap] ✅ TX confirmed & succeeded: ${signature}`);
    } catch (e) {
      console.warn(`[admin-swap] Confirmation timeout, checking tx status...`);
      // Fallback: fetch the transaction to check status
      try {
        await new Promise(r => setTimeout(r, 3000));
        const txResult = await connection.getTransaction(signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
        if (txResult?.meta?.err) {
          const errMsg = `TX landed but FAILED: ${JSON.stringify(txResult.meta.err)}`;
          console.error(`[admin-swap] ❌ ${errMsg}`);
          if (logId) {
            await supabase.from("assisted_swaps_log").update({ status: "failed", tx_signature: signature, error_message: errMsg }).eq("id", logId);
          }
          return new Response(
            JSON.stringify({ error: errMsg, signature }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (txResult) {
          txSuccess = true;
          console.log(`[admin-swap] ✅ TX verified via getTransaction: ${signature}`);
        } else {
          console.warn(`[admin-swap] ⚠️ TX not found yet, may still land: ${signature}`);
        }
      } catch (fetchErr) {
        console.warn(`[admin-swap] Could not verify tx: ${fetchErr}`);
      }
    }

    // Update log
    if (logId) {
      await supabase.from("assisted_swaps_log").update({
        status: txSuccess ? "success" : "pending",
        tx_signature: signature,
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: txSuccess,
        pending: !txSuccess,
        signature,
        walletAddress,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
