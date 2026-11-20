# FiduLync Quantitative Engine — Readiness Contract

## Operating modes

FiduLync separates research signals from execution permission. A technically interesting signal is not automatically a trade instruction.

- **REFERENCE** — fallback/reference macro values; never execution eligible.
- **DATA-DEGRADED** — one or more required feeds are stale, missing, delayed, malformed or inconsistent.
- **RESEARCH** — indicators and confluence can be inspected, but production execution is blocked.
- **PILOT-TREND / PILOT-MEAN-REVERSION** — eligible only after all data, execution and model-validation gates pass.
- **HALTED** — news, volatility, data-integrity or risk controls block trading.

## Fail-closed execution gates

The signal engine requires all of the following before it can return `safe_to_trade: true`:

1. At least 200 valid, fresh closed candles from one source and one MT5 installation/provider series.
2. Verified macro policy-rate and inflation inputs for the currencies in the pair, plus a provider-sourced event calendar.
3. Execution quality validation explicitly approved by the operator after broker-side bid/ask, spread, latency, slippage and fill checks.
4. Out-of-sample model validation explicitly approved after reproducible walk-forward and cost-aware testing.
5. Explicit production execution enablement.
6. No high-impact event lockout, unsupported regime, neutral direction, invalid ATR stops, or technical direction veto.

The following environment flags are deliberately **not set by default**:

- `EXECUTION_QUALITY_VALIDATED=true`
- `SIGNAL_MODEL_VALIDATED=true`
- `SIGNAL_EXECUTION_ENABLED=true`

Do not set these merely to make the UI say that trading is enabled. They represent completed validation and an intentional production approval. With any flag missing or false, the signal returns zero risk and execution blockers.

## Risk budget

After every gate passes, the initial pilot ceilings are:

- Trend expansion: 0.50% of equity per trade.
- Mean reversion: 0.25% of equity per trade.
- High-volatility chop, unavailable regime, news lockout, or any failed gate: 0%.

These are ceilings, not targets. Portfolio-level exposure, daily/weekly loss limits, correlation, margin, stop distance, commission, swap and broker minimum-volume constraints must be applied before dispatch. Never round a minimum lot upward if doing so breaches the cash risk budget. No grid, martingale, averaging down or unbounded progressive sizing.

## Position sizing contract

The broker adapter must supply account-currency pip value per lot, stop distance in pips, equity, minimum/maximum volume and volume step. The pure `calculatePositionSize` primitive refuses invalid inputs and rejects a minimum lot that exceeds the risk budget. It does not guess pip value or perform currency conversion on behalf of an unconfigured broker.

## Model validation required before live enablement

- Use chronologically correct, closed bars; prevent look-ahead and survivorship bias.
- Use rolling walk-forward train/validation/test windows and a final untouched holdout.
- Include variable bid/ask spread, commission, swap/financing, slippage, latency and rejected/partial fills.
- Test by pair, direction, session, volatility regime and macro-event state.
- Report net expectancy in R, profit factor, Sharpe/Sortino, maximum drawdown, Calmar, tail loss, turnover, MAE/MFE, trade count and fill quality.
- Calibrate probabilities only on held-out observations; report Brier score, reliability bins and sample count. A raw confluence score is not a probability.
- Stress with bootstrap/Monte Carlo resampling, spread widening, gap shocks, missing bars and delayed data.
- Run shadow mode, then demo forward testing, then a tightly capped live pilot. Scaling requires documented evidence.

## Data provenance

- MT5 broker data is the execution reference for that broker account, not a consolidated global FX tape.
- Twelve Data is a secondary historical candle fallback. It is not a substitute for broker bid/ask, execution quotes, or a licensed consolidated market feed.
- Never splice candles from different providers into one indicator series.
- Display source, observation timestamp, freshness, latency and status (LIVE, DELAYED, REFERENCE, STALE, UNAVAILABLE).
- COT is weekly futures positioning context, not real-time spot FX order flow.
- No provider key may be exposed to browser code, client logs or user-visible diagnostics.

## Laptop / broker onboarding sequence

1. Install MT5 on a Windows PC or VPS and connect to the intended broker account.
2. Add the FiduLync publisher URL to MT5 WebRequest allow-list.
3. Obtain an installation token through the authorized server-side provisioning process and store it securely in MT5 terminal inputs.
4. Start closed-candle and bid/ask publishing; confirm installation heartbeat, symbol mapping, timestamps and at least 200 closed candles per required timeframe.
5. Confirm broker pip/tick values, volume step, contract size, commission, swap, stop/freeze levels and margin calculation.
6. Run historical tests and the full walk-forward validation report.
7. Complete shadow and demo forward validation.
8. Only then approve the three execution gates and deploy the controlled production release.

## External dependencies

External API credentials, broker connectivity, data licensing, historical coverage and email/payment provider approval are environment/account prerequisites. The application must remain useful in RESEARCH mode while these are pending. Missing credentials must not be replaced with invented live values.

## Macro provenance classification

A snapshot is classified as fully provider-backed only when policy-rate and inflation observations for all ten tracked G10 currencies are provider-sourced. A live COT report, calendar, or reference exchange-rate table alone cannot upgrade a partial macro snapshot to fully verified. Missing provider coverage remains `partial`/`REFERENCE` and is not execution eligible.
