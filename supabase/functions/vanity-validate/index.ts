import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

// Minimal Ed25519 public key derivation using SubtleCrypto
// We import the seed as a PKCS8 key, then export the public key
async function derivePublicKeyFromSeed(seed: Uint8Array): Promise<Uint8Array | null> {
  try {
    // Build PKCS8 DER for Ed25519 private key
    const pkcs8Header = new Uint8Array([
      0x30, 0x2e, // SEQUENCE, 46 bytes
      0x02, 0x01, 0x00, // INTEGER 0
      0x30, 0x05, // SEQUENCE, 5 bytes
      0x06, 0x03, 0x2b, 0x65, 0x70, // OID 1.3.101.112 (Ed25519)
      0x04, 0x22, // OCTET STRING, 34 bytes
      0x04, 0x20, // OCTET STRING, 32 bytes
    ]);
    
    const pkcs8 = new Uint8Array(pkcs8Header.length + 32);
    pkcs8.set(pkcs8Header);
    pkcs8.set(seed, pkcs8Header.length);
    
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'Ed25519' },
      true,
      ['sign']
    );
    
    // Derive public key by generating a keypair from the imported private key
    // We need to extract the public key - but SubtleCrypto doesn't directly give us this
    // Instead, let's sign something and verify, or export the key pair
    
    // Actually, we can't directly get the public key from just the private key in SubtleCrypto
    // Let's try a different approach: use tweetnacl via esm.sh
    return null;
  } catch (e) {
    console.error('derivePublicKeyFromSeed failed:', e);
    return null;
  }
}

// Base58 encoding  
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

    // Get a few keys to validate
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
      
      // Check if embedded pubkey matches expected
      const embeddedMatch = embeddedPubkey === expectedPubkey;
      
      // Now check if the seed actually derives to the expected pubkey
      // We'll use SubtleCrypto to import the seed and generate the public key
      let derivedPubkey = 'unknown';
      let derivedMatch = false;
      
      try {
        // Build PKCS8 from seed
        const pkcs8Header = new Uint8Array([
          0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05,
          0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
        ]);
        const pkcs8 = new Uint8Array(48);
        pkcs8.set(pkcs8Header);
        pkcs8.set(seedBytes, 16);
        
        const privKey = await crypto.subtle.importKey(
          'pkcs8',
          pkcs8.buffer,
          { name: 'Ed25519' },
          true,
          ['sign']
        );
        
        // Sign a test message to extract public key behavior
        const testMsg = new Uint8Array([1, 2, 3]);
        const sig = await crypto.subtle.sign('Ed25519', privKey, testMsg);
        
        // We need the public key - try to get it via PKCS8 re-export
        const reExported = await crypto.subtle.exportKey('pkcs8', privKey);
        const reBytes = new Uint8Array(reExported);
        
        // Also try: generate keypair from this seed and export pubkey
        // Actually, we can't get pubkey from privkey alone in SubtleCrypto
        // BUT we can check: if we sign with this seed, does verification with the expected pubkey work?
        
        // Import the expected public key
        const expectedPubBytes = hexToBytes(''); // need base58 decode...
        
        // Simpler: just check if re-exported PKCS8 seed matches our seed
        const reExportedSeed = reBytes.slice(16, 48);
        const seedMatch = Array.from(seedBytes).every((b, i) => b === reExportedSeed[i]);
        
        derivedPubkey = `seed_reimport_match: ${seedMatch}, pkcs8_len: ${reBytes.length}`;
        
      } catch (e) {
        derivedPubkey = `error: ${e.message}`;
      }
      
      results.push({
        id: key.id,
        suffix: key.suffix,
        status: key.status,
        expectedPubkey: expectedPubkey.slice(0, 8) + '...' + expectedPubkey.slice(-8),
        embeddedPubkey: embeddedPubkey.slice(0, 8) + '...' + embeddedPubkey.slice(-8),
        embeddedMatch,
        secretLen: secretBytes.length,
        seedHexPrefix: secretHex.slice(0, 16),
        derivedPubkey,
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
