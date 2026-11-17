# MacroLync Institutional Terminal

MacroLync is a single-operator quantitative FX and macro terminal. AlgoLync is its proprietary strategy vault and MT5 VPS telemetry monitor. The browser has no account or subscription flow; MT5/EA API requests use a private `x-algo-key` header.

## Local development

```bash
npm install
npm run dev
```

Set server-side values in `.env.local` or the deployment secret manager:

| Variable | Purpose |
| --- | --- |
| `ALGO_PRIVATE_API_KEY` | Static secret for authenticated signal and EA heartbeat API requests; not required for same-origin Store signal previews |
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint for shared caching, EA heartbeat state, and closed-trade history; in-process fallback is used if unavailable |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Upstash REST token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for persisted macro snapshots |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional server-only Supabase persistence access; never expose to a browser |
| `FINNHUB_API_KEY` | Optional FX quotes and economic calendar |
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
| `NEXT_PUBLIC_APP_URL` | Canonical HTTP(S) origin for metadata and signal bridge display |
| `CRON_SECRET` | Bearer secret for the scheduled macro snapshot refresh |

Use a long, unique random value for `ALGO_PRIVATE_API_KEY` and rotate it in the server secret manager and all EA configurations together. Never commit environment files or embed service-role/provider credentials in an EA.

## Signal engine and API

`GET /api/v1/macro-signal?symbol=EURUSD` returns a flat JSON signal:

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

Send `x-algo-key: <ALGO_PRIVATE_API_KEY>` on signal requests. An optional `?key=` query parameter is supported for WebRequest clients; prefer the header to avoid exposing credentials in URLs and access logs. The same-origin `/store` signal preview uses browser same-origin request metadata and never receives the private EA key. The calendar uses FairEconomy/ForexFactory weekly JSON first, then configured Finnhub or FMP calendars, and finally curated reference events. Every high-impact event mapped to either pair currency blocks signals from 30 minutes before through 30 minutes after its scheduled UTC time. The macro layer contributes 60% of confluence; H1/H4 technical confluence contributes 40%. Signals remain neutral unless both `abs(csi_spread) >= 60` and `abs(confluence_score) >= 45`. `killzone_active` is `LONDON_OPEN`, `NY_OVERLAP`, `ASIAN_RANGE`, or `OFF_SESSION`. `max_risk_pct` and `risk_multiplier` are position-sizing multipliers: 0.50% maximum in trending expansion, 0.25% maximum in mean reversion, and 0% during high-volatility chop, news lockout, or any failed validation gate. Missing or stale technical inputs, a fallback-only macro snapshot, a news lockout, or a high-volatility chop regime disables trading.

Live quotes and technical calculations use a 60-second Upstash TTL. Macro snapshots use a 900-second TTL; signals use a 15-second TTL with cache bypass around news-lockout boundaries.

## MT5 heartbeat and include

`POST /api/v1/ea-heartbeat` accepts the EA's private `x-algo-key` header plus `mt5_account`, `license_key`, `ea_name`, `account_number`, `balance`, `equity`, `floating_pnl`, `drawdown_pct`, `open_positions`, and `status`. The server validates the exact active license/account pair against Supabase before storing telemetry. `GET /api/v1/ea-heartbeat?mt5_account=...` and `GET /api/v1/trade-log?mt5_account=...` require the matching customer license in the `x-license-key` header; they are read-only, return `Cache-Control: no-store`, and fail closed with `503` when Supabase is unavailable or `401` for a mismatched/expired license. Never send broker master or investor passwords to FiduLync. `POST /api/v1/trade-log` accepts the same private `x-algo-key` plus `mt5_account`, `license_key`, `ticket`, `symbol`, `direction`, `entry_price`, `exit_price`, `profit_usd`, `r_multiple`, `confluence_score`, `regime`, and `closed_at_utc`. Trade records are persisted in Supabase `trade_ledger` with a unique account/ticket/symbol key; reads always filter by both account and license. Apply `supabase/migrations/202611150001_customer_account_telemetry.sql` before deploying these routes.

The shipped `public/mql5/MacroLyncBridge.mqh` has optional trailing `license_key` arguments on `MacroLyncSendHeartbeat` and `MacroLyncHeartbeatEveryFiveMinutes`; pass the buyer's EA license key. `LogClosedTrade` additionally requires the MT5 login and license key in its trailing `mt5_account` and `license_key` arguments. Example heartbeat call: `MacroLyncHeartbeatEveryFiveMinutes(..., "RUNNING", InpLicenseKey)`. Example close call: `LogClosedTrade(..., closedAtUtc, 5000, AccountInfoInteger(ACCOUNT_LOGIN), InpLicenseKey)`. Keep `ALGO_PRIVATE_API_KEY` server-side and in the EA configuration; it is distinct from the customer's license key. The customer Live Account Monitor polls every 15 seconds and displays only the bound account.

Download [`public/mql5/MacroLyncBridge.mqh`](./public/mql5/MacroLyncBridge.mqh) from `/store`; the displayed source and clipboard action use that exact file. It has no DLL dependencies, uses `char[]` buffers for `WebRequest()` and UTF-8 conversion buffers for JSON, and defaults signal execution to defensive hold on network errors, timeouts, non-200 or empty responses, malformed responses, or news lockout. `LogClosedTrade(...)` sends a validated close record; call it from the EA's `OnTradeTransaction` handler after the EA has determined the trade's realized USD P&amp;L, R multiple, confluence, regime, and UTC close timestamp. Set `#property strict` in the consuming `.mq5` EA; MQL5 ignores program properties placed in `.mqh` include files. Configure MetaTrader 5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** with the deployed HTTPS origin.

## Data providers and deployment

The macro adapter validates upstream policy rates, inflation, COT positioning, and catalysts; live data can be combined with a persisted Supabase snapshot. The CFTC adapter calculates non-commercial net-position percentiles. Candle provider responses must contain at least 200 chronologically valid candles per requested timeframe for EMA alignment and technical calculations.

The scheduled `/api/cron/sync-macro` route uses `CRON_SECRET`. Upstash provides shared EA heartbeat telemetry; when not configured, the dashboard reports process-local fallback storage.

Historical Supabase migrations are retained for auditability. The application does not expose escrow, billing or user-authentication routes. The escrow retirement migration removes empty escrow-only tables and revokes all client access to populated historical escrow/transaction records; those records are retained for audit and server-side retention only.

## Verification

```bash
npx tsc --noEmit
npm run build
```

Trading involves substantial risk. Signals are research and execution inputs, not guarantees; EAs must retain independent account-level exposure, equity, and drawdown controls.
