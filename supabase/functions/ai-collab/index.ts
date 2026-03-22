import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_MODELS = {
  gemini_pro: {
    model: "google/gemini-2.5-pro",
    name: "Gemini Pro",
    emoji: "🧠",
    personality: "You are a deep strategic thinker. You analyze ideas thoroughly, consider long-term implications, find edge cases, and propose architecturally sound solutions. You value innovation but also practicality. You're direct and analytical.",
  },
  gpt5: {
    model: "openai/gpt-5",
    name: "GPT-5",
    emoji: "⚡",
    personality: "You are a creative powerhouse. You generate bold, unconventional ideas. You think outside the box and challenge assumptions. You're enthusiastic about disruptive concepts and always push for what's truly novel. You're articulate and persuasive.",
  },
  gemini_flash: {
    model: "google/gemini-3-flash-preview",
    name: "Gemini Flash",
    emoji: "🔥",
    personality: "You are a rapid-fire idea machine with strong technical instincts. You focus on feasibility, user experience, and go-to-market speed. You're pragmatic and always think about what can be built and shipped fast. You're witty and concise.",
  },
};

type AIRole = keyof typeof AI_MODELS;

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callAI(model: string, systemPrompt: string, messages: { role: string; content: string }[]) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "No response generated.";
}

async function saveMessage(supabase: any, sessionId: string, round: number, role: string, type: string, content: string, targetRole?: string) {
  await supabase.from("ai_collab_messages").insert({
    session_id: sessionId,
    round_number: round,
    role,
    message_type: type,
    content,
    target_role: targetRole || null,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { action, sessionId, task, userComment } = await req.json();

    // CREATE SESSION
    if (action === "create") {
      const { data: session, error } = await supabase
        .from("ai_collab_sessions")
        .insert({ title: task.slice(0, 100), initial_task: task })
        .select()
        .single();

      if (error) throw error;

      // Save the user's initial task
      await saveMessage(supabase, session.id, 0, "user", "task", task);

      return new Response(JSON.stringify({ success: true, session }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GENERATE IDEAS (one round)
    if (action === "generate") {
      // Get session
      const { data: session } = await supabase
        .from("ai_collab_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (!session) throw new Error("Session not found");

      const nextRound = session.current_round + 1;

      // Get all previous messages for context
      const { data: history } = await supabase
        .from("ai_collab_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      // Save user comment if provided
      if (userComment?.trim()) {
        await saveMessage(supabase, sessionId, nextRound, "user", "comment", userComment);
      }

      // Build context from history
      const contextMessages = (history || []).map((m: any) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: `[${m.role.toUpperCase()} - Round ${m.round_number} - ${m.message_type}]: ${m.content}`,
      }));

      // Add user comment to context if present
      if (userComment?.trim()) {
        contextMessages.push({
          role: "user",
          content: `[USER FEEDBACK - Round ${nextRound}]: ${userComment}`,
        });
      }

      const results: Record<string, any> = {};

      // Step 1: Each AI generates ideas independently
      const ideaPromises = Object.entries(AI_MODELS).map(async ([role, config]) => {
        const systemPrompt = `${config.personality}

You are ${config.name} ${config.emoji}, one of 3 AI collaborators working on a Bitcoin product innovation task. 

TASK: ${session.initial_task}

This is Round ${nextRound}. Generate your unique ideas for this task. Be specific, actionable, and creative. 
Focus on Bitcoin ecosystem innovations. Think about DeFi, Layer 2s, Lightning Network, Ordinals, BRC-20, Runes, etc.
Keep your response under 500 words. Use bullet points for clarity.
${nextRound > 1 ? "Consider previous rounds of discussion and build upon or challenge earlier ideas." : ""}`;

        try {
          const content = await callAI(config.model, systemPrompt, contextMessages);
          await saveMessage(supabase, sessionId, nextRound, role, "idea", content);
          results[role] = { idea: content };
        } catch (err: any) {
          results[role] = { idea: `Error: ${err.message}`, error: true };
        }
      });

      await Promise.all(ideaPromises);

      // Step 2: Each AI reviews the other two AIs' ideas
      const reviewPromises = Object.entries(AI_MODELS).map(async ([role, config]) => {
        const otherAIs = Object.entries(AI_MODELS).filter(([r]) => r !== role);
        const otherIdeas = otherAIs
          .map(([r, c]) => `${c.name} ${c.emoji} proposed:\n${results[r]?.idea || "No idea generated"}`)
          .join("\n\n---\n\n");

        const reviewPrompt = `${config.personality}

You are ${config.name} ${config.emoji}. You just generated your own ideas for this Bitcoin product task.

YOUR IDEAS: ${results[role]?.idea || "Error generating"}

Now review the other AIs' ideas below. For each:
1. Rate it (🟢 Strong / 🟡 Decent / 🔴 Weak)
2. Explain WHY in 1-2 sentences
3. Suggest one improvement or combination with your own ideas

Keep total review under 300 words. Be honest but constructive.

OTHER AIs' IDEAS:
${otherIdeas}`;

        try {
          const content = await callAI(config.model, reviewPrompt, []);
          await saveMessage(supabase, sessionId, nextRound, role, "review", content);
          results[role].review = content;
        } catch (err: any) {
          results[role].review = `Error: ${err.message}`;
        }
      });

      await Promise.all(reviewPromises);

      // Update session round
      await supabase
        .from("ai_collab_sessions")
        .update({ current_round: nextRound, updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      return new Response(JSON.stringify({ success: true, round: nextRound, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET SESSION HISTORY
    if (action === "history") {
      const { data: session } = await supabase
        .from("ai_collab_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      const { data: messages } = await supabase
        .from("ai_collab_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      return new Response(JSON.stringify({ success: true, session, messages }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LIST SESSIONS
    if (action === "list") {
      const { data: sessions } = await supabase
        .from("ai_collab_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ success: true, sessions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GENERATE FINAL SUMMARY
    if (action === "finalize") {
      const { data: messages } = await supabase
        .from("ai_collab_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      const { data: session } = await supabase
        .from("ai_collab_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      const fullContext = (messages || [])
        .map((m: any) => `[${m.role} - R${m.round_number} - ${m.message_type}]: ${m.content}`)
        .join("\n\n");

      const finalPrompt = `You are a senior product architect. You've observed a multi-AI collaboration session about building a Bitcoin product.

ORIGINAL TASK: ${session?.initial_task}

Here is the FULL conversation across ${session?.current_round} rounds between 3 AIs (Gemini Pro, GPT-5, Gemini Flash) and the user:

${fullContext}

Now synthesize the BEST ideas from all rounds into a clear, actionable product specification that can be sent to a development team. Include:
1. **Product Name & Tagline**
2. **Problem Statement**
3. **Solution Overview** 
4. **Key Features** (prioritized list)
5. **Technical Architecture** (high level)
6. **Bitcoin Integration Details**
7. **MVP Scope** (what to build first)
8. **Unique Selling Points**

Be specific and actionable. This spec should be ready to hand off to developers.`;

      const finalContent = await callAI("google/gemini-2.5-pro", finalPrompt, []);
      await saveMessage(supabase, sessionId, (session?.current_round || 0) + 1, "system", "final", finalContent);

      await supabase
        .from("ai_collab_sessions")
        .update({ status: "finalized", updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      return new Response(JSON.stringify({ success: true, finalSpec: finalContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("[ai-collab] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    const status = msg === "RATE_LIMITED" ? 429 : msg === "CREDITS_EXHAUSTED" ? 402 : 500;
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
