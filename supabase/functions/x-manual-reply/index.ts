// DISABLED — @saturntrade manual reply fully suspended
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ success: true, message: "Manual reply is disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
