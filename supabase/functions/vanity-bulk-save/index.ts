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
    const { keypairs } = await req.json();

    if (!Array.isArray(keypairs) || keypairs.length === 0) {
      return new Response(
        JSON.stringify({ error: 'keypairs must be a non-empty array of {publicKey, secretKeyHex, suffix}' }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (keypairs.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Max 500 keypairs per request' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let saved = 0;
    let duplicates = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Insert in batches of 50
    const batchSize = 50;
    for (let i = 0; i < keypairs.length; i += batchSize) {
      const batch = keypairs.slice(i, i + batchSize);
      
      const rows = batch
        .filter((kp: any) => kp.publicKey && kp.secretKeyHex && kp.suffix)
        .filter((kp: any) => kp.publicKey.endsWith(kp.suffix))
        .map((kp: any) => ({
          suffix: kp.suffix,
          public_key: kp.publicKey,
          secret_key_encrypted: kp.secretKeyHex,
          status: 'available',
        }));

      if (rows.length === 0) continue;

      const { data, error } = await supabase
        .from('vanity_keypairs')
        .upsert(rows, { onConflict: 'public_key', ignoreDuplicates: true })
        .select('id');

      if (error) {
        errors += rows.length;
        errorDetails.push(error.message);
      } else {
        saved += data?.length || 0;
        duplicates += rows.length - (data?.length || 0);
      }
    }

    console.log(`[vanity-bulk-save] Saved: ${saved}, Duplicates: ${duplicates}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, saved, duplicates, errors, total: keypairs.length, errorDetails }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[vanity-bulk-save] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
