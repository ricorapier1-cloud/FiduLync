# FiduLync Quantitative Research Architecture

## Product boundary

FiduLync is a quantitative research terminal with no browser login, no owner-console interface and no customer storefront. Research pages are accessible without a user account. Sensitive administrative and MT5 installation APIs remain server-authorized.

The EA supervisor is not a broker execution service. It returns research/risk decisions and ceilings only. It must never place, modify or close broker orders. Execution remains disabled until real terminal data, independent model validation, execution-quality evidence, demo validation and explicit authorization gates are passed.

## Research modules

- **MacroLync:** central-bank policy, inflation, real-rate context, yields, COT positioning, economic catalysts and cross-country macro differentials.
- **QuantLync:** multi-timeframe technical analysis, market structure, volatility, correlation, currency strength, regime classification and statistical diagnostics.
- **RiskLync:** broker-aware risk sizing, margin and exposure checks, multi-account portfolio aggregation with account-currency isolation, native currency exposure, drawdown limits, equity high-water protection, loss-streak controls, cooldowns and defensive abstention.
- **AlgoLync:** private MT5 market-data publisher, terminal health telemetry, EA supervision decisions, risk ceilings and release evidence for personal EA builds.
- **Research validation:** historical data provenance, closed-bar calculations, walk-forward testing, out-of-sample evaluation, parameter stability and execution-cost stress.

## Technical data contract

- Use closed candles only and require at least 200 valid closed bars on each D1, H4 and H1 timeframe before full multi-timeframe alignment.
- Calculate EMA(20/50/200), Wilder ATR(14), Wilder RSI(14), ALMA(20), KAMA(10), Gaussian Z-score, Kaufman Efficiency Ratio, ADX(14), lag-variance Hurst exponent, 100-bar log-price trend R-squared, and 20-day ADR with current daily-range/ADR ratio.
- Combine ADX, KER, Hurst and R-squared as regime diagnostics and filters, not proof of an edge.
- Candle streams must use one installation, broker, server and symbol across all timeframes. Never splice different providers into one indicator series.
- Executable quotes must belong to the same selected installation/broker/symbol stream and be no older than the server-owned two-second freshness limit.
- Publisher quote cadence and observed ingestion RTT are measurements, not guaranteed end-to-end EA latency. Requested-price slippage and order-to-fill latency require EA-side OnTradeTransaction telemetry and demo validation.
- A technical-data-ready state is not a model approval or a trade instruction.

## Position and exposure evidence\n\nThe authenticated portfolio risk endpoint reads the newest manifest per installation/account (including incomplete manifests), requires complete row counts, checks account/position snapshot freshness and alignment, and reconciles broker-reported open risk against a second position-level estimate. Cash risk is never summed across accounts with different deposit currencies. Native currency units are reported separately and are not represented as account-currency P/L. Missing stops or broker metadata make risk unavailable rather than zero. See `docs/PORTFOLIO_RISK_AGGREGATION.md`.\n

The MT5 publisher sends a complete position set with a UUID snapshot ID, account login, capture time and expected position count. The ingestion API validates each position, inserts position rows, then writes a completion manifest last. Risk governance reads only snapshots with a complete manifest and matching row count. An explicit zero-position manifest is a valid flat snapshot; missing or incomplete data is not.

Native base/quote currency exposure is estimated from broker contract size and entry price. These currency units are not converted into account-currency risk and must not be confused with broker-aware stop-risk calculations.

## Fundamental data contract

A pair's fundamental state is verified only when:
- The macro snapshot is no older than 24 hours and is not fallback reference data.
- Policy-rate and inflation inputs for relevant currencies are explicitly provider-sourced.
- Relevant currency/gold COT positioning has a report date no older than 14 days.
- The economic calendar is provider-sourced and the snapshot is fresh.
- Any two-year yield differential actually used by the model has provider provenance.

Pair-level verification is used rather than requiring every G10 central bank to have a provider before any pair can be evaluated. Missing or stale inputs remain explicit blockers. The official adapters cover selected currencies; additional official-source adapters are required before unsupported pairs can pass full fundamental verification.

Reference/fallback snapshots may be displayed for context but cannot create a directional EA bias. Partial snapshots cannot be labeled fully verified.

## No-login access and data persistence

- Public research pages do not require an account.
- The Research Notebook stores draft hypotheses in browser-local storage only; drafts are not uploaded or synced and may be lost if browser storage is cleared.
- The Validation Workbench performs calculations locally in the browser on user-supplied data.
- Sensitive installation, research-governance, artifact and operational APIs remain server-authorized. The browser does not expose administrative credentials or create MT5 installation tokens.
- MT5 installation tokens must be provisioned through an authorized server-side process and kept out of browser code, source control and public chat.

## Release and validation

Remaining terminal-dependent gates include running the MT5 publisher on the intended VPS/broker path, verifying quote cadence and observed RTT, compiling MQL5 in MetaEditor with zero errors and warnings, validating broker contract specifications/margin/stops, running Strategy Tester, demo forward-testing, and independently reconciling execution and position evidence.

No profitability guarantee is made. Research-input readiness does not mean a strategy has positive expectancy or is safe for live capital.
