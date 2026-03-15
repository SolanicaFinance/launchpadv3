

## Fix: Add `fetch-token-prices` to `config.toml`

The edge function code already correctly reads `JUPITER_API_KEY` from env and passes it as `x-api-key` (same as `jupiter-proxy`). The secret is also configured. 

**The actual issue**: `fetch-token-prices` is missing from `supabase/config.toml`, so JWT verification is enabled by default and frontend calls are being rejected.

### Change

**`supabase/config.toml`** — Add entry:
```toml
[functions.fetch-token-prices]
verify_jwt = false
```

This single addition should make the function accessible and fix USD price display in the wallet holdings.

