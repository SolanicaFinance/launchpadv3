import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction 
} from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury wallet address
const TREASURY_ADDRESS = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Minimum balance to attempt recovery (covers tx fee ~0.000005 SOL)
const MIN_RECOVERY_SOL = 0.001;
const TX_FEE_LAMPORTS = 5000; // ~0.000005 SOL

// AES-256-GCM decryption using Web Crypto API
async function decryptPrivateKey(encryptedData: string, encryptionKey: string): Promise<Uint8Array> {
  // Format: base64(iv:ciphertext:tag) or just the encrypted blob
  const decoded = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // First 12 bytes are IV, last 16 bytes are auth tag (GCM), middle is ciphertext
  const iv = decoded.slice(0, 12);
  const ciphertext = decoded.slice(12);
  
  // Derive key from encryption key string
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(encryptionKey.padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    ciphertext
  );
  
  return new Uint8Array(decrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const rpcUrl = Deno.env.get("HELIUS_RPC_URL");
    const encryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    
    if (!rpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }
    if (!encryptionKey) {
      throw new Error("API_ENCRYPTION_KEY not configured");
    }

    // Fetch all deployer wallets that haven't been reclaimed and have balance
    const { data: wallets, error: fetchError } = await supabase
      .from("deployer_wallets")
      .select("*")
      .is("reclaimed_at", null)
      .gt("remaining_sol", MIN_RECOVERY_SOL);

    if (fetchError) {
      throw new Error(`Failed to fetch wallets: ${fetchError.message}`);
    }

    if (!wallets || wallets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "No wallets with recoverable balance",
        reclaimed: 0,
        totalRecovered: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[deployer-dust-reclaim] Processing ${wallets.length} wallets...`);

    const connection = new Connection(rpcUrl, "confirmed");
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
    
    const results: Array<{
      wallet_address: string;
      recovered_sol: number;
      signature: string | null;
      error: string | null;
    }> = [];

    let totalRecovered = 0;

    for (const wallet of wallets) {
      try {
        // Decrypt the private key
        const secretKeyBytes = await decryptPrivateKey(wallet.encrypted_private_key, encryptionKey);
        const keypair = Keypair.fromSecretKey(secretKeyBytes);
        
        // Verify public key matches
        if (keypair.publicKey.toBase58() !== wallet.wallet_address) {
          throw new Error("Decrypted key does not match wallet address");
        }

        // Get current balance
        const balance = await connection.getBalance(keypair.publicKey);
        
        if (balance <= TX_FEE_LAMPORTS) {
          console.log(`[deployer-dust-reclaim] Wallet ${wallet.wallet_address} has insufficient balance: ${balance / LAMPORTS_PER_SOL} SOL`);
          results.push({
            wallet_address: wallet.wallet_address,
            recovered_sol: 0,
            signature: null,
            error: "Insufficient balance for tx fee",
          });
          continue;
        }

        // Transfer all minus tx fee
        const transferAmount = balance - TX_FEE_LAMPORTS;
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: treasuryPubkey,
            lamports: transferAmount,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;

        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [keypair],
          { commitment: "confirmed" }
        );

        const recoveredSol = transferAmount / LAMPORTS_PER_SOL;
        totalRecovered += recoveredSol;

        // Mark as reclaimed in database
        await supabase
          .from("deployer_wallets")
          .update({ 
            reclaimed_at: new Date().toISOString(),
            remaining_sol: 0,
          })
          .eq("id", wallet.id);

        console.log(`[deployer-dust-reclaim] Recovered ${recoveredSol.toFixed(6)} SOL from ${wallet.wallet_address} (tx: ${signature.slice(0, 16)}...)`);

        results.push({
          wallet_address: wallet.wallet_address,
          recovered_sol: recoveredSol,
          signature,
          error: null,
        });

      } catch (walletError) {
        const errorMsg = walletError instanceof Error ? walletError.message : "Unknown error";
        console.error(`[deployer-dust-reclaim] Failed for ${wallet.wallet_address}:`, errorMsg);
        results.push({
          wallet_address: wallet.wallet_address,
          recovered_sol: 0,
          signature: null,
          error: errorMsg,
        });
      }
    }

    const successCount = results.filter(r => r.signature).length;

    console.log(`[deployer-dust-reclaim] Completed: ${successCount}/${wallets.length} wallets, ${totalRecovered.toFixed(6)} SOL total`);

    return new Response(JSON.stringify({
      success: true,
      processed: wallets.length,
      reclaimed: successCount,
      totalRecovered: parseFloat(totalRecovered.toFixed(6)),
      results,
      reclaimedAt: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[deployer-dust-reclaim] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
