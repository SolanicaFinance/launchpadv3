const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Minimal Base32 + TOTP generator (no external deps)
const base32ToBytes = (input: string): Uint8Array => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
};

const generateTotpCode = async (secretBase32: string, digits = 6, stepSec = 30): Promise<string> => {
  const keyBytes = base32ToBytes(secretBase32);
  const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const counter = Math.floor(Date.now() / 1000 / stepSec);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  // big-endian 64-bit counter
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new Uint8Array(msg)));
  const offset = sig[sig.length - 1] & 0x0f;
  const binCode =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  const mod = 10 ** digits;
  const code = String(binCode % mod).padStart(digits, "0");
  return code;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const twitterApiIoKey = Deno.env.get("TWITTERAPI_IO_KEY");
    
    const results: Record<string, any> = {
      proxy_configured: !!proxyUrl,
      proxy_url_format: proxyUrl ? proxyUrl.replace(/:[^:@]+@/, ':***@') : null, // mask password
    };

    // Test 1: Direct fetch to Twitter (without proxy) to see if it's reachable
    try {
      const directRes = await fetch("https://twitter.com", {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });
      results.direct_twitter_access = {
        status: directRes.status,
        ok: directRes.ok,
      };
    } catch (e) {
      results.direct_twitter_access = {
        error: e instanceof Error ? e.message : "Unknown error",
      };
    }

    // Test 2: Check twitterapi.io health
    if (twitterApiIoKey) {
      try {
        const healthRes = await fetch("https://api.twitterapi.io/twitter/user/info?userName=saturntrade", {
          headers: { "X-API-Key": twitterApiIoKey },
          signal: AbortSignal.timeout(10000),
        });
        const healthText = await healthRes.text();
        results.twitterapi_health = {
          status: healthRes.status,
          response: healthText.slice(0, 500),
        };
      } catch (e) {
        results.twitterapi_health = {
          error: e instanceof Error ? e.message : "Unknown error",
        };
      }
    }

    // Test 3: Test login with v2 (totp_secret field)
    const xUsername = Deno.env.get("X_ACCOUNT_USERNAME");
    const xEmail = Deno.env.get("X_ACCOUNT_EMAIL");
    const xPassword = Deno.env.get("X_ACCOUNT_PASSWORD");
    const xTotpSecretRaw = Deno.env.get("X_TOTP_SECRET");
    
    // Normalize TOTP secret
    const normalizeTotpSecret = (raw?: string | null): string | undefined => {
      if (!raw) return undefined;
      const trimmed = String(raw).trim();
      if (!trimmed) return undefined;
      if (trimmed.toLowerCase().startsWith("otpauth://")) {
        try {
          const url = new URL(trimmed);
          const secretParam = url.searchParams.get("secret");
          if (secretParam) return secretParam.replace(/\s|-/g, "").toUpperCase();
        } catch { /* fall through */ }
      }
      const secretMatch = trimmed.match(/secret\s*=\s*([A-Za-z2-7\s-]+)/i);
      const candidate = (secretMatch?.[1] ?? trimmed).replace(/\s|-/g, "").toUpperCase();
      return candidate || undefined;
    };
    
    const xTotpSecret = normalizeTotpSecret(xTotpSecretRaw);
    let totpCode: string | undefined;
    if (xTotpSecret) {
      try {
        totpCode = await generateTotpCode(xTotpSecret);
      } catch {
        // ignore; we'll still try secret-based logins
      }
    }
    
    if (twitterApiIoKey && proxyUrl && xEmail && xPassword) {
      const attempt = async (label: string, endpoint: string, body: Record<string, string>) => {
        try {
          const res = await fetch(`https://api.twitterapi.io${endpoint}`, {
            method: "POST",
            headers: {
              "X-API-Key": twitterApiIoKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
          });
          const text = await res.text();
          results[label] = {
            status: res.status,
            response: text.slice(0, 500),
          };
        } catch (e) {
          results[label] = { error: e instanceof Error ? e.message : "Unknown error" };
        }
      };

      // Build bodies for v2/v3 with common permutations found across providers
      const base: Record<string, string> = {
        email: xEmail,
        password: xPassword,
        proxy: proxyUrl,
      };

      const withUserName: Record<string, string>[] = [];
      if (xUsername) {
        withUserName.push({ ...base, user_name: xUsername });
        withUserName.push({ ...base, username: xUsername });
      }
      // Some providers accept email-only
      withUserName.push({ ...base });

      const addTotpSecret = (b: Record<string, string>) => (xTotpSecret ? { ...b, totp_secret: xTotpSecret } : b);
      const addTotpCode = (b: Record<string, string>) => (totpCode ? { ...b, totp_code: totpCode } : b);

      // v2
      for (const [i, b] of withUserName.entries()) {
        await attempt(`login_v2_secret_${i}`, "/twitter/user_login_v2", addTotpSecret(b));
        if (totpCode) await attempt(`login_v2_code_${i}`, "/twitter/user_login_v2", addTotpCode(b));
      }

      // v3
      for (const [i, b] of withUserName.entries()) {
        await attempt(`login_v3_code_${i}`, "/twitter/user_login_v3", addTotpCode(b));
        // fallback variant: some older docs used the secret in totp_code
        if (xTotpSecret && !totpCode) {
          await attempt(`login_v3_secret_${i}`, "/twitter/user_login_v3", { ...b, totp_code: xTotpSecret });
        }
      }
    }

    // Show current credential status (masked)
    results.credentials_status = {
      username: xUsername ? `${xUsername.slice(0, 3)}***` : "NOT SET",
      email: xEmail ? `${xEmail.slice(0, 3)}***@***` : "NOT SET",
      password: xPassword ? "SET (hidden)" : "NOT SET",
      totp_secret: xTotpSecretRaw ? "SET (hidden)" : "NOT SET",
      totp_normalized: xTotpSecret ? `${xTotpSecret.slice(0, 4)}...` : "NOT SET",
      totp_code_generated: !!totpCode,
    };

    return new Response(
      JSON.stringify(results, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
