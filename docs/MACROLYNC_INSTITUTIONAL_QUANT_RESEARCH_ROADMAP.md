# MacroLync Institutional Quantitative Research Upgrade

## Executive assessment

MacroLync has a useful foundation: official macro adapters (FRED, ECB, Bank of Canada, Bank of England, World Bank), CFTC positioning, an economic-calendar adapter, a multi-timeframe H1/H4/D1 technical engine, ATR/ADX/Kaufman Efficiency Ratio features, a rules-based fallback brief, and a server-side signal API.

It is not yet an institutional-grade research and execution decision system. The principal gap is not visual design; it is the absence of point-in-time data lineage, per-series freshness controls, consistent cross-country frequency/definition handling, calibrated factor weights, and verified live market candles.

## Findings from the current implementation

1. `MARKET_DATA_PROVIDER_URL` is required by `getTechnicalSignal`. If it is missing, technical data is marked unavailable. The production Vercel environment inventory inspected for this review did not contain this variable. Therefore the technical side of the signal engine cannot currently qualify execution until a real candle feed is configured.
2. Macro snapshot `asOf` is a retrieval timestamp, not the observation date or release timestamp for every input. The UI cannot prove that every displayed macro value is fresh merely from this timestamp.
3. The snapshot merges fallback reference values with provider values. This is useful for display continuity but dangerous for model eligibility unless each factor independently carries source, observation date, release date, vintage, frequency and freshness.
4. G10 inflation inputs can have different frequencies and definitions. World Bank annual CPI, national monthly CPI, Euro Area HICP and US Core PCE must not be treated as directly interchangeable without explicit transformation metadata.
5. The current fundamental and Currency Strength Index weights are fixed hand-set coefficients. They are interpretable prototypes, not statistically calibrated predictive models. Cross-sectional max-deviation normalization can also make a currency's score depend strongly on the composition of the available universe.
6. CFTC Commitments of Traders is weekly positioning data, not a real-time positioning feed. The product should display report date and publication time, and must not label COT positioning as live intraday data.
7. The economic calendar can fall back to curated events. Curated fallback dates must never be represented as a verified current calendar. Calendar provider, update time, event time zone, actual/consensus/prior and event revisions should be visible.
8. The technical model is a promising prototype using H1/H4/D1, ADX, ATR, KER and z-scores. It still needs broker-specific candle provenance, bid/ask spread and transaction-cost inputs, parameter stability testing, out-of-sample validation and forward shadow testing.
9. Signal outputs currently include LONG/SHORT/NEUTRAL bias, a confluence score and trade-eligibility fields. This is a model-generated directional signal feature and must be described accurately in Paystack/compliance materials; it should not be described as a passive research-only library.
10. A countdown calculation in the dashboard divided milliseconds by 1,100 rather than 1,000. This was corrected in the feature branch. The G10 policy-range KPI also included the synthetic XAU row (zero-rate proxy); it now excludes XAU from the G10 spread calculation.

## Target architecture

### A. Point-in-time data layer

Every observation should be stored as a typed record with:
- provider, provider series ID and source URL;
- country/currency, economic concept, unit, frequency and seasonal adjustment;
- observation period, official release timestamp, retrieval timestamp and last-updated timestamp;
- real-time/vintage period where the provider supports it;
- value, revision status, transformation method and quality flag;
- licence/redistribution terms and permitted use.

Keep raw immutable observations separately from normalized model features. Never overwrite an earlier vintage. Use FRED/ALFRED real-time periods for US historical backtests so the model sees only data that was known at that date. Official sources such as ECB SDMX and Bank of Canada Valet should retain their series metadata and release calendars.

### B. Macro factor model

Build separate relative-value factors for base and quote currencies:
- Monetary policy: current policy rate, expected policy path/OIS futures, meeting repricing and policy surprise.
- Yield curve: 2Y and 10Y sovereign yields, curve slope, real yield and rate differential momentum.
- Inflation: headline/core CPI or HICP/PCE, annual and monthly momentum, inflation surprise versus consensus.
- Growth: PMI/ISM, GDP nowcasts, retail sales, industrial production and labour-market momentum.
- External balance/terms of trade: current account, commodity sensitivity and trade balance where relevant.
- Positioning: CFTC non-commercial net exposure, percentile, z-score, weekly change and crowding.
- Risk regime: global equity volatility, credit spreads, commodity breadth and safe-haven demand.

Use standardized rolling robust z-scores or expanding-window transforms, not raw percentages added with arbitrary weights. Publish the contribution of each factor. Missing factors should reduce coverage/confidence rather than silently become zero or a fabricated neutral observation. Use regime-conditional weights only after walk-forward calibration.

### C. Technical and market microstructure layer

Require a licensed/authorized feed with timestamped bid/ask OHLC or ticks for each symbol. Record broker, venue/feed, timezone, candle close time, spread, missing bars and stale status.

Feature set:
- multi-horizon returns and momentum (1/5/20/60 sessions);
- EMA slope/alignment and market structure (HH/HL/LH/LL);
- ATR percentile, realized volatility, volatility-of-volatility and shock detection;
- ADX, KER, z-score, range compression/expansion and breakout quality;
- session liquidity and rollover/spread regime;
- spread, commission, swap, slippage and execution latency.

Treat spot FX as OTC: there is no single consolidated global spot order book. Futures volume/open interest can be used as a separate, explicitly labelled proxy where licensed.

### D. Event and surprise engine

Use a licensed calendar or official central-bank/statistics release calendars. Store scheduled UTC time, local time zone, actual, consensus, prior, revision, impact classification and source. Calculate standardized surprise only after the release. Apply pair-specific pre/post event controls and explicit daylight-saving handling. Unknown or stale calendar state should disable execution, not silently pass.

### E. Model governance and signal contract

Separate:
1. Research bias — explanatory directional context.
2. Forecast — calibrated probability/distribution and horizon.
3. Execution eligibility — deterministic risk/data/liquidity gate.

Do not equate a high confluence score with a probability of profit. Calibrate forecasts with walk-forward data and publish calibration error, coverage and confidence intervals. Use an explicit abstain state when data are stale, incomplete, contradictory or outside training support.

Rename any `safe_to_trade` field to a narrower `execution_eligible` or `all_gates_passed`; it means only that configured system gates passed, never that a trade is safe or profitable. Separate maximum account risk percent from a risk multiplier; document units in the API contract.

### F. Validation

Before a strategy or factor is promoted:
- point-in-time, no-lookahead dataset construction;
- realistic tick/backtest with variable spread, commissions, swaps, slippage and latency;
- chronological train/validation/test splits and walk-forward re-estimation;
- purged/embargoed validation where overlapping labels exist;
- parameter sensitivity and stability, regime breakdown and benchmark comparison;
- Monte Carlo trade-order and execution perturbations;
- demo forward test and live shadow mode;
- independent review and archived reproducible reports.

Publish test dates, symbol, timeframe, broker/feed, account mode, leverage, spread/commission assumptions, sample size, costs and report hash. Separate backtests, demo forward tests and live verified results.

## Delivery plan

### Phase 0 — Data honesty and safety
- Add per-factor source and observation metadata.
- Add freshness thresholds by frequency and source.
- Make stale/missing macro or calendar inputs visibly stale and ineligible.
- Configure and verify `MARKET_DATA_PROVIDER_URL` and token with real authorized H1/H4/D1 candles.
- Confirm signal endpoint remains defensive when any required input is unavailable.
- Correct API semantics for risk percentage versus multiplier.

### Phase 1 — Official macro coverage
- Expand official G10 policy, inflation, employment, growth and yield series.
- Normalize definitions/frequencies with documented transforms.
- Add OIS/short-rate futures expectations only with licensed/official data.
- Add release calendars and ALFRED vintage retrieval for point-in-time testing.

### Phase 2 — Quant research
- Build factor histories and rolling robust standardization.
- Backtest factor predictive power by pair and forecast horizon.
- Estimate stable weights using walk-forward regularized models; compare with equal-weight and simple baselines.
- Add factor attribution and model disagreement/abstention.

### Phase 3 — Execution bridge
- Integrate timestamped broker-specific candles/quotes.
- Model spread, commission, swap, slippage and rollover.
- Add deterministic event/volatility/correlation/margin gates.
- Run demo shadow mode and verify MT5 request/response latency and fail-closed behaviour.

### Phase 4 — Institutional reporting
- Data quality and source freshness dashboard.
- Macro surprise dashboard and central-bank repricing monitor.
- Currency factor attribution and pair-relative-value matrix.
- Regime probabilities and forecast calibration dashboard.
- Archived model versions, reproducible reports and change log.

## Release gate

MacroLync should not describe itself as institutional-grade or enable automated execution merely because it has many indicators or a live quote ticker. The release gate is: traceable point-in-time data, documented transformations, verified provider freshness, calibrated out-of-sample evidence, realistic execution costs, stable risk gates and independently reproducible tests.
