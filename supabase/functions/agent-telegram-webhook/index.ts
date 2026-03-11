import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    username?: string;
    first_name?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// Send Telegram message
async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          reply_to_message_id: replyToMessageId,
          disable_web_page_preview: false,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[agent-telegram-webhook] Send failed:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[agent-telegram-webhook] Send error:", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET request for webhook verification
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        success: true,
        message: "Claw Agents Telegram webhook is active",
        command: "!saturntrade",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      "https://saturntrade.vercel.app";

    if (!botToken) {
      console.log("[agent-telegram-webhook] Bot token not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Bot not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const update: TelegramUpdate = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = message.text;

    // Check for !saturntrade command
    if (!text.toLowerCase().includes("!saturntrade")) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `[agent-telegram-webhook] Processing launch from @${message.from?.username || message.from?.id}`
    );

    const supabase = createClient(supabaseUrl, supabaseKey);

    const postId = `${message.chat.id}_${message.message_id}`;
    const postUrl = message.chat.username
      ? `https://t.me/${message.chat.username}/${message.message_id}`
      : null;
    const postAuthor = message.from?.username || message.from?.first_name || null;
    const postAuthorId = message.from?.id?.toString() || null;

    // Process the message
    const processResponse = await fetch(
      `${supabaseUrl}/functions/v1/agent-process-post`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "telegram",
          postId,
          postUrl,
          postAuthor,
          postAuthorId,
          content: text,
        }),
      }
    );

    const result = await processResponse.json();

    // Send reply
    if (result.success && result.mintAddress) {
      const replyText = `🐟 <b>Token Launched!</b>

<b>$${result.mintAddress?.slice(0, 8)}...</b> is now live on TUNA!

🔗 <a href="${result.tradeUrl}">Trade Now</a>
🔍 <a href="https://solscan.io/token/${result.mintAddress}">View on Solscan</a>

<i>Powered by TUNA Agents - You earn 80% of trading fees!</i>`;

      await sendTelegramMessage(
        botToken,
        message.chat.id,
        replyText,
        message.message_id
      );
    } else {
      const errorText = `❌ <b>Launch Failed</b>

${result.error || "Unknown error"}

<b>Required format:</b>
<code>!saturntrade
name: Token Name
symbol: TICKER
wallet: YourSolanaAddress...
description: Optional description
image: https://example.com/logo.png</code>`;

      await sendTelegramMessage(
        botToken,
        message.chat.id,
        errorText,
        message.message_id
      );
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        mintAddress: result.mintAddress,
        error: result.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agent-telegram-webhook] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
