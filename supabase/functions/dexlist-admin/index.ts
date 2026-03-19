import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const MOD_PASSWORD = "mod135@";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, modPassword } = body;

    if (modPassword !== MOD_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "lookup") {
      const { mintAddress } = body;
      if (!mintAddress) {
        return new Response(JSON.stringify({ error: "mintAddress required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(
        `https://api.dexscreener.com/tokens/v1/solana/${mintAddress}`,
        { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } }
      );

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `DexScreener error: ${res.status}` }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pairs = await res.json();
      if (!Array.isArray(pairs) || pairs.length === 0) {
        return new Response(
          JSON.stringify({ error: "No pools found for this token", pairs: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sort by liquidity descending
      const sorted = pairs.sort(
        (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );

      const top = sorted[0];
      const tokenInfo = {
        name: top.baseToken?.name || "",
        ticker: top.baseToken?.symbol || "",
        image_url: top.info?.imageUrl || "",
        description: top.info?.description || "",
        website_url: top.info?.websites?.[0]?.url || "",
        twitter_url: top.info?.socials?.find((s: any) => s.type === "twitter")?.url || "",
        telegram_url: top.info?.socials?.find((s: any) => s.type === "telegram")?.url || "",
        discord_url: top.info?.socials?.find((s: any) => s.type === "discord")?.url || "",
      };

      const poolsList = sorted.slice(0, 10).map((p: any) => ({
        pairAddress: p.pairAddress,
        dexId: p.dexId,
        liquidity_usd: p.liquidity?.usd || 0,
        market_cap: p.marketCap || p.fdv || 0,
        volume_24h: p.volume?.h24 || 0,
        priceUsd: p.priceUsd || "0",
        quoteToken: p.quoteToken?.symbol || "SOL",
      }));

      return new Response(
        JSON.stringify({ tokenInfo, pools: poolsList }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { mintAddress, poolAddress, tokenInfo, maxLeverage } = body;
      const { data, error } = await supabase.from("dex_listed_tokens").upsert(
        {
          mint_address: mintAddress,
          pool_address: poolAddress,
          token_name: tokenInfo?.name,
          token_ticker: tokenInfo?.ticker,
          image_url: tokenInfo?.image_url,
          description: tokenInfo?.description,
          website_url: tokenInfo?.website_url,
          twitter_url: tokenInfo?.twitter_url,
          telegram_url: tokenInfo?.telegram_url,
          discord_url: tokenInfo?.discord_url,
          market_cap: tokenInfo?.market_cap,
          liquidity_usd: tokenInfo?.liquidity_usd,
          max_leverage: maxLeverage || 1,
          listed_by: "moderator",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "mint_address" }
      );

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { id, maxLeverage, isActive } = body;
      const updates: any = { updated_at: new Date().toISOString() };
      if (maxLeverage !== undefined) updates.max_leverage = maxLeverage;
      if (isActive !== undefined) updates.is_active = isActive;

      const { error } = await supabase
        .from("dex_listed_tokens")
        .update(updates)
        .eq("id", id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch") {
      const { data, error } = await supabase
        .from("dex_listed_tokens")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ tokens: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      const { id } = body;
      const { error } = await supabase
        .from("dex_listed_tokens")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[dexlist-admin] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
