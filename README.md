# FiduLync — Institutional Fintech & Quant Platform

FiduLync unifies MacroLync market intelligence, an owner-only Personal Quant risk and MT5 supervision workspace, and the separate AlgoLync Expert Advisor storefront/licensing service. These products share infrastructure but retain distinct permissions, payment entitlements and execution boundaries.

## Personal Quant Edition: operating boundary

- The owner workspace is authenticated; there is no public customer registration or subscription requirement for the personal quant workflow.
- The EA supervisor is read-only. It returns `APPROVE`, `REDUCE`, `REJECT` or `ABSTAIN` and risk ceilings; it never places, modifies or closes broker orders.
- Server-side execution remains disabled until the independent model, execution-quality, demo and release gates are separately satisfied.
- MT5 market data is tied to one installation, broker, server and symbol series. Closed candles are used for research; quotes and publisher telemetry have separate freshness targets.
- Escrow is excluded from active Personal Quant workflows. AlgoLync storefront checkout and customer EA licensing remain a separate commercial product boundary and never grant owner-console or Personal Quant execution privileges.
- Quantitative outputs are research diagnostics, not predictions or guarantees of profitability.

MT5 market-data and supervisor API requests use installation-scoped publisher tokens. Legacy AlgoLync API routes may still use the private `x-algo-key` header; do not reuse that secret as an MT5 publisher token.

## Institutional refinement specification

See [FiduLync Institutional Refinement & Release Specification](docs/FIDULYNC_INSTITUTIONAL_REFINEMENT_SPEC.md) for API security, durable rate limiting, Paystack verification, seat binding, owner administration, mobile UX, evidence labels and release gates. The storefront uses database-authoritative pricing, server-side licence provisioning and an audited 72-hour seat-rebinding policy. Monthly licences last 30 days and require a new verified payment to renew; one-time licences are non-recurring.

## Local development

```bash
npm install
npm run dev
```

Set server-side values in `.env.local` or the deployment secret manager:

| Variable | Purpose |
| --- | --- |
| `ALGOLYNC_PRIVATE_KEY` (legacy alias: `ALGO_PRIVATE_API_KEY`) | Static secret for authenticated signal and EA heartbeat API requests; not required for same-origin Store signal previews |
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint for shared caching and legacy transient EA heartbeat state; in-process cache is ephemeral and is not durable telemetry storage |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Upstash REST token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for persisted macro snapshots |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase persistence and atomic security RPC access; never expose to a browser |
| `PAYSTACK_SECRET_KEY` | Server-only Paystack transaction initialization and verification secret |
| `PAYSTACK_LIVE_ENABLED` | Must remain `false` until merchant compliance, live checkout and refund/cancellation disclosures are approved |
| `FINNHUB_API_KEY` | Optional FX quotes and economic calendar; not called until commercial-use approval is recorded |
| `FINNHUB_COMMERCIAL_USE_APPROVED` | Must be `true` only after written permission covers the intended quote/calendar display and caching |
| `FRANKFURTER_COMMERCIAL_USE_APPROVED` / `EXCHANGERATE_API_COMMERCIAL_USE_APPROVED` / `GOLD_API_COMMERCIAL_USE_APPROVED` | Keep `false` until each reference provider's commercial-use and attribution terms are approved |
| `ALPHA_VANTAGE_COMMERCIAL_USE_APPROVED` / `FMP_COMMERCIAL_USE_APPROVED` / `FAIRECONOMY_COMMERCIAL_USE_APPROVED` / `SNB_DATA_SOURCE_ENABLED` / `SNB_COMMERCIAL_USE_APPROVED` | Keep `false` until the specific provider rights and attribution are documented |
| `FRED_API_KEY` | Optional; disabled unless separately approved for the intended commercial use and data handling |
| `FRED_COMMERCIAL_USE_APPROVED` | Must remain `false` unless written permission covers the exact use, display, storage and caching |
| `BEA_API_KEY` / `BLS_API_KEY` | Diagnostic credentials only; full adapters are not yet integrated |
| `TWELVE_DATA_API_KEY` | Historical candle fallback; disabled for customer-facing use until commercial and exchange rights are approved |
| `TWELVE_DATA_COMMERCIAL_USE_APPROVED` | Must remain `false` until the appropriate business tier, exchange permissions and external-display rights are documented |
| `ALPHA_VANTAGE_API_KEY` | Optional fallback US policy-rate and CPI observations |
| `FMP_API_KEY` | Optional economic calendar provider |
| `MACRO_DATA_PROVIDER_URL` | Optional HTTPS endpoint returning validated currencies, COT positions, and catalysts |
| `MACRO_DATA_PROVIDER_TOKEN` | Optional bearer token for the macro provider |
| `MACRO_DATA_PROVIDER_LICENSE_APPROVED` | Must be `true` only after the custom provider contract permits this use |
| `COT_DATA_PROVIDER_URL` | Optional HTTPS COT override; the public CFTC futures-only feed is used by default |
| `COT_DATA_PROVIDER_TOKEN` | Optional bearer token for the COT provider |
| `MARKET_DATA_PROVIDER_URL` | HTTPS candle endpoint accepting `pair` and `timeframe=H1|H4` |
| `MARKET_DATA_PROVIDER_TOKEN` | Optional bearer token for the candle provider |
| `MARKET_DATA_PROVIDER_LICENSE_APPROVED` | Must be `true` only after display, derived-data and redistribution rights are documented |
| `OWNER_EMAIL` | Exact owner email accepted by the owner-auth guard; owner login itself is email/password only |
| `NEXT_PUBLIC_APP_URL` | Canonical HTTP(S) origin for metadata and signal bridge display |
| `CRON_SECRET` | Bearer secret for the scheduled macro snapshot refresh |

Use a long, unique random value for `ALGOLYNC_PRIVATE_KEY` (or the accepted legacy `ALGO_PRIVATE_API_KEY`) and rotate it in the server secret manager and all EA configurations together. Never commit environment files or embed service-role/provider credentials in an EA.

## Signal engine and API

`GET /api/v1/macro-signal?symbol=EURUSD` returns a flat JSON signal. The following is an example response shape, not live market data:

```json
{
  "symbol": "EURUSD",
  "bias": "NEUTRAL",
  "confluence_score": 0,
  "regime": "UNAVAILABLE",
  "atr_sl_pips": null,
  "atr_tp_pips": null,
  "session": "OFF_HOURS",
  "killzone_active": "OFF_SESSION",
  "csi_spread": 0,
  "max_risk_pct": 0,
  "risk_multiplier": 0,
  "news_lockout": false,
  "safe_to_trade": false,
  "timestamp_utc": "2026-11-12T00:00:00.000Z"
}
```

Send `x-algo-key: <ALGOLYNC_PRIVATE_KEY>` on signal requests. An optional `?key=` query parameter is supported for WebRequest clients; prefer the header to avoid exposing credentials in URLs and access logs. The same-origin `/research` Quant Lab signal preview uses browser same-origin request metadata and never receives the private EA key. `/store` is the canonical AlgoLync storefront; `/licensing` redirects to it. The economic calendar is provider-only: FairEconomy is called only with explicit commercial-use approval, then approved Finnhub or FMP calendars may be used. There is no curated or synthetic event fallback. Every provider-verified high-impact event mapped to either pair currency blocks signals from 30 minutes before through 30 minutes after its scheduled UTC time. Macro verification remains false unless the required fresh provider macro, COT and calendar inputs are present. The macro layer contributes 60% of confluence; H1/H4 technical confluence contributes 40%. Signals remain neutral unless both `abs(csi_spread) >= 60` and `abs(confluence_score) >= 45`. `killzone_active` is `LONDON_OPEN`, `NY_OVERLAP`, `ASIAN_RANGE`, or `OFF_SESSION`. `max_risk_pct` and `risk_multiplier` are position-sizing multipliers: 0.50% maximum in trending expansion, 0.25% maximum in mean reversion, and 0% during high-volatility chop, news lockout, or any failed validation gate. Missing or stale technical inputs, a fallback-only macro snapshot, a news lockout, or a high-volatility chop regime disables trading.

Live quotes and technical calculations use a 60-second Upstash TTL. Macro snapshots use a 900-second TTL; signals use a 15-second TTL with cache bypass around news-lockout boundaries.

## MT5 heartbeat and include

`POST /api/v1/ea-heartbeat` accepts the EA's private `x-algo-key` header plus `mt5_account`, `license_key`, `ea_name`, `account_number`, `balance`, `equity`, `floating_pnl`, `drawdown_pct`, `open_positions`, and `status`. The server validates the exact active license/account pair against Supabase before storing telemetry. `GET /api/v1/ea-heartbeat?mt5_account=...` and `GET /api/v1/trade-log?mt5_account=...` require the matching customer license in the `x-license-key` header; they are read-only, return `Cache-Control: no-store`, and fail closed with `503` when Supabase is unavailable or `401` for a mismatched/expired license. Never send broker master or investor passwords to FiduLync. `POST /api/v1/trade-log` accepts the same private `x-algo-key` plus `mt5_account`, `license_key`, `ticket`, `symbol`, `direction`, `entry_price`, `exit_price`, `profit_usd`, `r_multiple`, `confluence_score`, `regime`, and `closed_at_utc`. Trade records are persisted in Supabase `trade_ledger` with a unique account/ticket/symbol key; reads always filter by both account and license. Apply `supabase/migrations/202611150001_customer_account_telemetry.sql` before deploying these routes.

The shipped `public/mql5/MacroLyncBridge.mqh` has optional trailing `license_key` arguments on `MacroLyncSendHeartbeat` and `MacroLyncHeartbeatEveryFiveMinutes`; pass the buyer's EA license key. `LogClosedTrade` additionally requires the MT5 login and license key in its trailing `mt5_account` and `license_key` arguments. Example heartbeat call: `MacroLyncHeartbeatEveryFiveMinutes(..., "RUNNING", InpLicenseKey)`. Example close call: `LogClosedTrade(..., closedAtUtc, 5000, AccountInfoInteger(ACCOUNT_LOGIN), InpLicenseKey)`. Keep `ALGOLYNC_PRIVATE_KEY` server-side and in the EA configuration; it is distinct from the customer's license key. The customer Live Account Monitor polls every 15 seconds and displays only the bound account.

Download [`public/mql5/MacroLyncBridge.mqh`](./public/mql5/MacroLyncBridge.mqh) from `/store`; the displayed source and clipboard action use that exact file. It has no DLL dependencies, uses `char[]` buffers for `WebRequest()` and UTF-8 conversion buffers for JSON, and defaults signal execution to defensive hold on network errors, timeouts, non-200 or empty responses, malformed responses, or news lockout. `LogClosedTrade(...)` sends a validated close record; call it from the EA's `OnTradeTransaction` handler after the EA has determined the trade's realized USD P&amp;L, R multiple, confluence, regime, and UTC close timestamp. Set `#property strict` in the consuming `.mq5` EA; MQL5 ignores program properties placed in `.mqh` include files. Configure MetaTrader 5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** with the deployed HTTPS origin.

## Data providers, EA release artifacts and deployment

The macro adapter validates upstream policy rates, inflation, COT positioning, and catalysts; live data can be combined with a persisted Supabase snapshot. Provider outages return an empty, untimestamped unavailable state—not fabricated reference policy levels. Snapshots older than 24 hours are rejected. Third-party quote/reference feeds are disabled until their specific commercial-use approvals are configured; MT5 broker quotes are sourced only after the Windows publisher connects. The store no longer displays illustrative win rates, Sharpe ratios, profit factors, drawdowns or equity curves. The CFTC adapter calculates non-commercial net-position percentiles. Candle provider responses must contain at least 200 chronologically valid candles per requested timeframe for EMA alignment and technical calculations.

The scheduled `/api/cron/sync-macro` route uses `CRON_SECRET`. Upstash is used for shared transient cache/legacy heartbeat state; process-local fallback is ephemeral and must never be treated as durable verified telemetry. Durable licensed account and closed-trade records are stored in Supabase.

Historical Supabase migrations are retained for auditability. The Personal Quant owner console uses owner-only email-and-password authentication; email is used only for password recovery. Licensed customer heartbeat and closed-trade telemetry are persisted in Supabase and do not fall back to process-local storage. Escrow is excluded from active workflows; historical financial records remain protected for audit and server-side retention. Legacy store, checkout and EA licensing routes remain separate from the personal quant supervisor.

## Windows MT5 handoff and compile gate

See [`docs/REMOTE_COMPLETION_AND_LAPTOP_HANDOFF.md`](./docs/REMOTE_COMPLETION_AND_LAPTOP_HANDOFF.md) for the complete laptop setup, publisher connection, MetaEditor zero-warning compile procedure, optional Windows CI runner, and release gates. The compile-only integration fixture and `scripts/compile_mt5.ps1` are prepared; they still require a real Windows MetaEditor run before any MQL5 compile claim can be made.

## Verification

```bash
npx tsc --noEmit
npm run build
```

Trading involves substantial risk. Signals are research and execution inputs, not guarantees; EAs must retain independent account-level exposure, equity, and drawdown controls.


## Institutional hardening standard

See [Institutional Platform Hardening Standard](docs/INSTITUTIONAL_PLATFORM_HARDENING_SPEC.md) for the security, licensing, navigation, disclosure and release gates.


## Compiled EA release workflow

The three catalogue products currently have no approved compiled .ex5 release artifact. Paid checkout, demo-license issuance, paid license provisioning and license validation are therefore blocked, even though the catalogue rows remain active. The owner console includes a Release governance uploader: it creates a short-lived signed Supabase Storage upload URL, uploads the .ex5 directly to the private bucket, registers SHA-256/version/size metadata with an audit event, and requires explicit owner approval. Approval re-downloads the private object and verifies its actual bytes against the recorded SHA-256. The workflow does not certify MetaEditor build quality or strategy performance; those still require Windows MetaEditor, Strategy Tester and demo-account validation.

Place actual commercial .mq5 sources under MQL5/Experts/Release/ and run scripts/compile_mt5.ps1 with -RequireProductSources when the laptop is available. No placeholder commercial EA source is included.
