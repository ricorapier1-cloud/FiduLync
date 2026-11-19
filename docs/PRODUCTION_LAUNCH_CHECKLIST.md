# FiduLync Personal Quant Edition — Operating & Release Checklist

This is a private, single-operator quantitative research and MT5 EA-supervision workspace. It is not a commercial fintech product.

## Product scope

- MacroLync: official macroeconomic research, policy rates, inflation, real yields, COT positioning and event-risk context.
- QuantLync: multi-timeframe technical and statistical analysis, regime classification, market structure, volatility, correlation, currency strength and signal diagnostics.
- RiskLync: broker-aware position sizing, portfolio exposure, margin checks, drawdown limits, equity high-water protection, loss-streak controls and kill-switch governance.
- AlgoLync: private MT5 data gateway, EA health monitoring, research signal delivery and approve/reject/abstain/risk-ceiling supervision.
- Historical research: source-tagged datasets, reproducible backtests, out-of-sample evaluation, walk-forward analysis and Monte Carlo robustness checks.
- Supported initial universe: G10 FX and XAUUSD. XAGUSD is deferred until broker-specific contract size, tick size, tick value, margin and stop-distance metadata are verified.

## Explicit exclusions

No customer registration, checkout, subscriptions, Paystack, escrow, public EA marketplace, paid customer licences, customer support portal, copy trading, pooled funds or broker order execution by the central application.

Preserve the existing private owner email/password login, Supabase data, audit history, MT5 publisher security and useful research components. Do not delete historical financial or audit records merely because commercial workflows are retired.

## Owner access

- Use `/owner` with the existing registered owner email and password.
- Preserve password recovery and server-side owner verification.
- Enable Supabase leaked-password protection and configure a verified SMTP sender for account recovery.
- Keep service-role keys, MT5 publisher tokens and API keys server-side.
- Issue a separate one-time hashed publisher token for each trusted MT5 terminal; revoke tokens when a terminal is retired.

## Data-provider policy

- **FRED:** permitted for personal, non-commercial research subject to its terms, API key, required attribution and series-level third-party copyright notices. Do not scrape or mirror the service. FRED-derived observations are kept out of external AI prompts.
- **Frankfurter:** public reference exchange rates only; they are daily/reference observations, not real-time executable prices.
- **CFTC:** use official public COT reports; retain report date and source attribution. COT is weekly positioning context, not intraday flow.
- **Central banks / official statistical agencies:** prefer direct official sources for policy rates, CPI/HICP, GDP, employment, yields and releases. Preserve source URL, observation date and retrieval time.
- **BLS / BEA:** use official APIs with the required attribution and retrieval-date notes when their adapters are enabled.
- **Finnhub / Twelve Data / Alpha Vantage / FMP / FairEconomy / other vendors:** enable only when the specific personal subscription or free tier permits this app's internal display, programmatic access, caching and requested asset class. A present API key is not proof of entitlement.
- Never turn daily reference rates, stale caches, historical bars or unverified values into live prices. Every dataset must expose provider, source timestamp, retrieval timestamp, age, timeframe, broker (when applicable) and degraded/unavailable state.

## Required server environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access |
| `OWNER_EMAIL` | Exact single-owner identity |
| `CRON_SECRET` | Authenticates scheduled macro refresh |
| `ALGOLYNC_PRIVATE_KEY` | Legacy private supervisor API integration, if still used |
| `FRED_API_KEY` | Personal official macro research |
| `GEMINI_API_KEY` | Optional commentary only; never execution authority |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shared cache, if enabled |

Optional data-provider flags must remain false until the owner's own personal-use entitlement has been checked:

- `FINNHUB_PERSONAL_PLAN_ACTIVE`
- `TWELVE_DATA_PERSONAL_DISPLAY_PLAN_ACTIVE`
- `ALPHA_VANTAGE_PERSONAL_PLAN_ACTIVE`
- `FMP_PERSONAL_PLAN_ACTIVE`
- `FAIRECONOMY_PERSONAL_PLAN_ACTIVE`
- `MARKET_DATA_PROVIDER_PERSONAL_USE_ENABLED`
- `MACRO_DATA_PROVIDER_PERSONAL_USE_ENABLED`
- `COT_DATA_PROVIDER_PERSONAL_USE_ENABLED`
- `SNB_PERSONAL_USE_ENABLED`

Frankfurter public reference rates do not require a commercial approval flag and are not used as broker prices.

## MT5 connection (Windows terminal required)

1. Install MetaTrader 5 and log in to the intended broker terminal.
2. In `/owner`, create a uniquely labelled MT5 publisher installation and copy its one-time token.
3. Configure the publisher on the Windows terminal/VPS using the token in a private environment variable; never commit it.
4. Map broker-specific symbols, including suffixes, explicitly (for example, `EURUSD.a` or `XAUUSD.a`).
5. Publish broker bid/ask, closed H1/H4/D1 candles, symbol contract metadata, account equity/margin, open positions and closed-deal history.
6. Confirm quote freshness, candle completeness, installation identity and server ingestion timestamps in the owner console.
7. Compile all MQL5 includes/EAs in MetaEditor with zero errors and zero warnings. Run Strategy Tester, then demo forward testing.
8. Keep EA execution disabled until data, risk, model validation and execution-quality evidence pass independent review.

The web app can prepare and validate the server-side components, but it cannot compile MQL5 or verify a live broker terminal without a Windows MT5 environment.

## Quantitative validation standards

- Use closed bars only and preserve one source/broker/installation per candle series.
- Minimum technical history is a data-readiness gate, not evidence of predictive edge.
- Prevent look-ahead, survivorship, timestamp alignment and revised-data leakage.
- Separate in-sample, validation and untouched out-of-sample periods.
- Use walk-forward, Monte Carlo, parameter stability, spread/slippage/commission stress and regime-conditioned analysis.
- Report expectancy, profit factor, max drawdown, recovery factor, exposure, turnover, trade count, confidence intervals and risk-of-ruin assumptions.
- Do not label confluence scores as calibrated probabilities without calibration evidence.
- Record all abstentions and blockers. Missing, stale or contradictory data must produce DEGRADED/ABSTAIN.

## Current operational gates

- GitHub CI passes on the exact proposed commit.
- Vercel preview build succeeds and protected owner routes pass authenticated smoke tests.
- Production deployment commit matches the reviewed Git commit.
- Supabase RLS and security advisors have no unresolved critical exposure.
- Scheduled macro refresh authenticates and returns a truthful success/degraded response.
- At least one approved personal-use macro source is returning timestamped observations.
- MT5 publisher sends fresh broker quotes and closed candles; installation heartbeat is current.
- MQL5 compilation, Strategy Tester and demo forward test pass before any live execution.

## Safety policy

FiduLync is a research and supervisory tool, not a broker or managed account. It does not place, modify or close broker orders. Keep grids, martingale, averaging down and unbounded progressive sizing excluded. Risk limits, SL/TP checks, spread/slippage/news/weekend guards, margin floors, daily/weekly drawdown limits, high-water equity protection, loss-streak breakers and cooldown/hibernation controls must remain server-enforced or independently enforced in the EA.

No strategy profitability, win rate, execution quality or safety is certified merely because a build or API check passes.
