// DISABLED — ${BRAND.twitterHandle} promo mention reply fully suspended
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ success: true, message: "Promo mention reply is disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
