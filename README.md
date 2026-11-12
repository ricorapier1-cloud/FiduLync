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

Send `x-algo-key: <ALGO_PRIVATE_API_KEY>` on signal requests. An optional `?key=` query parameter is supported for WebRequest clients; prefer the header to avoid exposing credentials in URLs and access logs. The same-origin `/store` signal preview uses browser same-origin request metadata and never receives the private EA key. The calendar uses FairEconomy/ForexFactory weekly JSON first, then configured Finnhub or FMP calendars, and finally curated reference events. Every high-impact event mapped to either pair currency blocks signals from 30 minutes before through 30 minutes after its scheduled UTC time. The macro layer contributes 60% of confluence; H1/H4 technical confluence contributes 40%. Signals remain neutral unless both `abs(csi_spread) >= 60` and `abs(confluence_score) >= 45`. `killzone_active` is `LONDON_OPEN`, `NY_OVERLAP`, `ASIAN_RANGE`, or `OFF_SESSION`. `max_risk_pct` and `risk_multiplier` are position-sizing multipliers: 1.0 in trending expansion, 0.5 in mean reversion, and 0 during high-volatility chop, news lockout, or unavailable technical data. Missing or stale technical inputs, a fallback-only macro snapshot, a news lockout, or a high-volatility chop regime disables trading.

Live quotes and technical calculations use a 60-second Upstash TTL. Macro snapshots use a 900-second TTL; signals use a 15-second TTL with cache bypass around news-lockout boundaries.

## MT5 heartbeat and include

`POST /api/v1/ea-heartbeat` accepts JSON fields `ea_name`, `account_number`, `balance`, `equity`, `floating_pnl`, `drawdown_pct`, `open_positions`, and `status`, and requires the same `x-algo-key` credential. Each latest state expires after 900 seconds; the AlgoLync Store labels missing/stale heartbeats `OFFLINE`. `POST /api/v1/trade-log` accepts `ticket`, `symbol`, `direction`, `entry_price`, `exit_price`, `profit_usd`, `r_multiple`, `confluence_score`, `regime`, and `closed_at_utc`, and is protected by the same key. Ticket/symbol pairs are idempotent. Trade history is stored in Upstash when configured and falls back to process memory otherwise. The Store calculates win rate, profit factor, average R, and closed-P&amp;L peak drawdown from recorded trades; the drawdown is not an account-equity drawdown because the API does not receive starting account equity.

Download [`public/mql5/MacroLyncBridge.mqh`](./public/mql5/MacroLyncBridge.mqh) from `/store`; the displayed source and clipboard action use that exact file. It has no DLL dependencies, uses `char[]` buffers for `WebRequest()` and UTF-8 conversion buffers for JSON, and defaults signal execution to defensive hold on network errors, timeouts, non-200 or empty responses, malformed responses, or news lockout. `LogClosedTrade(...)` sends a validated close record; call it from the EA's `OnTradeTransaction` handler after the EA has determined the trade's realized USD P&amp;L, R multiple, confluence, regime, and UTC close timestamp. Set `#property strict` in the consuming `.mq5` EA; MQL5 ignores program properties placed in `.mqh` include files. Configure MetaTrader 5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** with the deployed HTTPS origin.

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
