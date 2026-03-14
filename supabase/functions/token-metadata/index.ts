import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

function guessImageMimeType(url: string): string {
  const u = url.toLowerCase();
  // Strip query/hash for extension checks
  const clean = u.split('#')[0].split('?')[0];

  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';

  // Safe default: most of our hosted images are jpeg
  return 'image/jpeg';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get mint address from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const mintAddress = pathParts[pathParts.length - 1];

    if (!mintAddress || mintAddress === 'token-metadata') {
      return new Response(
        JSON.stringify({ error: 'Mint address required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[token-metadata] Fetching metadata for:', mintAddress);

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Token interface for both tables
    interface TokenData {
      name: string;
      ticker: string;
      description?: string;
      image_url?: string;
      website_url?: string;
      twitter_url?: string;
      telegram_url?: string;
      discord_url?: string;
      status?: string;
      creator_wallet: string;
      created_at?: string;
    }

    // Fetch token from database.
    // IMPORTANT: We try to read pending_token_metadata and MERGE it into the canonical row.
    // Rationale: during the first seconds/minutes after a launch, the canonical row may exist
    // but be partially populated (image/socials arriving later). Using pending as a fallback
    // prevents external indexers from ever seeing a "blank" token.

    // 1) pending_token_metadata (best-effort, may not exist)
    const { data: pendingToken, error: pendingError } = await supabase
      .from('pending_token_metadata')
      .select('*')
      .eq('mint_address', mintAddress)
      .maybeSingle();

    if (pendingError) {
      console.log('[token-metadata] Pending metadata lookup error (non-fatal):', pendingError.message);
    }

    // 2) canonical token row from tokens or fun_tokens
    let token: TokenData | null = null;
    let tokenSource = 'tokens';

    const { data: launchpadToken, error: launchpadError } = await supabase
      .from('tokens')
      .select('*')
      .eq('mint_address', mintAddress)
      .maybeSingle();

    if (launchpadToken && !launchpadError) {
      token = launchpadToken as TokenData;
      tokenSource = 'tokens';
    } else {
      const { data: funToken, error: funError } = await supabase
        .from('fun_tokens')
        .select('*')
        .eq('mint_address', mintAddress)
        .maybeSingle();

      if (funToken && !funError) {
        token = funToken as TokenData;
        tokenSource = 'fun_tokens';
      }
    }

    // 3) If we only have pending metadata, synthesize token from it.
    if (!token && pendingToken && !pendingError) {
      console.log('[token-metadata] Found pending metadata for:', mintAddress);
      token = {
        name: pendingToken.name,
        ticker: pendingToken.ticker,
        description: pendingToken.description,
        image_url: pendingToken.image_url,
        website_url: pendingToken.website_url,
        twitter_url: pendingToken.twitter_url,
        telegram_url: pendingToken.telegram_url,
        discord_url: pendingToken.discord_url,
        status: 'launching',
        creator_wallet: pendingToken.creator_wallet || '',
      };
      tokenSource = 'pending_token_metadata';
    }

    // 4) Merge pending fields into canonical row when canonical exists but fields are missing.
    if (token && pendingToken && !pendingError && tokenSource !== 'pending_token_metadata') {
      const pick = (primary?: string, fallback?: string | null) => {
        const p = typeof primary === 'string' ? primary.trim() : '';
        const f = typeof fallback === 'string' ? fallback.trim() : '';
        return p || f || undefined;
      };

      token = {
        ...token,
        // Prefer canonical name/symbol, but fill from pending if missing (should be rare)
        name: pick((token as any).name, pendingToken.name) || (token as any).name,
        ticker: pick((token as any).ticker, pendingToken.ticker) || (token as any).ticker,
        description: pick((token as any).description, pendingToken.description) || (token as any).description,
        image_url: pick((token as any).image_url, pendingToken.image_url),
        website_url: pick((token as any).website_url, pendingToken.website_url),
        twitter_url: pick((token as any).twitter_url, pendingToken.twitter_url),
        telegram_url: pick((token as any).telegram_url, pendingToken.telegram_url),
        discord_url: pick((token as any).discord_url, pendingToken.discord_url),
        creator_wallet: pick((token as any).creator_wallet, pendingToken.creator_wallet) || (token as any).creator_wallet,
      } as TokenData;

      // If we had to fill any field from pending, keep cache very short to encourage rapid refresh.
      // (We still compute cache below; this flag influences it.)
      (token as any).__filled_from_pending = true;
    }

    // If token not found anywhere, return a fallback
    if (!token) {
      console.log('[token-metadata] Token not in any table, returning generic fallback:', mintAddress);
      
      const fallbackMetadata = {
        name: 'New Token',
        symbol: 'TOKEN',
        description: 'Token launching on Saturn #STRN',
        image: '',
        tags: ['Meme', 'STRN'],
        attributes: [
          { trait_type: 'Platform', value: 'Saturn' },
          { trait_type: 'Status', value: 'launching' },
        ],
        properties: {
          files: [],
          category: 'image',
          creators: [],
        },
      };
      
      // No cache for fallback - external platforms should retry quickly
      return new Response(
        JSON.stringify(fallbackMetadata),
        { 
          status: 200, 
          headers: {
            ...corsHeaders,
            'Cache-Control': 'no-cache, no-store',
          }
        }
      );
    }
      
    console.log(`[token-metadata] Found token in ${tokenSource}:`, token.name, 'website:', token.website_url, 'twitter:', token.twitter_url);
    
    // Determine cache duration based on token age and source
    let cacheMaxAge = 3600; // Default 1 hour for established tokens
    
    if (tokenSource === 'pending_token_metadata') {
      // Pending tokens - no cache, always fresh
      cacheMaxAge = 0;
      console.log('[token-metadata] Pending token, using no-cache');
    } else {
      // If we had to backfill from pending metadata, keep cache short.
      if ((token as any)?.__filled_from_pending) {
        cacheMaxAge = 60;
        console.log('[token-metadata] Canonical row backfilled from pending metadata, using short cache: 60s');
      }

      // Check if token was created within last 10 minutes
      const createdAt = token.created_at ? new Date(token.created_at) : null;
      if (createdAt) {
        const ageMs = Date.now() - createdAt.getTime();
        const tenMinutesMs = 10 * 60 * 1000;
        if (ageMs < tenMinutesMs) {
          // New token - short cache for rapid updates on external platforms
          cacheMaxAge = 60;
          console.log(`[token-metadata] New token (age: ${Math.round(ageMs / 1000)}s), using short cache: ${cacheMaxAge}s`);
        }
      }
    }
    
    const cacheControl = cacheMaxAge === 0 
      ? 'no-cache, no-store' 
      : `public, max-age=${cacheMaxAge}`;

    // Validate image URL - skip t.co shortlinks (they're redirects, not images)
    let validImageUrl = token.image_url || '';
    if (validImageUrl.startsWith('https://t.co/') || validImageUrl.startsWith('http://t.co/')) {
      console.log(`[token-metadata] ⚠️ Skipping invalid t.co image URL: ${validImageUrl}`);
      validImageUrl = '';
    }

    const imageMimeType = validImageUrl ? guessImageMimeType(validImageUrl) : 'image/png';

    // Build Metaplex-standard metadata JSON
    // See: https://docs.metaplex.com/programs/token-metadata/token-standard
    // Append #STRN hashtag for Solscan visibility
    const baseDescription = token.description || `${token.name} token`;
    const descriptionWithTag = baseDescription.includes('#STRN') 
      ? baseDescription 
      : `${baseDescription} #STRN`;

    // IMPORTANT: if socials are blank, keep them blank (no defaults)
    const website = typeof token.website_url === 'string' ? token.website_url.trim() : '';
    const twitter = typeof token.twitter_url === 'string' ? token.twitter_url.trim() : '';
    const telegram = typeof token.telegram_url === 'string' ? token.telegram_url.trim() : '';
    const discord = typeof token.discord_url === 'string' ? token.discord_url.trim() : '';

    const metadata: Record<string, unknown> = {
      name: token.name,
      symbol: token.ticker?.toUpperCase() || '',
      description: descriptionWithTag,
      image: validImageUrl,
      // NOTE: JSON.stringify omits undefined values, so this disappears when website is blank.
      external_url: website || undefined,
      // Tags array for Solscan tag chips
      tags: ['Meme', 'STRN'],
      attributes: [
        {
          trait_type: 'Platform',
          value: 'Saturn',
        },
        {
          trait_type: 'Status',
          value: token.status || 'bonding',
        },
      ],
      properties: {
        files: validImageUrl ? [
          {
            uri: validImageUrl,
            type: imageMimeType,
          },
        ] : [],
        category: 'image',
        creators: [
          {
            address: token.creator_wallet,
            share: 100,
          },
        ],
      },
    };

    // Add social links as extensions (following common patterns)
    const extensions: Record<string, string> = {};

    if (website) extensions.website = website;
    if (twitter) extensions.twitter = twitter;
    if (telegram) extensions.telegram = telegram;
    if (discord) extensions.discord = discord;

    if (Object.keys(extensions).length > 0) {
      metadata.extensions = extensions;
    }

    // Also add to properties.links for better compatibility
    const links: Record<string, string> = {};
    if (website) links.website = website;
    if (twitter) links.twitter = twitter;
    if (telegram) links.telegram = telegram;
    if (discord) links.discord = discord;
    
    if (Object.keys(links).length > 0) {
      (metadata.properties as Record<string, unknown>).links = links;
    }

    console.log('[token-metadata] Returning metadata for:', token.name, 'with cache:', cacheControl);

    return new Response(
      JSON.stringify(metadata),
      { 
        status: 200, 
        headers: {
          ...corsHeaders,
          'Cache-Control': cacheControl,
        }
      }
    );

  } catch (error) {
    console.error('[token-metadata] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
