# FiduLync — Macro Research and EA Integration Contract

## Product boundary

FiduLync is a sourced macro-fundamental research terminal and read-only context service. It does not execute trades, manage broker accounts, ingest MT5 candles, provide chart indicators, or replace an EA's risk controls.

The connected MT5 EA remains responsible for:
- Broker-native bid/ask and executable prices.
- Candles, chart structure, technical indicators and entry timing.
- Broker-specific contract specifications, pip/tick value and account-currency conversion.
- Position sizing, exposure, margin, stop-loss, take-profit and order management.
- Daily loss limits, equity protection, drawdown controls and emergency shutdown.

FiduLync supplies macro context only. An EA must never treat a macro bias as an entry instruction.

## Read-only MT5 bridge

- Endpoint: `GET /api/v1/macro-context?symbol=EURUSD` (or another supported instrument).
- Authentication: server-side `MACRO_API_TOKEN` bearer credential; `ALGO_PRIVATE_API_KEY` remains a server-side compatibility credential.
- The endpoint is read-only and returns schema version, macro regime, fundamental bias, decision status, confidence, event risk, invalidation triggers, quote provenance and generated timestamp.
- XAUUSD uses the dedicated gold macro engine; it is not scored as an ordinary FX currency pair.
- Provider quotes older than the freshness threshold are returned without a usable price and explicitly marked stale.
- Missing, unverified, delayed or permission-gated inputs result in `INSUFFICIENT_EVIDENCE`; the EA must fail closed.

No browser login, owner console, customer account, licensing, or publisher registration is required.

## Research and validation principles

- No simulated or fabricated market observations.
- Display source, observation timestamp, retrieval timestamp, freshness and latency.
- Do not label daily or weekly official macro observations as intraday streaming.
- COT is weekly futures positioning context, not real-time spot FX order flow.
- Historical research must use chronological, closed observations and avoid look-ahead bias.
- Report sample size, out-of-sample performance, costs, slippage, spread, drawdown and calibration. A raw score is not a probability.
- Never set production execution flags merely to make a status panel green. All trade permissions remain inside the EA and require independent validation.

## External prerequisites

Provider credentials do not automatically grant storage, redistribution or commercial-use rights. FRED, Finnhub and FairEconomy adapters remain disabled unless their explicit approval flags are set after the relevant terms and entitlements are confirmed. Public official sources are used only within their applicable terms.

A Windows MT5 terminal or VPS is not required to run the FiduLync web application. EAs obtain broker prices and technical data directly from their own MT5 terminal.
