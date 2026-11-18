# FiduLync Personal Quant Edition — Architecture Audit & Implementation Plan

**Status:** Approved product direction; implementation plan  
**Date:** 2026-11-18  
**Target:** Single-operator personal trading intelligence and EA-supervision platform  
**Markets:** G10 FX, XAUUSD and XAGUSD  
**Trading modes:** Discretionary analysis and automated MT5 EAs  
**EA authority:** Supervisor only — approve, reject, abstain and recommend a risk ceiling; never place broker orders on behalf of the EA.

## 1. Product contract

FiduLync Personal Quant Edition is a private, single-operator quantitative research, risk-governance and MT5 EA-supervision system. It is not a customer SaaS, EA marketplace, subscription business, escrow service, broker, copy-trading service or managed-account service.

Preserve all existing useful UI, market research, MacroLync, analytics, account telemetry, data ingestion, owner diagnostics, authentication, security controls and support affordances. Retire commercial flows from the personal navigation and runtime only after dependency mapping and regression tests. Do not delete populated historical financial records or audit history. Escrow remains excluded from all active product workflows.

### Explicit non-goals
- No customer registration, customer billing, Paystack checkout, subscription renewals, customer EA catalogue or commercial licence provisioning in the personal product experience.
- No escrow, custody, pooled funds, broker credential collection, copy trading or discretionary account management.
- No central service placing, modifying or closing broker orders.
- No guarantee of profitable trades, win rates or prediction accuracy.
- No fabricated historical data, synthetic live quotes or fallback values presented as live observations.

## 2. Repository and infrastructure audit snapshot

Audit performed against the connected GitHub, Vercel and Supabase resources on 2026-11-18.

### Connected resources
- GitHub repository: `ricorapier1-cloud/FiduLync`; default branch `main`.
- Main branch head observed: `c3c2218adf9d89363457450352d0b4b1bcb0fc48`.
- Vercel project: `fidulync`; Next.js; project ID `prj_I5HGoE7CsDTGkWAOy103IcRaS625`.
- Supabase project: `iimlfvjoingcumqkvssk`; PostgreSQL 17.6; region `eu-central-1`; status `ACTIVE_HEALTHY`.

### Deployment finding
The latest Vercel deployment inspected was READY, but its deployment target was null and the project metadata reported `live: false`. Its source branch was `feature/institutional-saas-marketplace-hardening`, not `main`. Therefore a successful preview build must not be described as a verified production release. Confirm the intended production branch, production target, aliases, access protection and runtime behavior before any release.

### Existing code and capabilities observed
- Next.js 16.4.6, React 19.2.8, TypeScript 5, Supabase JS and Upstash Redis.
- MacroLync signal and macro snapshot routes; technical analysis; currency-strength and session context.
- MT5 market-data ingestion endpoint with publisher-token hashing, timestamp validation, nonce replay protection, quote/candle validation and Supabase persistence.
- MT5 installation registration and owner diagnostics/control-plane routes.
- EA heartbeat and closed-trade telemetry endpoints.
- MacroLync MQL5 bridge include using authenticated HTTPS WebRequest calls.
- Twelve Data historical candle fallback and configurable market-data provider adapter.
- Supabase migrations for MT5 market data, replay protection, telemetry, trade-history hardening, escrow retirement and later commercial marketplace/licensing functionality.
- A separate branch, `feat/institutional-quant-foundation`, contains a quantitative risk primitive, fail-closed execution contract and quantitative readiness documentation. It is 12 commits ahead and 3 commits behind `main`; it has diverged and must be reviewed and selectively ported rather than blindly merged.
- Open PRs #15 and #16 focus on commercial subscriptions, marketplace and licensing. They are outside the personal product scope and must not be merged as a route to this edition.
- Open PR #11 contains relevant security/data-provider hardening. Review its exact diff and migration state before selectively adopting any remaining changes.

### Existing environment configuration observations
The Vercel project contains names for Supabase, Upstash, FRED, Finnhub, Twelve Data, BEA, BLS, Gemini, Resend, cron, Paystack and legacy AlgoLync secrets. This metadata audit did not decrypt or validate credentials. Presence of a variable name does not prove that its value is populated, current, correctly scoped or accepted by its provider. The inspected environment list did not include `MARKET_DATA_PROVIDER_URL`; the configurable candle-provider path therefore cannot be assumed operational. Paystack live processing is explicitly disabled and is not needed for personal use.

### Known product/code gaps to resolve
1. The inspected main-branch signal symbol validator supports G10 FX and XAUUSD, but not XAGUSD. Silver requires deliberate symbol, data, contract and risk support.
2. The inspected technical engine uses a hard-coded pip-size rule for JPY, XAU and ordinary FX. XAGUSD and broker-specific metal contract specifications require a symbol-metadata adapter; never apply FX pip assumptions to metals.
3. Quantitative risk/readiness code exists on a divergent feature branch and is not yet proven to be integrated into the deployed production release.
4. The current technical engine requires 200 closed candles for H1/H4/D1 and enforces source consistency. This is a useful minimum data-integrity gate, not proof of predictive validity or sufficient backtest history.
5. The MT5 publisher and bridge require a running Windows MT5 terminal and broker account for live verification. Source code and a green web build do not establish that the publisher or any EA has been compiled or tested in MetaEditor/Strategy Tester.
6. Existing commercial portal, checkout, subscription, demo entitlement and licence routes remain in repository history/current branches. They must be mapped and disabled from the personal product without deleting useful account telemetry, owner control or historical records.
7. A macro signal or confluence score must never be labelled as a calibrated win probability. Probabilities require out-of-sample calibration and reliability reporting.
8. Data source, timestamp, freshness, broker/installation identity, timeframe, licensing/use permissions and degraded status must remain visible throughout the analysis pipeline.

## 3. Target architecture

### A. Data plane
**Execution truth:** the connected MT5 broker terminal is authoritative for that account's bid/ask, symbol specification, spread, quotes, closed candles, tick size/value, contract size, volume step, stop/freeze levels, margin and fills.

**Research context:** approved official and third-party sources supply macroeconomic and positioning context. Potential sources include FRED, BEA, BLS, central-bank publications, CFTC COT and a provider calendar. Each adapter must document endpoint, update cadence, units, revisions, provenance, entitlement and failure behavior.

**Data contract:** every observation carries source ID, broker/installation ID where applicable, symbol, timeframe, observation timestamp, ingestion timestamp, freshness limit, status (LIVE, DELAYED, REFERENCE, STALE, UNAVAILABLE), schema version and validation result.

Never splice candles from different providers into a single indicator series. Never treat COT weekly futures positioning as real-time spot FX order flow. Reference or stale macro data may be displayed with a warning but must not satisfy an execution gate.

### B. Quantitative research plane
Use deterministic, testable TypeScript modules for:
- Multi-timeframe closed-bar structure and trend alignment.
- HH/HL/LH/LL, BOS and CHoCH with explicit swing definitions.
- ATR, ADX, KER/ER, R-squared, z-score, volatility percentile and volatility shock detection.
- Regime classification: trend expansion, mean reversion, high-volatility chop and unavailable/unknown.
- Currency strength and pair-relative fundamentals.
- XAU/XAG macro context: USD, real yields, policy expectations, inflation, risk regime and relevant positioning; do not treat metals as ordinary currency codes.
- Correlation and aggregate exposure across all open positions and proposed orders.
- Spread, slippage, latency, quote age and execution-quality checks.
- Signal quality, sample size, historical expectancy and calibrated probability only where supported by held-out evidence.

Use a clear factor registry with documented units, direction, lookback, missing-data behavior and correlation/overlap notes. Avoid double-counting correlated indicators as independent confirmations. AI may summarize evidence or explain scenarios; it must not fabricate quotes, calculate critical risk values, override deterministic gates or claim certainty.

### C. Risk governance plane
Implement one independent, deterministic Risk Governor used by dashboard, manual-trade analysis and every EA adapter.

Required inputs: account equity/balance, current and pending exposure, currency/metal concentration, broker symbol specifications, proposed entry/SL/TP, spread, stop distance, commission/swap assumptions, margin, daily/weekly drawdown, high-water mark, loss streak, data health, news state, market regime and model-validation status.

Required controls:
- Per-trade, daily and weekly loss ceilings; equity high-water-mark protection; cooldown/hibernation after defined shocks.
- Aggregate risk and correlation-aware exposure caps across EAs and manual positions.
- Broker-correct position sizing using tick value/size and account-currency conversion where required.
- Reject minimum-volume trades when their estimated cash risk exceeds the approved budget; never round risk upward to meet broker minimums.
- Spread/slippage/latency and abnormal-volatility sentries.
- No grid, martingale, averaging down or unbounded progressive sizing.
- Independent emergency stop and audit log.
- No new trade when data, risk state, broker metadata or authorization is missing, stale, inconsistent or unavailable.

The 0.50% trend and 0.25% mean-reversion values in the existing quant readiness draft are maximum pilot ceilings only, not default targets. They remain disabled until model and execution validation is signed off. Personal account-specific risk limits must be configured explicitly; do not infer them from a sample account.

### D. EA supervision gateway
Standardize one versioned protocol for all connected EAs.

1. EA sends a signed/authenticated proposal with unique request ID, installation ID, account login, broker/server, symbol, direction, strategy/EA ID, timeframe, quote timestamp, bid/ask, proposed entry, stop, target, requested volume and current exposure snapshot.
2. Gateway validates authentication, replay protection, request freshness, symbol mapping and schema.
3. Quant engine evaluates market/data context; Risk Governor independently evaluates account and broker constraints.
4. Response is one of `APPROVE`, `REJECT`, `ABSTAIN` or `DEGRADED`, with reason codes, approved maximum risk/volume, permitted direction, stop constraints, expiry, request ID and schema version.
5. EA rechecks price, spread, stop distance, local account risk and response expiry immediately before order placement. Broker-side SL/TP must be attached at dispatch.
6. EA reports actual order result, fills, slippage, modifications and closed-trade outcome for audit and performance evaluation.

**Fail-safe:** timeout, malformed response, stale quote, invalid signature, unknown schema, unavailable server or missing account state means no new entry. The EA retains its own local account/equity limits and broker-side protection. FiduLync is a supervisor, not the broker execution engine; it does not directly place, modify or close orders.

Use per-installation revocable credentials, hashed at rest, scoped to one personal installation/account and rotated independently. Do not embed a universal backend secret in public code or distribute the same global secret across unrelated EAs. Do not collect broker passwords.

### E. User experience
Personal dashboard modules:
- Personal command center and current data-health state.
- MacroLync: calendar, central-bank/rates/inflation context, USD and metal drivers.
- QuantLync: market regime, multi-timeframe structure, volatility, strength, correlation and evidence.
- RiskLync: account state, exposure, drawdown, risk budget and hard blocks.
- AlgoLync: connected terminals/EAs, heartbeats, proposals, approvals/rejections and trade history.
- Manual trade planner: entry/stop/target, broker-aware sizing, R-multiple and pre-trade risk checklist.
- Performance lab: per-EA and portfolio expectancy, profit factor, drawdown, Sharpe/Sortino, MAE/MFE, costs, slippage and regime attribution.
- Diagnostics: provider health, last update, latency, missing credentials (names only), ingestion lag and validation gates.

Personal mode must be clear in the UI. Hide or disable commercial checkout, subscription, customer portal, public EA catalogue and demo-licence purchase actions. Preserve owner diagnostics, personal account telemetry, support/help content and useful research components.

## 4. Implementation sequence and release gates

### Phase 0 — Baseline and branch hygiene
- Freeze current production and preserve a known rollback deployment.
- Record exact `main` SHA, preview/production deployment IDs, Supabase migration list and environment-variable names/targets (never export secret values).
- Inventory every route, component, table, migration, cron and provider.
- Review PR #11 and the divergent quant foundation branch. Selectively port relevant code into `feat/personal-quant-edition`; do not merge commercial PR #15/#16.
- Add automated tests before deleting or changing any UI/API path.

**Exit:** reproducible baseline, route/data-flow inventory, migration ownership map and rollback path.

### Phase 1 — Personal product boundary
- Add a server-enforced single-owner mode and personal navigation.
- Remove commercial purchase/subscription/escrow actions from active UI and APIs; retain audit records and non-commercial account/EA telemetry.
- Preserve private owner diagnostics and account binding.
- Remove any customer-facing license gate from personal EA connectivity only after replacing it with per-installation personal authentication and verifying existing bridge compatibility.

**Exit:** only the owner can access personal data; no commercial checkout/escrow path is reachable; no historical records are deleted.

### Phase 2 — Market data and instrument correctness
- Define canonical FX, XAUUSD and XAGUSD symbol registry with broker suffix/prefix mapping.
- Add broker symbol metadata adapter for tick size/value, digits, contract size, volume constraints, stop/freeze levels, margin and account-currency conversion.
- Add XAGUSD support end-to-end: ingestion allow-list, technical calculations, macro mapping, spread/volatility limits, sizing and tests.
- Verify quote freshness and closed-candle boundaries; verify at least 200 same-source closed bars per timeframe for signal computation, with longer historical windows for model research.
- Keep MT5 broker data primary; use external feeds only as clearly labelled historical/reference fallbacks subject to provider terms.

**Exit:** EURUSD, GBPUSD, USDJPY, other configured G10 pairs, XAUUSD and XAGUSD pass symbol/data/specification tests for the chosen broker. Unsupported instruments abstain.

### Phase 3 — Quantitative core
- Port and test fail-closed risk primitives from the quant foundation branch.
- Separate raw research score, signal quality, calibrated probability, expected value and execution permission.
- Add robust regime detection, factor provenance, currency strength, metals macro model and correlation aggregation.
- Add deterministic unit/property tests, boundary tests, missing-data tests and replay fixtures.
- Version signal contracts and preserve backward compatibility for existing bridge consumers.

**Exit:** reproducible results on fixed fixtures; no signal can be execution-eligible with stale or mixed-source data, missing macro requirements, invalid stops, or failed risk checks.

### Phase 4 — Risk Governor and universal EA protocol
- Create versioned proposal/decision schemas and per-installation credentials.
- Add approval TTL, idempotency, nonce/replay protection, request hashing and full audit events.
- Implement account-level and portfolio-level risk aggregation.
- Make the EA recheck quote and risk immediately before dispatch; preserve local stop and emergency logic.
- Add a manual planner using the same risk engine.
- Keep execution disabled by default.

**Exit:** integration contract tests pass; simulated timeout/replay/tamper/stale-data tests always reject or abstain; no duplicate authorization; local EA protections remain effective.

### Phase 5 — Model research and validation
- Acquire sufficient broker-consistent historical data with accurate bid/ask/cost assumptions.
- Use chronological train/validation/test partitions, rolling walk-forward and a final untouched holdout.
- Include variable spreads, commission, swap/financing, slippage, latency, partial/rejected fills, gaps and news.
- Report net expectancy in R, profit factor, max drawdown, Sharpe/Sortino, Calmar, tail loss, MAE/MFE, trade count and fill quality.
- Calibrate any probability on held-out samples; report Brier score, reliability bins and sample count.
- Run bootstrap/Monte Carlo and parameter-sensitivity analysis; compare by instrument, direction, session and regime.
- Avoid optimization leakage and repeated holdout tuning.

**Exit:** documented out-of-sample evidence and model approval; raw confluence is never displayed as probability.

### Phase 6 — Shadow, demo and controlled live pilot
- Run dashboard and EA proposals in shadow mode with no orders.
- Compare decisions with broker quotes and actual hypothetical fills.
- Demo forward test each EA and instrument with full costs and telemetry.
- Verify kill switch, daily/weekly drawdown, recovery, VPS/network outage, terminal restart and stale-data handling.
- Permit a tightly capped live pilot only after explicit owner approval and every validation gate passes.

**Exit:** independent evidence of correct operation, acceptable execution quality and stable risk behavior. Live enablement is an explicit operator action, never an automatic consequence of a successful build.

## 5. Quality and safety acceptance criteria

- TypeScript typecheck, ESLint and production build pass.
- Unit, integration, API-contract, RLS/authorization and browser regression tests pass.
- No secret values in client bundles, logs, URLs or public diagnostics.
- Supabase RLS and service-role boundaries verified; personal records cannot be read by any other user.
- All ingestion endpoints validate schema, time, bounds, replay and installation identity.
- No mixing of broker/provider series; no live labels for delayed/reference values.
- XAU/XAG sizing tests cover symbol digits, tick value, contract size, min lot and account-currency conversion.
- All failure paths return reject/abstain and preserve broker-side protective stops.
- Full audit record for every proposal, decision, order acknowledgement and closed trade.
- Rollback procedure and database backup/restore test completed.
- MT5 include and publisher compiled in MetaEditor; Strategy Tester and demo terminal validation completed on Windows before any live authorization.

## 6. Current constraints and operational notes

The web application can be developed, tested and deployed from the connected GitHub/Vercel/Supabase workflow without a local laptop. Actual MT5 terminal connectivity, MetaEditor compilation, Strategy Tester validation and broker-side execution verification require a Windows MT5 terminal, either on a suitable VPS or a PC. Until then, keep the platform in research/shadow mode and do not enable live execution.

The platform can be engineered to high institutional standards for a single operator. This does not remove market risk, guarantee profitability or create unrestricted access to third-party feeds. Provider quotas, API terms, broker conditions and data entitlements still apply.

## 7. Immediate next engineering tasks

1. Confirm production deployment and access configuration; do not promote a preview deployment.
2. Review the exact diffs for PR #11 and `feat/institutional-quant-foundation`; port only relevant security, quant and data-readiness work.
3. Add personal-mode configuration without deleting historical data or useful account telemetry.
4. Add instrument metadata and XAGUSD support with correct metal sizing.
5. Implement the versioned EA proposal/decision contract and central Risk Governor.
6. Build tests and diagnostics before enabling any trade authorization.
7. Keep all live execution gates disabled until Windows MT5, broker data, model validation and demo forward tests are complete.
