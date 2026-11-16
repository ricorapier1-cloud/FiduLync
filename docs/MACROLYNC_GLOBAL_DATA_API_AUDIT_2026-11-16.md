# MacroLync Global Data API Audit & Target Stack
Audit date: 2026-11-16
Scope: FiduLync feature branch `feat/algolync-marketplace-rebuild`, Vercel production environment-variable inventory (names/targets only), current MacroLync source code, public provider documentation.

## Executive decision

Adopt a hybrid architecture:
- Research layer: official, point-in-time macroeconomic/statistical sources and carefully licensed cross-asset/news feeds.
- Market layer: broker MT5 bid/ask candles for broker-specific execution context; optionally a separately licensed institutional FX feed for independent research.
- Model layer: normalized observations, factor construction, regime-aware research, calibrated forecasts, and a fail-closed execution-eligibility gate.
- Presentation layer: always expose source, observation date, publication time, retrieval time, freshness, vintage, quality and licence class.

Do not add providers merely to increase the provider count. Prefer original official sources, redundant sources for critical series, low call frequency, server-side caching, schema validation and explicit failure states.

## 1. Existing production configuration inventory

The Vercel environment inventory contains these relevant variable names:
- Configured: `FRED_API_KEY`, `FINNHUB_API_KEY`, `GEMINI_API_KEY`, `FX_API_KEY`, `CRON_SECRET`, Upstash Redis URL/token, Supabase project credentials.
- Not present in the inspected inventory: `MARKET_DATA_PROVIDER_URL`, `MARKET_DATA_PROVIDER_TOKEN`, `COT_DATA_PROVIDER_URL`, `COT_DATA_PROVIDER_TOKEN`, `MACRO_DATA_PROVIDER_URL`, `MACRO_DATA_PROVIDER_TOKEN`, `FMP_API_KEY`, `ALPHA_VANTAGE_API_KEY`.
- `FX_API_KEY` is not documented in `.env.example`; trace its consumers and provider before relying on it.
- `FINNHUB_API_KEY` and `FRED_API_KEY` are configured, but their secret values were not revealed or submitted to provider endpoints. Credential validity, quota, account plan and commercial/display rights are therefore NOT VERIFIED.
- `GEMINI_API_KEY` is configured, but AI text generation must remain an optional explanation layer, never the source of numeric facts or a substitute for deterministic calculations.

Important production blocker:
- `lib/technicalEngine.ts` returns unavailable when `MARKET_DATA_PROVIDER_URL` is missing. Thus H1/H4/D1 technical analysis cannot become execution-eligible from the current production configuration.
- `lib/marketFeeds.ts` can retrieve Finnhub quotes, but those quotes are not a substitute for a full timestamped OHLC candle history, bid/ask spread, or the customer's broker execution feed.
- Frankfurter and open.er-api.com are reference FX-rate fallbacks, not executable intraday spot prices. Label them daily/reference and never call them live trading quotes.
- Gold-API is a separate XAU reference source; verify freshness, terms and licensing before displaying it commercially.
- CFTC direct public reporting is already implemented; weekly COT data is not live intraday positioning.
- FairEconomy is used for calendar data, with Finnhub/FMP optional adapters. The calendar must identify which source supplied each event and must never silently present curated fallback events as verified current data.

## 2. Provider audit and recommended role

### Existing integrations

| Provider | Current role in code | Status / recommended treatment |
|---|---|---|
| FRED / ALFRED | USD policy, Core PCE, CPI, 2Y Treasury series | Key configured; request health and terms review required. Add ALFRED point-in-time vintages for unbiased historical training. Do not assume blanket redistribution rights for third-party series. |
| ECB Data Portal | EUR policy, HICP, 2Y benchmark yield | Direct no-key SDMX-style calls already present. Keep; capture observation date and series metadata, verify the exact series keys and definitions. |
| Bank of Canada Valet | CAD policy/CPI and financial series | Direct no-key API already present. Keep; official documentation says no registration/key or fee, asks for sensible pacing/caching, and has a processing delay caveat. |
| Bank of England IADB | UK Bank Rate | Direct public CSV query already present. Keep, but verify returned observation date and parser resilience. BOE yield-curve data is downloadable but the BOE says its yield-curve data are not offered through an API. |
| World Bank Indicators | G10 CPI fallback/reference | No-key API already present. Keep for slow-moving annual context only; never substitute annual CPI for current monthly CPI without a clearly labelled frequency mismatch. |
| CFTC Socrata COT | Futures positioning | Direct public API already present. Keep; display report week, publication date and contract definition. No token is generally required; pace requests and cache. |
| Finnhub | FX quote and economic-calendar adapters | Key configured; actual credential/quota and commercial rights unverified. Current forex-specific paid plan is listed separately from basic equities access; do not assume free-tier forex access or commercial display rights. Keep disabled as a required dependency until plan and terms are confirmed. |
| FairEconomy calendar | Weekly economic calendar | Existing direct JSON feed. Treat as a secondary calendar source; verify licence, timestamps/time zones, coverage and availability. Never use fallback as proof of current event status. |
| Frankfurter | ECB-derived daily FX reference rates | Keep only as a daily reference/backup, not an intraday trading feed. |
| open.er-api.com | FX reference rates | Keep only as reference backup; validate timestamp and terms, not as an execution source. |
| Gold-API | XAU reference price | Optional reference source; validate licence, timestamp, update cadence and commercial display rights. |
| Gemini | Narrative explanation | Optional. Numeric model facts must be computed by deterministic code and supplied to Gemini as structured inputs; validate output and prohibit invented values. |

### Add next: free or no-key official sources

| Priority | Provider | What it adds | Access / constraints | Use |
|---|---|---|---|---|
| P0 | US BLS Public Data API | CPI, PPI, payrolls, unemployment, wages, productivity | Free. V1: 25 queries/day, 25 series, 10 years; registered V2: 500/day, 50 series, 20 years, annual renewal | Official US labour and inflation cross-check; use registered V2 key server-side |
| P0 | US BEA API | GDP, PCE, personal income/spending, trade | Free registration key; published limits apply | GDP/PCE source-of-record and revisions |
| P0 | IMF Data API (SDMX 2.1/3.0) | BOP, IFS, reserves, exchange rates, external sector, projections | Official API; portal/beta authentication may be required for some workflows/datasets | Global external-balance and reserve context |
| P0 | Eurostat REST API | Euro area/EU HICP, labour, trade, industrial production, GDP | Free, no API key; datasets updated twice daily; latest dataset versions are not historical vintages | EUR macro coverage and cross-country comparison |
| P0 | ECB Data Portal API | Euro-area rates, money/credit, yields, exchange rates, HICP | No key for public API; reuse/attribution terms apply | Expand existing EUR integration |
| P1 | OECD SDMX API | Comparable OECD growth, labour, prices, leading indicators | Free public API; pace requests and obey provider terms | Cross-country comparability and leading indicators |
| P1 | World Bank API | Global GDP, CPI, trade, debt and development indicators | Free, no key; generally low-frequency and lagged; CC BY 4.0 applies to much World Bank data subject to source-specific exceptions | Long-run structural features, not release-day triggers |
| P1 | US Treasury Fiscal Data API | Treasury yields, debt, fiscal cash/balance data | Free, no key | Fiscal supply/debt and sovereign-rate context |
| P1 | US EIA Open Data API | Crude, refined products, natural gas, inventories | Free API key | Oil/energy terms-of-trade drivers for CAD/NOK and risk |
| P1 | GDELT 2.1 | Global news/event monitoring | Public access; not a verified market-data source and no guaranteed FX relevance/latency | Candidate event discovery only; classify, deduplicate and human/model validate |
| P2 | DBnomics | Normalized access to many official national providers | Open aggregator; each upstream dataset retains its own licence and refresh schedule | Discovery/backfill convenience; source provenance must retain original publisher |
| P2 | Official RBA, RBNZ, BOJ, SNB, Norges Bank, Riksbank datasets | Policy decisions, rates, balance sheets, forecasts and releases | Many official downloads/API routes are public; endpoint formats and reuse terms differ | Build country adapters only after series and release metadata are mapped |

## 3. Market-price feed recommendation

### Primary execution truth
Use the customer's connected MT5 broker feed for:
- Bid and ask ticks; spread; broker symbol suffix mapping.
- H1/H4/D1 candles from the broker's actual history.
- Tick size/value, contract size, trading sessions, swaps and symbol specifications.
- Broker/server time, candle-close time, quote age, missing-bar detection.
- Execution slippage and latency telemetry after the EA is installed.

MacroLync server research must not pretend it can access every customer's private MT5 terminal automatically. The EA can send an authenticated, rate-limited telemetry/market snapshot to FiduLync if the customer consents and the protocol is designed for it.

### Independent research data
Twelve Data is a strong candidate for development/testing: its current Basic plan lists 8 API credits/minute and 800/day, with real-time forex in the plan. However, the provider's current plan separates personal-use and commercial-use entitlements. The free tier is not automatically a licence for a paid public commercial application or external data display. Do not put Twelve Data free data into a commercial customer-facing display or paid signal feed until written plan/terms clearance is obtained.

Finnhub forex pricing likewise lists paid forex tiers and personal-use terms. A configured FINNHUB_API_KEY does not prove the account has forex OHLC or economic calendar rights.

Do not recommend Alpha Vantage free tier as the live market engine: its free request allowance is small (commonly 25/day) and it is unsuitable for continuous multi-pair intraday H1/H4/D1 refresh. Use only for low-frequency development or a specific permitted dataset after verifying current terms.

No free API should be described as consolidated institutional spot FX volume. Spot FX is OTC and fragmented. Futures volume/open interest (e.g. CME) is a separate proxy and requires appropriate data rights.

## 4. Global FX driver coverage map

For every currency, build a country driver matrix with source and frequency:

1. Monetary policy: policy rate, meeting calendar, official statement/minutes, projected path, OIS/futures-implied repricing where licensed, policy surprise.
2. Inflation: headline/core CPI/HICP/PCE, monthly and annual momentum, services/shelter/wage persistence, inflation expectations.
3. Growth: GDP, PMI/ISM, industrial production, retail sales, consumption, business surveys and leading indicators.
4. Labour: payrolls/employment, unemployment, participation, vacancies, wages and hours.
5. Sovereign rates: 2Y/5Y/10Y yields, real yields, curve slope, term premium where available, base-quote yield differentials and momentum.
6. External sector: current account, trade balance, exports/imports, FX reserves, capital flows and terms of trade.
7. Fiscal: debt issuance, deficits, debt service, sovereign supply and fiscal risk.
8. Commodities: oil, gas, gold, industrial metals, agriculture and country-specific export baskets.
9. Positioning: CFTC futures COT, report-week change, percentile, z-score and crowding; clearly mark weekly publication lag.
10. Risk regime: equity volatility, credit spreads, global equities, funding stress, safe-haven flows and cross-asset correlations.
11. Geopolitical/supply shocks: GDELT and official government/central-bank releases as event discovery, not unquestioned facts.
12. Market microstructure: broker bid/ask, spread percentiles, session liquidity, rollover, gap risk, slippage and quote quality.

Pair research must be relative: base currency factor vector minus quote currency factor vector, with explicit commodity and safe-haven exposures for crosses and XAUUSD.

## 5. Quantitative research standards

- Store immutable raw observations and a separate normalized feature table.
- Every observation has provider, series ID, unit, frequency, seasonal adjustment, observation period, publication timestamp, retrieval timestamp, vintage/revision, source licence, transformation and quality state.
- Use ALFRED/point-in-time vintages wherever available. Prevent look-ahead from revised GDP/CPI and revised calendars.
- Never mix monthly CPI, quarterly GDP and daily yields without frequency-aware transformations and documented alignment.
- Use robust rolling/expanding z-scores, percentile ranks, surprise z-scores and factor contributions.
- Use relative-value factor scores: base minus quote. Do not make a pair's score dependent on missing currencies or synthetic proxy values.
- Separate fundamental regime, technical regime, forecast probability, and execution eligibility.
- Fixed weights are research priors only. Calibrate using training-only walk-forward windows; test out of sample and by regime.
- Report hit rate only with sample size and confidence intervals; also report Brier/log loss for forecasts, calibration, turnover, drawdown, costs and benchmark comparisons.
- Add purged/embargoed walk-forward validation for overlapping horizons, multiple-testing controls, feature stability and drift monitoring.
- No LLM-generated values or signals. Gemini may summarize already-computed evidence and cite source IDs.
- If required inputs are stale, missing, revised unexpectedly or contradictory, emit INSUFFICIENT_DATA / ABSTAIN. Never silently replace a missing provider input with a hardcoded reference value for an execution decision.
- Rename `safe_to_trade` to `execution_eligible` in a versioned API contract. It only means configured checks passed, not that a trade is safe or profitable.
- Keep max risk percentage and risk multiplier as distinct fields with documented units; current signal code assigns the same numeric value to both.

## 6. Production blockers and implementation sequence

P0 — before live signals:
1. Configure and test an authorized H1/H4/D1 candle feed; otherwise technical signals remain unavailable.
2. Add feed health checks, timestamp/age checks, spread data, broker metadata and stale-data kill switch.
3. Verify FRED/Finnhub credentials without disclosing them; record provider status, quota, account plan and permitted use.
4. Stop labelling daily Frankfurter/exchangerate-api reference rates as live prices.
5. Add per-series source, observation date, release timestamp and freshness metadata to MacroSnapshot.
6. Remove fallback event dates from execution eligibility. If the calendar source fails, signal is ineligible.
7. Review licensing/redistribution for every customer-facing commercial data field.

P1 — broaden fundamental coverage:
1. Add BLS and BEA official US series.
2. Expand ECB and Eurostat series for EUR.
3. Add IMF, OECD and World Bank global data.
4. Add EIA commodity fundamentals and US Treasury fiscal series.
5. Add official country adapters for JPY, CHF, AUD, NZD, NOK and SEK with country-specific series definitions.

P2 — institutional factor research:
1. Add point-in-time observation storage and vintage-aware historical datasets.
2. Add factor attribution, standardized surprises and relative pair scores.
3. Add risk-on/off and cross-asset regime factors.
4. Add out-of-sample walk-forward evaluation, model cards, drift monitoring and shadow forecasts.

P3 — customer-grade operational reliability:
1. Provider health/status page, last-success times, quota and incident logging.
2. Alerting for stale feeds, failed syncs, schema changes and calendar gaps.
3. Versioned signal schema and API compatibility tests for MT5 clients.
4. Broker-specific spread/slippage telemetry and per-customer execution diagnostics.

## 7. Legal and commercial-use gate

Free access is not the same as permission to redistribute data or display it in a paid service.
- FRED requires attribution and has restrictions; some series are third-party owned. Review the FRED/API terms and each series' source rights before commercial display or redistribution.
- ECB data can be reused subject to attribution, disclaimer and disclosure conditions; reference rates are informational.
- Bank of Canada Valet is free and no-key, but terms and attribution apply; paid products must disclose that the data are freely available from the Bank and indicate changes.
- World Bank data are generally under CC BY 4.0, subject to source-specific exclusions and attribution.
- Eurostat API is free; follow Eurostat reuse and attribution conditions.
- BLS and US government data have public-use provisions; cite source and verify exceptions.
- CFTC public data can be queried without a token at reasonable rates; retain source/report metadata.
- Finnhub, Twelve Data, FMP, Alpha Vantage, market quote providers and news providers have plan-specific personal/commercial/display and redistribution terms. No customer-facing commercial usage until approved by the provider's applicable licence.
- Do not scrape websites, bypass quotas, proxy around restrictions, or copy third-party EAs/data without an explicit compatible licence.

## 8. Official references

- FRED API: https://fred.stlouisfed.org/docs/api/fred/
- FRED legal/terms: https://fred.stlouisfed.org/legal/
- BLS API FAQ and limits: https://www.bls.gov/developers/api_faqs.htm
- IMF Data API: https://data.imf.org/en/Resource-Pages/IMF-API
- Eurostat API introduction: https://ec.europa.eu/eurostat/en/web/user-guides/data-browser/api-data-access/api-introduction
- ECB Data Portal API: https://data.ecb.europa.eu/help/api/overview
- Bank of Canada Valet API: https://www.bankofcanada.ca/valet/docs/
- Bank of Canada Valet how-to and terms: https://www.bankofcanada.ca/valet-api-how-to/
- CFTC COT API: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- US Treasury Fiscal Data: https://fiscaldata.treasury.gov/api-documentation/
- US EIA API: https://www.eia.gov/opendata/
- Twelve Data pricing: https://twelvedata.com/pricing
- Finnhub forex pricing: https://api.finnhub.io/pricing-forex-api
- GDELT: https://www.gdeltproject.org/

## Final status

This is an architecture and source audit, not a claim that all providers have passed live credential tests. The current production inventory proves only that selected key names are configured. The critical market-candle endpoint is absent. MacroLync must remain in research/abstain mode for execution until data provenance, licence rights, technical candles, calendar reliability and out-of-sample validation pass.
