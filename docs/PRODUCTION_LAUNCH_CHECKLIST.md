# FiduLync Personal Quant Edition — production and operations checklist

This runbook describes the private MacroLync research terminal. It is not a storefront or commercial launch checklist.

## Product boundary

- MacroLync researches macroeconomic releases, policy rates, inflation, growth, labour, yields, CFTC positioning, approved economic events and cross-asset regimes.
- Connected MT5 EAs own technical analysis, entry/exit logic, broker orders, position sizing, stops, targets and account-level risk enforcement.
- The web application does not execute orders, issue licenses, provision customer accounts, collect payments, send EA heartbeats or ingest closed-trade telemetry.
- No owner console, login portal, customer store, subscription or billing flow is part of the product.
- No data may be labelled live unless provider observation and freshness checks pass. Official macro releases are published at their own cadence; they are not intraday streams.

## Vercel Production environment

Configure these in Vercel → Project → Settings → Environment Variables. Never commit secret values or place server-side keys in NEXT_PUBLIC_ variables.

| Variable | Purpose |
| --- | --- |
| SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY | Server-only database persistence and rate limiting |
| CRON_SECRET | Authenticates /api/cron/sync-macro |
| NEXT_PUBLIC_APP_URL | Canonical app origin, https://fidulync.vercel.app |
| MACRO_API_TOKEN | Dedicated read-only EA context credential; unique random value of at least 32 characters |
| EIA_API_KEY | EIA daily WTI/Brent observations |
| BEA_API_KEY | Optional BEA macro series |
| BLS_API_KEY | Optional BLS API v2 registration key; public v1 fallback is supported |
| FRED_API_KEY | Optional FRED series access; not used for active storage until permission is approved |
| FRED_DATA_STORAGE_PERMISSION_APPROVED | Set true only after confirming the exact FRED series storage/use rights |
| FINNHUB_API_KEY | Optional economic calendar provider key |
| FINNHUB_PERSONAL_PLAN_ACTIVE | Set true only while the personal-plan entitlement is active and terms allow this use |
| FAIRECONOMY_COMMERCIAL_USE_APPROVED | Enable only after applicable calendar-feed terms are reviewed |
| FMP_API_KEY / FMP_COMMERCIAL_USE_APPROVED | Optional calendar fallback, only with applicable data-use permission |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN | Shared caching when configured |

The service API also accepts MACROLYNC_API_SECRET or the legacy ALGO_PRIVATE_API_KEY as a compatibility secret. Prefer a dedicated MACRO_API_TOKEN; do not reuse CRON_SECRET.

## Data availability and provider permissions

- Swissquote supplies the terminal's four-symbol bid/ask feed without a user API key. It is a quote source, not a complete FX candle history feed.
- U.S. Treasury daily nominal/TIPS yields, Cboe daily VIX closes, CFTC weekly COT, BLS, BIS, ECB, BoE, BoC, Riksbank, Norges Bank and World Bank public data provide the no-paid-key research baseline.
- EIA requires the configured EIA API key for daily energy observations.
- FRED remains permission-gated. When disabled, the active macro snapshot strips cached FRED-derived values and the gold model uses validated Treasury history plus Cboe VIX, CFTC positioning and the available Swissquote quote. The optional high-yield credit-spread component remains unavailable.
- Economic calendar data remains UNAVAILABLE until an approved provider is configured. No static meeting dates are substituted. Pair candidates remain visible for research but are marked BLOCKED · CALENDAR UNVERIFIED.
- Do not set a provider approval flag merely because an API key exists. Confirm applicable personal-plan, caching, display and storage rights first.

## MT5 bridge setup (when a laptop is available)

1. Include public/mql5/MacroLyncBridge.mqh in the EA.
2. Set InpMacroEndpoint to https://fidulync.vercel.app/api/v1/macro-context.
3. Set InpMacroApiToken to the dedicated MACRO_API_TOKEN value. Never use CRON_SECRET.
4. In MT5, open Tools → Options → Expert Advisors and allow WebRequest to https://fidulync.vercel.app.
5. Call MacroLyncGetMacroContext(symbol, context) and treat INSUFFICIENT_EVIDENCE, unverified calendar and news_lockout=true as abstain conditions.
6. Keep technical analysis, entries/exits, broker orders, stops, sizing and risk controls inside the EA. The compatibility MacroLyncGetSignal wrapper always sets safe_to_trade=false; it never authorizes a trade.
7. Compile in MetaEditor, resolve every compiler warning/error and validate the authenticated HTTP 200 response on a demo account before connecting a live EA.

## Release gates

- npm ci succeeds with zero reported vulnerabilities.
- npm run build passes lint, TypeScript, tests and Next.js production compilation.
- /api/v1/live-quotes returns valid, timestamped bid/ask/spread observations for EURUSD, GBPUSD, XAUUSD and USDJPY.
- /api/v1/top-pairs ranks only fresh, provider-backed macro candidates and does not claim calibrated win probabilities.
- /api/v1/macro-context?symbol=EURUSD returns HTTP 200 only with the configured read-only service credential.
- Calendar-unavailable and insufficient-evidence states remain fail-closed.
- The exact production deployment SHA matches the validated main commit. A successful build alone does not prove external providers are reachable.

## Security and data integrity

- Keep Supabase secret/service-role keys, provider API keys, MACRO_API_TOKEN and CRON_SECRET server-side.
- Never pass broker credentials to the app.
- Never label reference rates, delayed quotes, daily closes, weekly positioning or monthly/quarterly releases as tick-level live data.
- Missing, stale, revised, contradictory or malformed observations must be excluded from live research decisions.
- Historical validation remains unvalidated until reproducible point-in-time data vintages and out-of-sample calculations exist.
