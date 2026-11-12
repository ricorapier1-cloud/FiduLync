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
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint for shared caching and EA heartbeat state; in-process TTL fallback is used if unavailable |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Upstash REST token |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL for persisted macro snapshots |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional server-only Supabase persistence access; never expose to a browser |
| `FINNHUB_API_KEY` | Optional FX quotes and economic calendar |
| `FRED_API_KEY` | Optional Federal Reserve policy-rate and inflation observations |
| `ALPHA_VANTAGE_API_KEY` | Optional fallback US policy-rate and CPI observations |
| `FMP_API_KEY` | Optional economic calendar provider |
| `MACRO_DATA_PROVIDER_URL` | Optional HTTPS endpoint returning validated currencies, COT positions, and catalysts |
| `MACRO_DATA_PROVIDER_TOKEN` | Optional bearer token for the macro provider |
| `COT_DATA_PROVIDER_URL` | Optional HTTPS COT override; the public CFTC futures-only feed is used by default |
| `COT_DATA_PROVIDER_TOKEN` | Optional bearer token for the COT provider |
| `MARKET_DATA_PROVIDER_URL` | HTTPS candle endpoint accepting `pair` and `timeframe=H1|H4` |
| `MARKET_DATA_PROVIDER_TOKEN` | Optional bearer token for the candle provider |
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
  "news_lockout": false,
  "safe_to_trade": false,
  "timestamp_utc": "2026-11-12T00:00:00.000Z"
}
```

Send `x-algo-key: <ALGO_PRIVATE_API_KEY>` on signal requests. An optional `?key=` query parameter is supported for WebRequest clients; prefer the header to avoid exposing credentials in URLs and access logs. The same-origin `/store` signal preview uses browser same-origin request metadata and never receives the private EA key. The macro layer contributes 60% of the confluence score (real-yield and policy-rate differentials plus COT positioning); H1/H4 technical confluence contributes 40% using Gaussian Z-scores, KER, ADX, and ATR distances. Tier-1 high-impact NFP, CPI, FOMC, ECB, and BOE calendar events set a 30-minute pre/post news lockout. Missing or stale technical inputs, a fallback-only macro snapshot, a news lockout, or a high-volatility chop regime disables trading.

Live quotes and technical calculations use a 60-second Upstash TTL. FRED and other macro snapshot inputs use a 3,600-second TTL. The signal response itself is not cached, so a news-lockout boundary is evaluated against the current time on every request.

## MT5 heartbeat and include

`POST /api/v1/ea-heartbeat` accepts JSON fields `ea_name`, `account_number`, `balance`, `equity`, `floating_pnl`, `drawdown_pct`, `open_positions`, and `status`, and requires the same `x-algo-key` credential. Each latest state expires after 900 seconds; the AlgoLync Store labels missing/stale heartbeats `OFFLINE`. When Redis is down or not configured, heartbeat writes and reads fall back to process-local TTL storage; cross-instance persistence requires Redis.

Download [`public/mql5/MacroLyncBridge.mqh`](./public/mql5/MacroLyncBridge.mqh) from `/store`; the displayed source and clipboard action use that exact file. It has no DLL dependencies, uses `char[]` buffers for `WebRequest()` and UTF-8 conversion buffers for JSON, and defaults signal execution to defensive hold on network errors, timeouts, non-200 or empty responses, malformed responses, or news lockout. Set `#property strict` in the consuming `.mq5` EA; MQL5 ignores program properties placed in `.mqh` include files. Configure MetaTrader 5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** with the deployed HTTPS origin.

## Data providers and deployment

The macro adapter validates upstream policy rates, inflation, COT positioning, and catalysts; live data can be combined with a persisted Supabase snapshot. The CFTC adapter calculates non-commercial net-position percentiles. Candle provider responses must contain at least 200 chronologically valid candles per requested timeframe for EMA alignment and technical calculations.

The scheduled `/api/cron/sync-macro` route uses `CRON_SECRET`. Upstash provides shared EA heartbeat telemetry; when not configured, the dashboard reports process-local fallback storage.

Historical Supabase migrations are retained for existing installations; the application no longer exposes the legacy escrow, billing, account, or user-authentication routes.

## Verification

```bash
npx tsc --noEmit
npm run build
```

Trading involves substantial risk. Signals are research and execution inputs, not guarantees; EAs must retain independent account-level exposure, equity, and drawdown controls.
