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
| `FRED_API_KEY` | Optional Federal Reserve policy-rate, Core PCE, CPI, and 2-year Treasury observations |
| `BEA_API_KEY` | Optional server-only BEA key for quarterly real GDP growth (NIPA table T10101) |
| `BLS_API_KEY` | Optional server-only BLS Public Data API v2 registration key for headline/core CPI, unemployment, and nonfarm payrolls |
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

`POST /api/v1/ea-heartbeat` accepts the EA's private `x-algo-key` header plus `mt5_account`, `license_key`, `ea_name`, `account_number`, `balance`, `equity`, `floating_pnl`, `drawdown_pct`, `open_positions`, and `status`. The server validates the exact active license/account pair against Supabase before storing telemetry. `GET /api/v1/ea-heartbeat?mt5_account=...` and `GET /api/v1/trade-log?mt5_account=...` require the matching customer license in the `x-license-key` header; they are read-only, return `Cache-Control: no-store`, and fail closed with `503` when Supabase is unavailable or `401` for a mismatched/expired license. Never send broker master or investor passwords to FiduLync. `POST /api/v1/trade-log` accepts the same private `x-algo-key` plus `mt5_account`, `license_key`, `ticket`, `symbol`, `direction`, `entry_price`, `exit_price`, `profit_usd`, `r_multiple`, `confluence_score`, `regime`, and `closed_at_utc`. Trade records are persisted in Supabase `trade_ledger` with a unique account/ticket/symbol key; reads always filter by both account and license. Apply `supabase/migrations/202611150001_customer_account_telemetry.sql` before deploying these routes.

The shipped `public/mql5/MacroLyncBridge.mqh` has optional trailing `license_key` arguments on `MacroLyncSendHeartbeat` and `MacroLyncHeartbeatEveryFiveMinutes`; pass the buyer's EA license key. `LogClosedTrade` additionally requires the MT5 login and license key in its trailing `mt5_account` and `license_key` arguments. Example heartbeat call: `MacroLyncHeartbeatEveryFiveMinutes(..., "RUNNING", InpLicenseKey)`. Example close call: `LogClosedTrade(..., closedAtUtc, 5000, AccountInfoInteger(ACCOUNT_LOGIN), InpLicenseKey)`. Keep `ALGO_PRIVATE_API_KEY` server-side and in the EA configuration; it is distinct from the customer's license key. The customer Live Account Monitor polls every 15 seconds and displays only the bound account.

Download [`public/mql5/MacroLyncBridge.mqh`](./public/mql5/MacroLyncBridge.mqh) from `/store`; the displayed source and clipboard action use that exact file. It has no DLL dependencies, uses `char[]` buffers for `WebRequest()` and UTF-8 conversion buffers for JSON, and defaults signal execution to defensive hold on network errors, timeouts, non-200 or empty responses, malformed responses, or news lockout. `LogClosedTrade(...)` sends a validated close record; call it from the EA's `OnTradeTransaction` handler after the EA has determined the trade's realized USD P&amp;L, R multiple, confluence, regime, and UTC close timestamp. Set `#property strict` in the consuming `.mq5` EA; MQL5 ignores program properties placed in `.mqh` include files. Configure MetaTrader 5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** with the deployed HTTPS origin.

## Data providers and deployment

The macro adapter validates upstream policy rates, inflation, COT positioning, and catalysts; live data can be combined with a persisted Supabase snapshot. When configured, the official BEA adapter retrieves quarterly real GDP growth from NIPA table T10101, while the official BLS v2 adapter retrieves CPI-U headline/core indexes, unemployment, and total nonfarm payroll series. The CPI indexes use the not-seasonally-adjusted series to match the standard year-over-year inflation comparison. BLS year-over-year CPI is calculated from the same month one year earlier; monthly payroll change is calculated from adjacent monthly observations. The MacroLync dashboard labels these as BEA/BLS observations and displays their observation periods separately from fetch time. Provider keys remain server-side and are never sent to the browser. BEA and BLS indicators are contextual macro inputs; they do not by themselves change the execution gate, which still requires verified policy/inflation inputs for the traded pair, a provider calendar, and valid technical data. The CFTC adapter calculates non-commercial net-position percentiles. Candle provider responses must contain at least 200 chronologically valid candles per requested timeframe for EMA alignment and technical calculations.

The scheduled `/api/cron/sync-macro` route uses `CRON_SECRET`. Upstash provides shared EA heartbeat telemetry; when not configured, the dashboard reports process-local fallback storage.

Historical Supabase migrations are retained for existing installations; the application no longer exposes the legacy escrow, billing, account, or user-authentication routes.

## Verification

```bash
npx tsc --noEmit
npm run build
```

Trading involves substantial risk. Signals are research and execution inputs, not guarantees; EAs must retain independent account-level exposure, equity, and drawdown controls.
