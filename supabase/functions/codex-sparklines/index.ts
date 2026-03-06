import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOLANA_NETWORK_ID = 1399811149;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CODEX_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "CODEX_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { addresses, networkId = SOLANA_NETWORK_ID } = await req.json();
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return new Response(
        JSON.stringify({ error: "addresses array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeNetworkId = Number(networkId) || SOLANA_NETWORK_ID;

    // Build token IDs in Codex format: "address:networkId"
    const ids = addresses.slice(0, 25).map((addr: string) => `${addr}:${safeNetworkId}`);
    const idsStr = ids.map((id: string) => `"${id}"`).join(", ");

    const query = `{
      tokenSparklines(input: {
        ids: [${idsStr}]
      }) {
        id
        sparkline {
          timestamp
          value
        }
      }
    }`;

    const response = await fetch("https://graph.codex.io/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Codex API error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Codex API error", status: response.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    const sparklines = result?.data?.tokenSparklines;

    if (!sparklines) {
      return new Response(
        JSON.stringify({ sparklines: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Flatten to { [address]: number[] }
    const output: Record<string, number[]> = {};
    for (const item of sparklines) {
      if (!item?.id || !item?.sparkline) continue;
      // id format is "address:networkId"
      const address = item.id.split(":")[0];
      output[address] = item.sparkline.map((p: { value: number }) => p.value);
    }

    return new Response(
      JSON.stringify({ sparklines: output }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("codex-sparklines error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
