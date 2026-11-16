# MacroLync Institutional Terminal

MacroLync is a single-operator quantitative FX and macro terminal. AlgoLync is its proprietary strategy vault and MT5 VPS telemetry monitor. The browser has no account or subscription flow; MT5/EA API requests use a private `x-algo-key` header.

## Local development

```bash
npm install
npm run dev
```

Set server-side values in `.env.local` or the deployment secret manager. Start from `.env.example`; never commit a populated env file.

| Variable | Purpose |
| --- | --- |
| `ALGO_PRIVATE_API_KEY` | Private EA/API authentication key; header only |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Server-side shared cache |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged database key |
| `FINNHUB_API_KEY` | Optional FX quotes and economic calendar |
| `FRED_API_KEY` | Federal Reserve policy-rate, inflation and Treasury observations |
| `BEA_API_KEY` | Server-only BEA key for quarterly real GDP (NIPA T10101) |
| `BLS_API_KEY` | Server-only BLS v2 registration key for CPI, unemployment and payrolls |
| `GEMINI_API_KEY` | Optional server-side AI macro brief |
| `ALPHA_VANTAGE_API_KEY` / `FMP_API_KEY` | Optional market-data/calendar providers |
| `COT_DATA_PROVIDER_URL` / `COT_DATA_PROVIDER_TOKEN` | Optional COT provider |
| `MACRO_DATA_PROVIDER_URL` / `MACRO_DATA_PROVIDER_TOKEN` | Optional validated macro data provider |
| `MARKET_DATA_PROVIDER_URL` / `MARKET_DATA_PROVIDER_TOKEN` | Optional HTTPS candle provider |
| `CRON_SECRET` | Bearer secret for scheduled macro refresh |
| `PAYSTACK_SECRET_KEY` | Server-only payment initialization and verification |
| `RESEND_API_KEY` / `LICENSE_FROM_EMAIL` | Server-only license email delivery |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional private alert integration |
| `DISCORD_WEBHOOK_URL` | Optional private alert integration |
| `NEXT_PUBLIC_APP_URL` | Public canonical site origin |

Only values intentionally prefixed `NEXT_PUBLIC_` may be browser-visible. Provider keys, database secret/service-role keys, payment secrets, cron credentials, EA shared secrets, Redis tokens and alert webhook tokens must remain server-side and use Vercel Secret visibility. A public Supabase publishable/anon key is not an admin credential; RLS must still protect every exposed table.

**Rotation:** Any credential pasted into chat, source control, logs, screenshots or public issue comments should be rotated at its issuing provider. Replace the Vercel value, redeploy, verify the new credential, then revoke the old value. Rotate the EA shared key in both Vercel and every deployed EA configuration as one coordinated change. Never paste replacement secrets into chat.

## Signal engine and API

`GET /api/v1/macro-signal?symbol=EURUSD` returns a flat JSON signal. MT5 requests must send `x-algo-key: <ALGO_PRIVATE_API_KEY>`; credentials in URL query strings are rejected because URLs may be retained in access logs. The same-origin `/store` signal preview uses browser same-origin request metadata and never receives the private EA key.

The calendar uses FairEconomy/ForexFactory weekly JSON first, then configured Finnhub or FMP calendars, and finally curated reference events. Every high-impact event mapped to either pair currency blocks signals from 30 minutes before through 30 minutes after its scheduled UTC time. The macro layer contributes 60% of confluence; H1/H4 technical confluence contributes 40%. Signals remain neutral unless both `abs(csi_spread) >= 60` and `abs(confluence_score) >= 45`. Missing or stale technical inputs, fallback-only macro snapshots, news lockout, or high-volatility chop disables trading.

Live quotes and technical calculations use a 60-second Upstash TTL. Macro snapshots use a 900-second TTL; signals use a 15-second TTL with cache bypass around news-lockout boundaries.

## MT5 heartbeat and include

`POST /api/v1/ea-heartbeat` accepts the EA's private `x-algo-key` header plus account and telemetry fields. The server validates the exact active license/account pair against Supabase before storing telemetry. Customer telemetry reads require the matching customer license in the `x-license-key` header and return `Cache-Control: no-store`. Never send broker master or investor passwords to FiduLync. Closed trades are persisted in Supabase with a unique account/ticket/symbol key.

The shipped `public/mql5/MacroLyncBridge.mqh` uses `WebRequest()` and defensive hold on network errors, timeouts, non-200 or empty responses, malformed responses, or news lockout. Keep `ALGO_PRIVATE_API_KEY` server-side and in the EA configuration; it is distinct from the customer's EA license key. Configure MetaTrader 5 **Tools → Options → Expert Advisors → Allow WebRequest for listed URL** with the deployed HTTPS origin.

## Data providers and deployment

The macro adapter validates upstream policy rates, inflation, COT positioning and catalysts. The BEA adapter retrieves quarterly real GDP growth from NIPA table T10101; the BLS v2 adapter retrieves CPI-U headline/core indexes, unemployment and total nonfarm payroll series. CPI year-over-year uses the same month one year earlier; payroll change uses adjacent monthly observations. These official indicators are contextual macro inputs and do not independently enable execution. Provider keys remain server-side and observation periods must be shown separately from fetch time.

The scheduled `/api/cron/sync-macro` route uses `CRON_SECRET`. Upstash provides shared telemetry/cache. The current in-memory rate limiter is per server process and is not a substitute for distributed edge/WAF rate limiting; configure Vercel Firewall or a shared Redis limiter before opening customer-facing endpoints to high traffic.

## Security posture and release gate

- Alert dispatch fails closed and requires the EA private key.
- EA API credentials are accepted only in the `x-algo-key` header, not URL parameters.
- Response headers include HSTS, frame denial, MIME sniffing protection, referrer policy and restrictive browser feature permissions.
- Payment webhooks must verify Paystack HMAC signatures; license provisioning must remain idempotent and database-backed.
- Admin access requires strong unique credentials and MFA at the identity provider/dashboard level.
- Verify Supabase RLS on every exposed table, including customer licenses, transfers and telemetry.
- Use Vercel Firewall/shared rate limiting, alerting and tested backups before broad customer launch.
- Keep escrow entirely out of FiduLync; do not expose dormant escrow migrations/routes as product features.

## Verification

```bash
npx tsc --noEmit
npm run build
```

Trading involves substantial risk. Signals are research and execution inputs, not guarantees; EAs must retain independent account-level exposure, equity and drawdown controls.
