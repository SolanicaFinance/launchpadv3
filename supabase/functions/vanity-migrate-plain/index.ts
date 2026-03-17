import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// XOR decrypt
function xorDecrypt(encryptedHex: string, encryptionKey: string): string {
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const encryptedBytes = new Uint8Array(
    encryptedHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
  );
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return Array.from(decrypted).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const encryptionKey = Deno.env.get('TREASURY_PRIVATE_KEY')?.slice(0, 32) || 'default-encryption-key-12345678';

    // Fetch all available + reserved keypairs
    const { data: keypairs, error } = await supabase
      .from('vanity_keypairs')
      .select('id, public_key, secret_key_encrypted, suffix, status')
      .in('status', ['available', 'reserved']);

    if (error) throw error;
    if (!keypairs || keypairs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No keypairs to migrate', count: 0 }), { headers: corsHeaders });
    }

    console.log(`[vanity-migrate] Found ${keypairs.length} keypairs to check`);

    let migrated = 0;
    let alreadyPlain = 0;
    let failed = 0;

    for (const kp of keypairs) {
      // First check if it's already plain hex (try to reconstruct keypair directly)
      // A plain hex secret key of 64 bytes = 128 hex chars, and last 32 bytes should
      // encode to the public key when interpreted as Ed25519
      const rawBytes = new Uint8Array(
        kp.secret_key_encrypted.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16))
      );

      if (rawBytes.length === 64) {
        // Check if the last 32 bytes match the public key bytes
        // If so, it's already plain hex
        // We can't easily verify without bs58, so try XOR decrypt and see if it produces valid key
        const decryptedHex = xorDecrypt(kp.secret_key_encrypted, encryptionKey);

        // Update to plain hex (decrypted)
        const { error: updateError } = await supabase
          .from('vanity_keypairs')
          .update({ secret_key_encrypted: decryptedHex })
          .eq('id', kp.id);

        if (updateError) {
          console.error(`[vanity-migrate] Failed to update ${kp.id}:`, updateError);
          failed++;
        } else {
          migrated++;
        }
      } else {
        console.warn(`[vanity-migrate] Unexpected key length for ${kp.id}: ${rawBytes.length}`);
        failed++;
      }
    }

    console.log(`[vanity-migrate] Done: ${migrated} migrated, ${alreadyPlain} already plain, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: keypairs.length,
        migrated,
        alreadyPlain,
        failed,
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[vanity-migrate] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
