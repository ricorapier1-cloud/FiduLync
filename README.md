# FiduLync — MacroLync Institutional Macro Research

FiduLync is a private, single-operator quantitative macro-fundamental research platform. It researches the economic, monetary-policy, positioning and cross-asset forces that influence FX and precious-metals markets.

## Product boundary

**FiduLync owns macro-fundamental research and research context. Connected EAs own trading.**

FiduLync is responsible for:
- Central-bank policy rates, policy divergence and real-policy-rate comparisons.
- Inflation, growth, labour, wages, sovereign yields and macroeconomic releases.
- CFTC Commitments of Traders positioning and crowding context.
- Economic catalysts, release timestamps, consensus/actual values where licensed and available.
- Cross-asset regime context only when source-verified observations exist.
- Currency strength, pair dossiers, macro regimes, evidence, scenario analysis and invalidation conditions.
- Read-only macro context for EAs through the protected API.

The EAs remain responsible for technical analysis, chart patterns, indicators, entry timing, order placement, stop-losses, take-profits, position sizing, exposure limits and all trade management. FiduLync does not execute orders.

The application is not a public EA storefront, customer account portal, owner console, subscription service or payment processor. Retired commercial routes remain blocked.

## Data providers

The ingestion layer prioritizes official public sources and preserves source attribution and observation dates.

| Source | Research coverage | Access |
| --- | --- | --- |
| European Central Bank (ECB) | Euro-area policy, HICP, sovereign yields and reference rates | Public API |
| Bank of England | Official Bank Rate | Public data |
| Bank of Canada | Policy rate and CPI | Public Valet API |
| Bank for International Settlements (BIS) | Cross-country central-bank rates and CPI series | Public SDMX API |
| Sveriges Riksbank | Swedish policy rate and other interest-rate series | Public REST API |
| Norges Bank | Norwegian policy rate and other interest-rate series | Public SDMX API |
| World Bank | Annual CPI fallback where higher-frequency official coverage is absent | Public API |
| CFTC | Futures-only COT positioning | Public Socrata API |
| US BLS | US CPI, unemployment and average hourly earnings | API key may be required for higher limits |
| US BEA | US national-accounts and real GDP observations | Registered API key |
| FRED / ALFRED | US macro series and historical vintages | API key; storage permission gate applies |
| FairEconomy / ForexFactory weekly calendar feed | High/medium impact event calendar | Disabled unless the configured use approval is explicitly enabled |
| Finnhub / FMP | Optional calendar fallback | Disabled unless provider permissions are explicitly approved |

Public central-bank and statistical APIs provide published economic observations, not tick-by-tick executable FX quotes. Frankfurter/ECB reference exchange rates are indicative reference rates and must never be labelled as broker bid/ask prices.

Provider health is based on observations actually present in the snapshot, not simply on the existence of an environment variable. Missing, delayed, stale, annual, reference-only and unavailable data must remain visibly distinct. The engine must not promote a partial G10 snapshot to fully verified coverage.

## Quantitative research controls

- Pair scoring requires current, provider-sourced policy and inflation observations for both currencies.
- A missing or stale essential input produces `INSUFFICIENT_EVIDENCE`, not a fabricated neutral trade signal.
- COT observations are weekly positioning context, not an entry trigger.
- Economic calendar lockouts are research context for connected EAs; EAs retain their own independent risk controls.
- Cross-asset values remain unavailable until their source, observation date and freshness can be validated.
- Historical regime validation remains `NOT_VALIDATED` until point-in-time data vintages, synchronized market returns and out-of-sample calculations are reproducible. No synthetic win rate, return or drawdown is published.

## Storage and refresh

The server persists:
- The latest validated global snapshot in `macro_snapshot_payloads`.
- Individual provider observations in `macro_observations`, including provider, series, region/currency, observation period, value, unit, retrieval timestamp, source URL and deterministic source hash.

Official release timestamps and vintage dates are stored only when actually supplied. Unknown release timestamps remain NULL; retrieval time is not substituted for release time. The source hash makes repeated ingestion idempotent while allowing revised values to be retained as new observations.

Supabase remains private. Server-only Supabase secret/service-role credentials must never be exposed in browser code, source control or EA files. Row-level security remains enabled.

The scheduled `/api/cron/sync-macro` route requires the server-side `CRON_SECRET` bearer value. The hourly GitHub workflow can call the same protected route when its repository secret is configured. Macro snapshot caching is shared through Upstash when configured, with a safe process-local fallback.

## EA research-context interface

`GET /api/v1/macro-context` is a read-only, authenticated endpoint for connected EAs. It returns macro research context, evidence status, confidence and event-risk metadata. It does not place trades, provide broker credentials or replace EA-side technical and risk validation.

Use the exact private installation token mechanism already provisioned by the application. Do not send broker master/investor passwords or provider API keys to FiduLync or embed them in an EA.

## Environment variables

Configure secrets only in the Vercel project environment settings, never in this repository or in ChatGPT messages.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only database persistence |
| `CRON_SECRET` | Authenticates scheduled macro refresh |
| `BLS_API_KEY` | Optional BLS API v2 registration key |
| `BEA_API_KEY` | Optional BEA API key |
| `FRED_API_KEY` | Optional FRED API key |
| `FRED_DATA_STORAGE_PERMISSION_APPROVED` | Explicit approval gate for FRED storage/use in this application |
| `FINNHUB_API_KEY` | Optional calendar provider key |
| `FINNHUB_PERSONAL_PLAN_ACTIVE` | Set true only while the private personal-plan entitlement is active and its terms permit this personal use |
| `FMP_API_KEY` | Optional calendar provider key |
| `FMP_COMMERCIAL_USE_APPROVED` | Explicit provider-use approval gate |
| `FAIRECONOMY_COMMERCIAL_USE_APPROVED` | Explicit calendar-feed use gate |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared caching and telemetry |

Never set an approval flag merely because an API key exists. Confirm the provider's applicable terms, plan and data-use rights first. Twelve Data is not required for the macro-only product scope. No paid data subscription is required for the official public central-bank feeds listed above.

## Verification

Production builds are gated by the automated test suite and TypeScript checking:

```bash
npm run test
npx tsc --noEmit
npm run build
```

A successful build confirms code compilation and automated tests. It does not by itself prove every external provider is currently reachable; provider health and last successful observations must be checked at runtime.

## Research disclaimer

FiduLync provides quantitative research and evidence summaries, not investment guarantees or personalized financial advice. Macro releases can be revised, delayed or misinterpreted. EAs must retain independent technical, execution, exposure and account-level risk controls.
