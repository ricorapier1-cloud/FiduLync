# FiduLync / MacroLync — Fundamental Intelligence Product Boundary

**Status:** Current product mandate, 2026-11-22  
**Canonical responsibility boundary:** FiduLync performs macroeconomic and fundamental research. Independent MT5 Expert Advisors own all technical analysis, trading decisions, order execution and broker-side risk management.

## FiduLync responsibilities

1. Acquire official macroeconomic releases, central-bank publications, approved economic calendars, cross-asset macro observations and positioning data.
2. Preserve source attribution, release timestamps, retrieval timestamps, observation periods, revisions/vintages and freshness.
3. Classify missing, stale, delayed, reference and unavailable data explicitly. Never turn a fallback value into a live observation.
4. Research growth, inflation, labour, monetary policy, policy divergence, real-rate proxies, cross-asset drivers, terms of trade, CFTC positioning and event risk.
5. Produce evidence-backed currency and pair-level fundamental context, scenarios, contradictions, invalidation conditions and an explicit insufficient-evidence state.
6. Expose a read-only, installation-authenticated macro context API for MT5 EAs.

## MT5 EA responsibilities

Each EA independently owns chart/technical analysis, price-action interpretation, entry and exit decisions, position sizing, stop-loss/take-profit placement, broker contract and margin validation, order submission, open-position management, emergency protection and local event-risk enforcement.

FiduLync must never submit, modify or close broker orders. A failure or disconnection of FiduLync must not disable an EA's local protections.

## Read-only bridge contract

GET /api/v1/macro-context?symbol=EURUSD

Authentication:
- Authorization: Bearer flmt5_<installation-token>
- X-MT5-Timestamp: UTC ISO-8601 timestamp within 60 seconds.
- Token is SHA-256 hashed and matched against an active mt5_installations record.
- Distributed rate limit is enforced per installation and source IP.
- Responses use Cache-Control: no-store; invalid credentials, stale timestamps, unavailable auth/rate-limit services and provider failures fail closed.

Response includes fundamental bias/score (or INSUFFICIENT_EVIDENCE), macro regime, policy and real-rate proxy differentials when verified, event-risk lockout context, source status, timestamps and limitations. It never contains technical entries, stops, targets, lot sizes or order instructions.

## Product and security scope

The public research terminal and notebook can remain directly accessible without browser sign-in. This does not make write APIs public. Machine ingestion, privileged writes and MT5 data access require server-side authorization, validation, rate limiting, replay protection where applicable and least-privilege database access. Service-role/secret keys remain server-only.

Legacy storefront, billing, licensing and technical-execution surfaces are out of scope. Preserve historical audit records and existing useful infrastructure. Remove or retire code only after dependency and retention review.

## Evidence and methodology rules

- All timestamps must be UTC-aware; reject timezone-free values.
- No observation is visible to a historical research run before its actual publication time.
- Record observation period separately from release, provider update, retrieval and vintage times.
- Missing inputs reduce evidence coverage; do not silently impute neutral values into a positive score.
- Distinguish observed market data from reference rates, derived values and model estimates.
- OIS/futures repricing, options, forwards and cross-currency basis must be labelled unconfigured unless a verified authorized source is connected.
- Fundamental scenarios are research conclusions, not guaranteed forecasts or execution instructions.
