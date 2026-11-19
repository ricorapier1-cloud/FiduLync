# FiduLync / MacroLync — Seven-Stage Personal Quant Architecture

**Product boundary:** one owner, personal non-commercial use, no customers, public EA catalog, subscriptions, payments, checkout, escrow, commercial licensing, or multi-tenant seats. The application is a research and read-only supervisory terminal. It must never send, modify, or close broker orders.

## 1. Seven-stage pipeline

| Stage | Responsibility | Existing implementation | Added foundation | Remaining integration |
|---|---|---|---|---|
| 1. Ingestion | Official macro series, COT, permitted market references, private MT5 quotes/bars/spreads | `lib/macroEngine.ts`, `lib/marketFeeds.ts`, `app/api/v1/market-data/ingest/route.ts` | `macro_observations`, `feed_health_events` | Persist official release/vintage metadata from each adapter; confirm Finnhub/CFTC access rights and provider plans before enabling |
| 2. Integrity | UTC, point-in-time release controls, schema checks, freshness, circuit breakers | MT5 ingest schema/time checks and provider fallbacks | `lib/quantPipeline.ts` timestamp, PIT and feed-health primitives | Wire feed health into each provider adapter and surface feed-specific status |
| 3. Regimes | Policy divergence/real yields plus Hurst, KER, Z-score, ATR/volatility state | `lib/signalEngine.ts`, `lib/quantGovernance.ts`, QuantLync indicators | `classifyMarketRegime` | Persist synchronized inputs and calibrated thresholds; distinguish event lockout from ordinary volatility |
| 4. Cross-asset | Currency strength, yield/DXY/commodity correlation, rolling spread, COT crowding | Existing currency-strength and macro context | `cross_asset_snapshots`, correlation and OLS spread primitives | Add aligned, same-calendar observations; run ADF/Engle-Granger before ever labelling a spread cointegrated |
| 5. Hypotheses | Research notebook, falsifiable thesis, parameter and dataset fingerprint | Model registry and review evidence | `research_hypotheses`, `research_runs` | Build owner UI and deterministic job runner; no synthetic data or demo backtests |
| 6. Validation | Untouched OOS, WFA, Monte Carlo, parameter stability, transaction-cost stress | Quant model registry and review events | `validation_reports`, validation evidence gate | Implement actual resampling engine, WFA orchestration, stress scenarios and signed report parser |
| 7. Fleet / risk | Private MT5 heartbeat, equity/HWM, drawdown, latency, closed-deal expectancy | Owner console, MT5 publisher, account snapshots, positions, execution-quality events, risk decisions | Existing MT5 schema retained; EA Fleet routes into `/owner` | Connect a Windows MT5 terminal, validate telemetry end-to-end, compute verified expectancy from closed deals |

## 2. Repository refactor inventory

### Removed in this refactor
- `app/store/page.tsx` — former public storefront route.
- `app/components/StoreTerminal.tsx` — former store/EA catalogue terminal component.
- The old navigation and QuantLync research links to `/store`; EA Fleet navigation now enters the authenticated owner console.
- `/fleet` is a private alias that redirects to `/owner`, where MT5 fleet and risk telemetry are displayed after owner authentication.

### Existing components to preserve and evolve
- `app/components/MacroDashboard.tsx` and `lib/macroEngine.ts`: macro research and official data context.
- `app/components/QuantResearchLab.tsx`, `lib/signalEngine.ts`, `lib/quantGovernance.ts`: technical/regime research.
- `app/owner/OwnerOperations.tsx`, `app/owner/OwnerTradingDesk.tsx`, `app/owner/OwnerResearchGovernance.tsx`: owner-only fleet, risk and research oversight.
- `app/api/v1/market-data/ingest/route.ts`: private MT5 publisher ingress with hashed installation token, nonce replay protection and input validation.
- `app/api/owner/*`, `app/api/mt5/installations/*`: owner verification and installation lifecycle.
- `lib/quantPipeline.ts`: new deterministic point-in-time, freshness, regime, correlation, spread and validation-gate primitives.

### Next code retirement after import audit
- Remove dead commercial helper exports in `lib/supabaseAdmin.ts` (`persistLicense`, `recordTransaction`, `upsertHeartbeat`) only after a repository-wide reference scan confirms no active route imports them.
- Delete remaining unused legacy checkout/customer routes and libraries if any references remain; all retired endpoints must return 410 and must not invoke Paystack.
- Remove unused commercial UI, email, webhook and customer-account modules. Keep owner authentication, MT5 installation tokens, risk evidence, model review and audit components.

## 3. Database inventory and retention decision

The production database was inspected before changes. The following historical records exist and must not be blindly dropped:
- `transactions`: 11 rows
- `escrows`: 14 rows
- `licenses`: 2 rows
- `ea_products`: 3 rows
- `profiles`: 1 row

Marketplace order, seller, entitlement, activation, payout, subscription, Paystack, seat, demo-trial and legacy EA-heartbeat tables currently contain zero rows. The legacy escrow/transaction/licence/product rows are retained for audit/retention. Destructive deletion or cross-schema relocation is deferred until ownership, retention and foreign-key dependencies are reviewed.

### New owner-only research tables
- `macro_observations`: source/series, observation period, actual release timestamp, retrieval timestamp, vintage/revision, source hash.
- `feed_health_events`: provider/feed health, age, latency, failure count and circuit state.
- `cross_asset_snapshots`: aligned correlation matrices, regression spreads, currency strength, COT context and source manifest.
- `research_hypotheses`: thesis, instruments, features, parameters, null hypothesis, falsification criteria and lifecycle.
- `research_runs`: immutable dataset/code fingerprints, source manifest, parameters and IS/validation/OOS time windows.
- `validation_reports`: OOS, WFA, Monte Carlo, cost stress and parameter stability evidence with blockers.

All six new tables have RLS enabled and no grants to `anon` or `authenticated`; access is server-only through the service role. Legacy commercial tables were also explicitly revoked from browser roles and marked for retention-only use. Do not expose service-role credentials to the browser.

## 4. Research and validation rules

- All timestamps are UTC-aware; timezone-free input is rejected.
- Macro values are point-in-time only: no release or revision may be visible before its actual publication timestamp.
- A stale, unavailable, degraded, or circuit-open feed cannot support a verified regime or risk decision.
- Regression residuals are not proof of cointegration. Use a documented Engle-Granger/ADF process and multiple-testing correction before claiming cointegration.
- Backtests must use broker-specific instrument specifications, closed bars, point-in-time macro vintages, and realistic spread, commission, swap, slippage and execution latency.
- OOS must remain untouched; WFA requires multiple chronological folds; Monte Carlo must disclose the resampling method and seed.
- Validation evidence is not an execution permission. EA approvals remain disabled until demo forward testing and owner review are complete.
- Fleet monitoring is read-only; broker passwords and execution overrides are never collected by this application.

## 5. Personal access and runtime

- The owner identity is configured by `OWNER_EMAIL` and checked server-side against Supabase Auth.
- MT5 publisher tokens are one-time secrets; only their hashes are stored. Use one credential per terminal and revoke retired installations.
- Vercel deployment protection is additional perimeter security, not a substitute for application-level owner authentication.
- Macro release data updates on provider publication cadence; MT5 quotes and closed bars update only when the owner's Windows terminal publisher is connected.
- No live status is shown merely because an API key exists. A verified source observation, timestamp and current health check are required.

## 6. Verification checklist

1. `npm ci`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm run test:quant`
5. `npm run build`
6. Confirm `/store` no longer renders a storefront and `/fleet` enters owner authentication.
7. Confirm unauthenticated owner APIs deny access; invalid/revoked MT5 tokens are rejected.
8. Confirm new research tables are RLS-enabled and have no browser grants.
9. Run authenticated preview smoke tests before merging or promoting.
10. Connect Windows MT5 and validate fresh quote, candle, account, heartbeat and closed-deal telemetry before calling the fleet live.

## 7. FX driver research model (methodology v1)

`lib/forexResearchEngine.ts` adds a pair-relative, evidence-weighted research model. Each factor must already be standardized and signed so positive means support for the base currency against the quote currency. It accepts:
- **Rate-path repricing** (28%): changes in the expected overnight-indexed-swap / policy path, not merely the current central-bank rate.
- **Real-yield differential** (22%): nominal yield less market-implied inflation compensation where available; CPI-adjusted proxy is explicitly lower-grade.
- **Macro surprise** (18%): actual versus consensus, standardized using a rolling robust median/MAD distribution.
- **Terms of trade** (10%): export/import commodity sensitivity, especially relevant to AUD, NZD, CAD and NOK.
- **Positioning** (8%): CFTC futures positioning percentile and weekly change; reportable futures positioning is not the entire OTC spot market.
- **Risk sentiment** (8%): volatility, equity risk and credit conditions, with pair-specific beta rather than a universal USD safe-haven assumption.
- **Funding stress** (6%): cross-currency basis / funding pressure where a licensed, reliable series is available.

The engine excludes stale, future, unverified and timezone-free inputs. It calculates coverage, directional agreement, dominant factors, exclusions and confidence separately. A setup requires adequate macro coverage, factor agreement, verified closed-bar technical confirmation, aligned direction, and spread/volatility controls. The output is `LONG_BIAS`, `SHORT_BIAS` or `NO_SETUP`; it is not execution authorization.

### Better entry/exit confirmation
- Daily/weekly structural trend and H4 regime define context; H1 is setup formation; M15/M5 can refine entries only when broker ticks and spread are fresh.
- Use swing structure / Donchian breakouts, ATR-normalized displacement, pullback depth and close location; avoid naming every wick a liquidity sweep.
- Use realized volatility, ATR percentile and volatility clustering to size risk and set stop distance. Avoid fixed pip stops across different pairs.
- Use session/market overlap and event-time windows as liquidity context, not as an unconditional direction signal.
- Evaluate spread + commission + slippage + swap relative to expected move and ATR; reject setups where friction consumes the expected edge.
- Track post-release drift/reversal at fixed windows (e.g. 5m, 30m, 2h, 1d) with a benchmark and event-type stratification. This tests whether an event effect exists instead of assuming the headline direction predicts the currency.

### Important data limitations
- Policy rate minus current CPI is not a true market real yield. Prefer nominal government/OIS yields minus breakeven inflation or inflation swaps; label CPI-adjusted values as a lagged proxy.
- Rate differentials based on policy rates are less informative than changes in the expected path. Use OIS curves / short-rate futures with timestamps and instrument definitions.
- COT is weekly, delayed and futures-only. It cannot be treated as live FX order flow.
- Retail broker ticks show that broker's liquidity/price stream, not consolidated global spot FX volume or institutional order flow.
- DXY is USD-heavy and overlaps with EURUSD. Avoid circularly counting the same USD factor twice in pair scores.
- Correlation is not causation. Rolling correlation, cointegration and predictive power require walk-forward tests, structural-break checks and multiple-testing controls.
- Gold requires a separate driver model: real yields, USD, central-bank demand, ETF flows, official-sector data and risk hedging. Do not model XAU as a normal G10 currency.

## 8. Data and research quality principles
1. Use ALFRED vintages for historical macro replay whenever available; otherwise tag unrecoverable historical releases as `VINTAGE_UNAVAILABLE` and exclude them from causal backtests.
2. Preserve raw provider payload hashes, release timestamps, retrieval timestamps, revision IDs and adapter versions.
3. Use official source releases first (BLS, BEA, FRED/ALFRED, CFTC, central-bank publications); licensed market-data feeds for live OIS, yields, options and institutional positioning.
4. Provider adapters must have source-specific rate limits, retry/backoff, timeouts, schema versions, freshness policies and health events.
5. A provider key is not proof of data rights. Enable an adapter only after personal-use terms, attribution and retention rights are confirmed.

## 9. Implemented reproducible research and validation utilities

- `app/research/notebook` and `app/api/owner/research-hypotheses` provide an owner-authenticated hypothesis notebook. Records include thesis, null hypothesis, instruments, timeframes, features, parameters and falsification criteria. New records always enter `DRAFT`.
- `lib/validationEngine.ts` computes net-R expectancy, win rate, profit factor and drawdown; applies independent spread/slippage/commission/swap multipliers; validates chronological walk-forward folds and timestamped trades; and performs seeded bootstrap resampling of actual closed-trade R outcomes.
- Monte Carlo output is a resampling distribution of supplied closed trades, not a market simulation or strategy backtest. It must only be run on actual broker-verified trade outcomes after costs.
- WFA requires at least three chronological folds, at least 30 OOS trades per fold, timestamped in-sample and OOS trades within their declared windows, and positive aggregate OOS expectancy. This is an evidence gate, not a universal guarantee of statistical power.
- Validation utilities are deterministic and tested in the repository; they are not yet connected to a verified historical tick/bar replay or an automated parameter optimizer. A backtest result must not be fabricated from a trade list or from synthetic bars.

## 10. Current execution and provider integration boundary

The existing macro dashboard and market quote layer continue to use approved providers and the user's MT5 publisher. Reference FX rates (e.g. daily ECB/Frankfurter) are context only; they cannot validate an intraday setup or an executable spread. Broker quotes and completed bars are the only price inputs accepted for broker-specific execution-quality checks.

The next required integration step is to add source-specific adapters for:
- BLS and BEA releases with official release calendars and revision/vintage timestamps;
- FRED/ALFRED observations requested with historical real-time periods;
- CFTC TFF currency futures positions with the actual Friday publication timestamp (not Tuesday's position date);
- Central-bank policy decisions and OIS/short-rate futures term structures;
- Nominal yields and breakeven inflation / inflation-swap curves;
- FX forwards, swap points and cross-currency basis;
- FX options implied volatility, 25-delta risk reversals and butterfly/skew where licensed;
- VIX/credit/equity and commodity benchmarks for risk and terms-of-trade context.

Each adapter must be source-tested, terms-approved, idempotent, timestamped and monitored. Do not infer a data feed from an environment variable or mark a connector live before the first verified observation is stored.
