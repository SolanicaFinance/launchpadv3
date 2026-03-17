import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nacl from 'https://esm.sh/tweetnacl@1.0.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: keys, error } = await supabase
      .from('vanity_keypairs')
      .select('id, public_key, secret_key_encrypted, suffix, status')
      .in('status', ['available', 'reserved'])
      .limit(5);

    if (error) throw error;

    const results = [];

    for (const key of (keys || [])) {
      const secretHex = key.secret_key_encrypted;
      const expectedPubkey = key.public_key;
      
      const secretBytes = hexToBytes(secretHex);
      const seedBytes = secretBytes.slice(0, 32);
      const embeddedPubkeyBytes = secretBytes.slice(32, 64);
      const embeddedPubkey = base58Encode(embeddedPubkeyBytes);
      
      // Use tweetnacl to derive the actual public key from the seed
      const naclKeypair = nacl.sign.keyPair.fromSeed(seedBytes);
      const derivedPubkey = base58Encode(naclKeypair.publicKey);
      
      // Also try fromSecretKey (which expects [seed+pubkey] format)
      let fromSecretKeyPubkey = 'n/a';
      try {
        const naclKeypair2 = nacl.sign.keyPair.fromSecretKey(secretBytes);
        fromSecretKeyPubkey = base58Encode(naclKeypair2.publicKey);
      } catch (e) {
        fromSecretKeyPubkey = `error: ${e.message}`;
      }

      results.push({
        id: key.id,
        suffix: key.suffix,
        status: key.status,
        expectedPubkey,
        embeddedPubkey,
        derivedFromSeed: derivedPubkey,
        fromSecretKey: fromSecretKeyPubkey,
        embeddedMatchesExpected: embeddedPubkey === expectedPubkey,
        derivedMatchesExpected: derivedPubkey === expectedPubkey,
        derivedMatchesEmbedded: derivedPubkey === embeddedPubkey,
      });
    }

    return new Response(
      JSON.stringify({ results, count: results.length }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[vanity-validate] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
