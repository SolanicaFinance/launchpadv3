import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Browser session state (in-memory for this instance)
const browserSessions: Map<string, {
  currentUrl: string;
  pageTitle: string;
  lastAction: string;
  startedAt: string;
}> = new Map();

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const browserlessUrl = Deno.env.get("BROWSERLESS_URL");
    const browserlessToken = Deno.env.get("BROWSERLESS_TOKEN");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      agentId,
      action,
      url,
      selector,
      text,
      extractSchema,
      waitFor,
    } = await req.json();

    if (!agentId || !action) {
      return new Response(
        JSON.stringify({ error: "agentId and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action
    const validActions = ['navigate', 'click', 'type', 'screenshot', 'extract', 'close', 'wait'];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify agent exists and check permissions
    const { data: agent, error: agentError } = await supabase
      .from('opentuna_agents')
      .select('id, name, blocked_domains, total_fin_calls')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check domain blocking for navigate action
    if (action === 'navigate' && url) {
      try {
        const urlObj = new URL(url);
        const blockedDomains = agent.blocked_domains || [];
        if (blockedDomains.some((d: string) => urlObj.hostname.includes(d))) {
          return new Response(
            JSON.stringify({ error: `Domain blocked: ${urlObj.hostname}` }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const startTime = Date.now();
    let result: any = {};

    // Check if we have Browserless configured for real browser automation
    if (browserlessUrl && browserlessToken) {
      // Use Browserless.io for real browser automation
      result = await executeBrowserlessAction({
        browserlessUrl,
        browserlessToken,
        action,
        url,
        selector,
        text,
        extractSchema,
        waitFor,
        agentId,
      });
    } else {
      // Fallback to HTTP-based web interaction (fetch + cheerio-style parsing)
      result = await executeHttpAction({
        action,
        url,
        selector,
        text,
        extractSchema,
        agentId,
      });
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    await supabase.from('opentuna_fin_executions').insert({
      agent_id: agentId,
      fin_name: 'fin_browse',
      params: { action, url, selector },
      params_hash: await hashParams({ action, url, selector }),
      success: result.success,
      execution_time_ms: executionTime,
      result_summary: result.message || `${action} completed`,
    });

    // Update agent stats
    await supabase.from('opentuna_agents')
      .update({ 
        total_fin_calls: agent.total_fin_calls + 1,
        last_active_at: new Date().toISOString()
      })
      .eq('id', agentId);

    console.log(`[fin_browse] ${action} for agent ${agentId} (${executionTime}ms)`);

    return new Response(
      JSON.stringify({
        ...result,
        executionTimeMs: executionTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fin_browse error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Execute action via Browserless.io
async function executeBrowserlessAction(params: {
  browserlessUrl: string;
  browserlessToken: string;
  action: string;
  url?: string;
  selector?: string;
  text?: string;
  extractSchema?: any;
  waitFor?: number;
  agentId: string;
}): Promise<any> {
  const { browserlessUrl, browserlessToken, action, url, selector, text, extractSchema, waitFor, agentId } = params;

  // Build Puppeteer script to execute
  let script: string;

  switch (action) {
    case 'navigate':
      if (!url) throw new Error('URL required for navigate');
      script = `
        module.exports = async ({ page }) => {
          await page.goto('${url}', { waitUntil: 'networkidle2', timeout: 30000 });
          const title = await page.title();
          const content = await page.content();
          return { success: true, action: 'navigate', url: '${url}', title, contentLength: content.length };
        };
      `;
      break;

    case 'click':
      if (!selector) throw new Error('Selector required for click');
      script = `
        module.exports = async ({ page }) => {
          await page.waitForSelector('${selector}', { timeout: 10000 });
          await page.click('${selector}');
          return { success: true, action: 'click', selector: '${selector}', message: 'Clicked element' };
        };
      `;
      break;

    case 'type':
      if (!selector || !text) throw new Error('Selector and text required for type');
      script = `
        module.exports = async ({ page }) => {
          await page.waitForSelector('${selector}', { timeout: 10000 });
          await page.type('${selector}', '${text.replace(/'/g, "\\'")}');
          return { success: true, action: 'type', selector: '${selector}', textLength: ${text.length} };
        };
      `;
      break;

    case 'screenshot':
      script = `
        module.exports = async ({ page }) => {
          const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
          return { success: true, action: 'screenshot', screenshot, message: 'Screenshot captured' };
        };
      `;
      break;

    case 'extract':
      script = `
        module.exports = async ({ page }) => {
          const html = await page.content();
          const title = await page.title();
          const url = page.url();
          
          // Extract text content
          const text = await page.evaluate(() => document.body.innerText);
          
          // Extract links
          const links = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a[href]')).map(a => ({
              text: a.textContent?.trim(),
              href: a.href
            })).slice(0, 50)
          );
          
          return { 
            success: true, 
            action: 'extract', 
            title,
            url,
            textLength: text.length,
            links,
            message: 'Data extracted'
          };
        };
      `;
      break;

    default:
      return { success: false, action, message: 'Action not supported for Browserless' };
  }

  // Call Browserless function API
  const response = await fetch(`${browserlessUrl}/function?token=${browserlessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: script,
      context: {},
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Browserless error:', error);
    return { success: false, action, error: 'Browserless execution failed' };
  }

  return response.json();
}

// Fallback: Execute action via HTTP fetch
async function executeHttpAction(params: {
  action: string;
  url?: string;
  selector?: string;
  text?: string;
  extractSchema?: any;
  agentId: string;
}): Promise<any> {
  const { action, url, selector, agentId } = params;

  // Get or create session
  let session = browserSessions.get(agentId);
  if (!session) {
    session = {
      currentUrl: '',
      pageTitle: '',
      lastAction: '',
      startedAt: new Date().toISOString(),
    };
    browserSessions.set(agentId, session);
  }

  switch (action) {
    case 'navigate':
      if (!url) return { success: false, error: 'URL required' };
      
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OpenTuna/1.0; +https://${BRAND.domain})',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });

        if (!response.ok) {
          return { success: false, action: 'navigate', error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        
        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

        session.currentUrl = url;
        session.pageTitle = title;
        session.lastAction = 'navigate';

        return {
          success: true,
          action: 'navigate',
          url,
          status: response.status,
          title,
          contentLength: html.length,
          message: `Navigated to ${url}`,
        };
      } catch (fetchError) {
        return { success: false, action: 'navigate', error: fetchError.message };
      }

    case 'extract':
      if (!session.currentUrl) {
        return { success: false, action: 'extract', error: 'No page loaded. Navigate first.' };
      }

      try {
        const response = await fetch(session.currentUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OpenTuna/1.0)',
          },
        });

        const html = await response.text();

        // Basic extraction
        const links: Array<{ text: string; href: string }> = [];
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null && links.length < 50) {
          links.push({ href: match[1], text: match[2].trim() });
        }

        // Extract text (strip HTML)
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000);

        return {
          success: true,
          action: 'extract',
          url: session.currentUrl,
          title: session.pageTitle,
          links,
          textPreview: textContent.slice(0, 500),
          textLength: textContent.length,
          message: 'Data extracted via HTTP',
        };
      } catch (err) {
        return { success: false, action: 'extract', error: err.message };
      }

    case 'close':
      browserSessions.delete(agentId);
      return { success: true, action: 'close', message: 'Session closed' };

    case 'click':
    case 'type':
    case 'screenshot':
      return {
        success: false,
        action,
        error: `Action '${action}' requires Browserless.io. Configure BROWSERLESS_URL and BROWSERLESS_TOKEN secrets for full browser automation.`,
        hint: 'You can still use navigate and extract actions via HTTP.',
      };

    default:
      return { success: false, error: 'Unknown action' };
  }
}

async function hashParams(params: Record<string, any>): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(params));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
