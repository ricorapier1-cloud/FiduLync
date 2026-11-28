# MacroLync × Integrated Quant_Core — Research Objectives & Validation Protocol

**Status:** Binding research specification, 2026-11-28  
**Performance status:** NOT VALIDATED. The objectives below are hypotheses to test, not achieved results.

## 1. Research mandate

| Objective | Target / policy |
|---|---|
| Win rate | 60–65% research target |
| Planned reward-to-risk | 1:2 |
| Growth objective | Balanced growth |
| Risk objective | Controlled drawdown |
| Setup selection | High-quality setups only |
| Daily trade quota | None |

No component may create a signal, lower a quality threshold, or increase frequency to satisfy a target. A valid NO TRADE / ABSTAIN decision is a successful governance outcome.

The 60–65% range is not a probability assigned to a live setup. It is a measured historical/forward research objective. The win-rate report must include sample size and a 95% Wilson confidence interval. A point estimate inside the target band is provisional until the lower confidence bound is at least 60%. Results above 65% are reported as above the target band, not penalized.

The 1:2 objective is evaluated using average **net realised winning R divided by average absolute net realised losing R**, after spread, commission, swap and slippage. Planned stop/target geometry is not a substitute for realised outcomes.

## 2. System responsibility boundary

### MacroLync — macro/fundamental research only
- Official releases, original release times, observation periods and revision/vintage provenance.
- Policy expectations, yields/real-yield proxies, cross-asset drivers, COT/positioning and event risk.
- Regime and pair-relative fundamental research, evidence coverage and falsification conditions.
- Point-in-time historical integrity, data freshness, source permissions and research-run provenance.
- Read-only macro context for independent MT5 EAs.

MacroLync does not calculate broker execution permission, submit/modify/close orders, or publish EA trade win-rate as a MacroLync macro forecast. A MacroLync research gate can only return READY_FOR_INDEPENDENT_TRADE_VALIDATION when the data/methodology evidence is complete; it is not a live-trading approval.

### Integrated Quant_Core — independent EA execution and trade validation
- Technical setup qualification and the decision to trade or abstain.
- Broker-specific entry, stop, target, volume, execution and open-position management.
- Actual closed-position outcomes, net R, realised reward-to-risk, costs, drawdown and portfolio exposure.
- Out-of-sample, walk-forward, cost stress and forward execution reporting.

MacroLync governance remains read-only. Quant_Core must retain local risk controls if MacroLync is unavailable.

## 3. Validation sequence and gates

1. **Data integrity:** timezone-aware UTC; actual release timestamps; point-in-time vintages; source and licence verification; no future revisions; synchronized instrument calendars; no fabricated or fallback observations.
2. **Hypothesis registration:** define instruments, direction, regime, entry/exit hypothesis, null hypothesis, feature set, parameter bounds and falsification conditions before testing.
3. **Chronological split:** training, validation and untouched final OOS periods. No random shuffling across time. Freeze strategy and parameters before final OOS evaluation.
4. **Walk-forward:** at least three chronological folds, each with at least 30 OOS trades. Report fold-level and aggregate degradation. These are minimum process gates, not a claim of sufficient power by themselves.
5. **Costs:** measure and stress spread, slippage, commission and swap independently. Net expectancy must remain positive under the declared stress scenario.
6. **Robustness:** parameter sensitivity, multiple-testing disclosure, block bootstrap / clustered resampling, regime coverage, long/short and instrument breakdown, and Monte Carlo seeded reproducibility. IID bootstrap alone must not be described as preserving market clustering.
7. **Portfolio risk:** report equity-based maximum drawdown, recovery time, expected shortfall, correlation and aggregate currency exposure. A numeric drawdown ceiling must be explicitly configured and approved; the system must not invent one.
8. **Forward execution:** compare intended and actual fills, broker costs, stop distance, rejected orders and data/context timing on the actual IC Markets MT5 environment. Demo evidence is execution validation, not proof of future profitability.
9. **Controlled live consideration:** only after all gates pass, with conservative owner-approved risk, frozen version, monitoring and automatic suspension on stale data, governance failure or risk breach.

## 4. Quant_Core acceptance criteria

A strategy is not VALIDATED unless all of the following are true:
- At least 300 actual closed out-of-sample trades with chronological UTC close timestamps.
- Out-of-sample period is untouched and the walk-forward evidence passes.
- All included trades passed the pre-registered high-quality setup filter.
- Observed net expectancy is positive and remains positive after the declared spread/slippage/commission/swap stress.
- 95% Wilson lower confidence bound for win rate is at least 60%.
- Average net realised reward-to-risk is at least 2.0.
- Actual equity-based maximum drawdown is available and does not exceed an explicitly approved drawdown limit.
- All required evidence is reproducible and linked to a strategy version, data manifest and test window.

The 300-trade threshold is a minimum evidence milestone, not a guarantee of statistical power. Correlation between trades, multiple experiments, market-regime concentration and selection bias must be disclosed. Where any evidence is missing, status remains NOT_VALIDATED or INSUFFICIENT_EVIDENCE. A failed economic/robustness criterion is REJECTED.

## 5. Reporting contract

Every Quant_Core validation report should include:
- Strategy ID/version, instrument(s), timeframe(s), direction and regime coverage.
- Dataset hash/source manifest, training/validation/OOS windows and run timestamp (UTC).
- OOS trade count, wins/losses, win rate, 95% Wilson interval and win-rate target classification.
- Average net winner R, average net loser R, realised reward-to-risk and net expectancy R.
- Profit factor, equity-based max drawdown, recovery duration and expected shortfall where calculable.
- Spread, slippage, commission and swap assumptions and stressed results.
- Walk-forward fold results, Monte Carlo/block-bootstrap method, seed and sensitivity findings.
- Explicit blockers, validation status and approval history.

Never display an uncalibrated confluence score as a win probability. Never turn missing metrics into zero, a default, or a green status.

## 6. Current implementation boundary

The repository validation primitives operate on supplied trade outcomes; they do not constitute a tick-level historical backtester, automatic parameter optimizer, verified broker data feed or live MT5 test. The research objectives and gates must not be presented as passed until actual source data and broker-verified closed trades are available. No production database migration or live deployment is implied by this specification.
