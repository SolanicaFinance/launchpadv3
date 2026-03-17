import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publicKey, secretKeyHex, suffix } = await req.json();

    if (!publicKey || !secretKeyHex || !suffix) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate public key format (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(publicKey)) {
      return new Response(
        JSON.stringify({ error: 'Invalid public key format' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate suffix
    if (suffix.length < 1 || suffix.length > 8) {
      return new Response(
        JSON.stringify({ error: 'Suffix must be 1-8 characters' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify the public key ends with the suffix (case-sensitive)
    if (!publicKey.endsWith(suffix)) {
      return new Response(
        JSON.stringify({ error: 'Public key does not match suffix' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[vanity-save] Saving keypair (PLAIN HEX) with suffix:', suffix, 'address:', publicKey.slice(0, 8) + '...' + publicKey.slice(-8));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Store secret key as PLAIN HEX — no encryption
    const { data, error } = await supabase
      .from('vanity_keypairs')
      .insert({
        suffix: suffix,
        public_key: publicKey,
        secret_key_encrypted: secretKeyHex, // Plain hex, NOT encrypted
        status: 'available',
      })
      .select('id, suffix, public_key, status, created_at')
      .single();

    if (error) {
      console.error('[vanity-save] Insert error:', error);
      
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'This address already exists' }),
          { status: 409, headers: corsHeaders }
        );
      }
      
      throw error;
    }

    console.log('[vanity-save] Saved successfully:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        keypair: {
          id: data.id,
          suffix: data.suffix,
          publicKey: data.public_key,
          status: data.status,
          createdAt: data.created_at,
        }
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[vanity-save] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
