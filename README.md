# FiduLync Personal Quant Edition

> **Private, single-operator quantitative research workstation. Personal, non-commercial use only.**

FiduLync combines fundamental macro research, quantitative technical/statistical analysis, portfolio-risk intelligence and private MetaTrader 5 data/supervision tooling. It is intended for the owner's research and analysis. It is not a broker, customer SaaS, investment adviser, managed account, copy-trading service or public EA marketplace. The central application does not place, modify or close broker orders.

## Research modules

- **MacroLync** — central-bank policy, inflation, real-rate context, yields, COT positioning, economic catalysts and cross-country macro differentials.
- **QuantLync** — multi-timeframe technical analysis, market structure, volatility, correlation, currency strength, regime classification, statistical diagnostics and signal research.
- **RiskLync** — broker-aware risk sizing, margin and exposure checks, drawdown limits, equity high-water protection, loss-streak controls, cooldowns and defensive abstention.
- **AlgoLync** — private MT5 market-data publisher, terminal health telemetry, EA supervision decisions, risk ceilings and owner-only release evidence for personal EA builds.
- **Research validation** — historical data provenance, closed-bar calculations, walk-forward testing, out-of-sample evaluation, parameter stability and execution-cost stress.

Initial research universe: G10 FX and XAUUSD. XAGUSD is deferred until broker-specific symbol contract, tick size/value, volume step, stop distance and margin metadata are verified.

## Data integrity policy

A configured API key is not proof of a current data response or a provider entitlement.

- Every market observation must retain provider, source timestamp, retrieval timestamp, symbol, timeframe and broker/terminal identity where relevant.
- Broker quotes from the owner's MT5 terminal are the preferred source for executable bid/ask and broker candles.
- Frankfurter provides daily reference exchange rates only; these are never executable or real-time broker quotes.
- CFTC COT reports are weekly positioning context, not intraday order flow.
- FRED data may be used for personal, non-commercial research subject to its terms, attribution and any series-level copyright notices. FRED-derived observations are not sent to external AI prompts.
- Official BLS adapters retrieve headline/core CPI, unemployment and nonfarm payroll series; the BEA NIPA adapter retrieves annualized quarterly real GDP when `BEA_API_KEY` is configured. FRED adds daily 2Y/10Y nominal yields, 10Y TIPS real yield, 10Y breakeven inflation, the broad trade-weighted USD index, VIX, S&P 500, WTI/Brent oil and US high-yield credit spreads. These are macro research context with observation dates, not intraday quotes. BLS/BEA release timestamps and historical vintages are not yet joined, so these series are excluded from point-in-time backtests and causal signal factors.
- Finnhub, Twelve Data, Alpha Vantage, FMP, FairEconomy and custom feeds remain disabled unless the owner's personal plan explicitly permits the exact asset class, programmatic access, caching and in-app display.
- Stale, missing, revised, incomplete or contradictory data must produce an unavailable/degraded state. No reference values, demo values or cached data may be labelled live.

## Architecture

- Next.js / TypeScript application deployed through Vercel.
- Supabase Auth and PostgreSQL for the single owner identity, private installations, market observations, risk decisions, audit events and research state.
- Upstash Redis for bounded shared caching and distributed rate limiting where configured.
- Official macro adapters and provider-specific market-data adapters.
- Windows MT5 Python publisher for broker quotes, closed candles, account/risk telemetry and verified closed-deal history.
- MQL5 Quant Supervisor include for authenticated, fail-closed research/risk decisions.
- Gemini is optional commentary only. It is never execution authority and receives no FRED-derived observations.

## Personal-use scope

The active application does not use customer registration, checkout, Paystack, subscriptions, escrow, customer licensing, customer portals or commercial support workflows. Legacy commercial routes return HTTP 410 Gone; historical database and audit records are retained rather than deleted. The owner login and private MT5 installation tokens remain.

## Private owner access

1. Open the /owner route.
2. Sign in with the already registered owner email/password account.
3. Use the private Owner Console to register a trusted MT5 terminal and issue its one-time publisher token.
4. Store the token privately. The server stores its hash; never paste it into public chat, source control or screenshots.
5. Revoke an installation token if the terminal or machine is retired.

There is no public owner registration.

## MT5 integration

The MT5 publisher must run on the same Windows machine/VPS as the already logged-in MetaTrader 5 terminal.

1. Install MetaTrader 5 and log in to the intended broker account.
2. Download FiduLync_MT5_Market_Publisher.py and mt5_risk_state.py from the Personal EA Lab.
3. Install Python and the MetaTrader5 package: py -m pip install MetaTrader5.
4. Register the terminal in /owner and set FIDULYNC_INGEST_URL to https://fidulync.vercel.app/api/v1/market-data/ingest and FIDULYNC_PUBLISHER_TOKEN in the Windows environment.
5. Configure canonical-to-broker symbol mappings, including suffixes, for example EURUSD=EURUSD.a and XAUUSD=XAUUSD.a.
6. Run the publisher and confirm fresh quotes, closed candles, account snapshots and installation heartbeat in the owner console.
7. Download QuantSupervisor.mqh to MQL5/Include/FiduLync/QuantSupervisor.mqh. Compile the EA and the no-trade connectivity probe in MetaEditor.
8. Configure the EA with the installation ID and private publisher token. Keep token-bearing .set files private.
9. Run MetaEditor compilation with zero errors and zero warnings, Strategy Tester, and demo forward testing before considering live use.

For long-term research, run the separate Historical Candle Backfill utility once after the terminal is connected. It imports only broker-provided closed H1/H4/D1 bars from the configured start date (default 1996-01-01), in bounded batches, and reports actual coverage. Broker retention may be shorter than 30 years; missing periods remain missing and must never be synthesized. The Windows MT5 environment is required for actual MQL5 compilation and broker-terminal validation. A web build cannot prove that an EA compiles or that a broker feed is live.

## Server environment

See .env.example. Core variables include:

- PERSONAL_QUANT_EDITION=true
- NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL, and server-side Supabase secret/service-role key
- OWNER_EMAIL
- CRON_SECRET
- FRED_API_KEY for permitted personal macro research\n- BLS_API_KEY optional for higher BLS API limits; BEA_API_KEY required for BEA GDP
- UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN when shared caching/rate limiting is enabled
- GEMINI_API_KEY optional; FRED observations are excluded from prompts

Optional market-data plans require explicit personal-use flags in .env.example. Leave those flags false until the owner's provider plan permits the exact use.

## Development and quality checks

~~~bash
npm ci
npm run lint
npx tsc --noEmit
npm run test:quant
npm run build
~~~

The CI workflow also validates the Python publisher syntax and MT5 risk telemetry tests.

## Risk and research standards

- Use closed bars for technical calculations; do not mix brokers or symbol contracts in one series.
- Prevent look-ahead, survivorship, timestamp alignment and revised-data leakage.
- Separate in-sample, validation and untouched out-of-sample periods.
- Use walk-forward analysis, Monte Carlo, parameter stability and realistic spread/commission/swap/slippage stress.
- Report expectancy, profit factor, max drawdown, recovery factor, exposure, turnover, trade count and uncertainty.
- Do not label confluence scores as calibrated probabilities without calibration evidence.
- Ghost Protocol is a deterministic 0–1 market-quality gate with a 0.65 minimum. It requires fresh broker quotes and candles from the same MT5 installation, then scores structure, ATR expansion/stability, spread quality and spread-to-ATR shock. It is not a win probability.
- Default personal risk policy: 1% maximum per-trade risk, 2% portfolio risk, 4% daily drawdown, 8% weekly drawdown, 15% high-water drawdown, 10% maximum margin usage, 30-point maximum spread, 0.12 spread/ATR ceiling, three consecutive losses and 1.5 minimum reward/risk. Execution, model validation and execution-quality switches remain disabled until owner demo validation.
- Keep grids, martingale, averaging down and unbounded progressive sizing excluded.
- Enforce SL/TP, margin, spread, slippage, news/weekend, daily/weekly drawdown, equity high-water and loss-streak protections in the EA as well as the supervisory service.
- Missing or stale data must result in DEGRADED/ABSTAIN, never a guessed signal.

## Current readiness boundaries

A passing GitHub build verifies code quality, not live-data availability, MQL5 compilation, broker connectivity or strategy profitability. The MT5 installation/quote/candle/heartbeat/trade tables remain empty until the owner runs the publisher from a Windows MT5 terminal. Official macro research refreshes on the providers' actual publication cadence, through the Vercel production daily cron and on-demand refresh; a separate GitHub Actions scheduler is intentionally not used. FX tick-level quotes and closed broker candles come from the private MT5 publisher, not the macro cron. Production promotion requires a preview build of the exact reviewed commit, authenticated owner smoke tests and successful runtime verification.

This application is a research and supervisory tool. It does not certify an EA, strategy, broker connection or live-trading system as profitable or safe.
