# FiduLync / MacroLync — Institutional Fundamental Intelligence

**Current product boundary (2026-11-22):** FiduLync is a macroeconomic, monetary-policy, cross-asset and fundamental FX research platform. Independent MT5 Expert Advisors own technical analysis, trade decisions, position sizing, order execution and all broker-side risk protection.

FiduLync is not a broker, customer SaaS, public EA storefront, subscription product, payment service, escrow service, licensing portal, copy-trading service or trade execution service. The public research terminal and notebook do not require browser sign-in. Privileged APIs remain server-authenticated.

## Responsibility separation

### FiduLync / MacroLync
- Official macroeconomic releases and country fundamental profiles.
- Central-bank decisions, statements, policy stance and rate differentials.
- Inflation, labour, growth, trade, fiscal and commodity sensitivity.
- Real-yield observations and clearly labelled real-rate proxies.
- Cross-asset macro context: yields, USD indices, commodities, equities, volatility and credit.
- CFTC positioning and authorized economic-calendar/geopolitical catalysts.
- Currency relative value, macro regimes, evidence-weighted scenarios and thesis invalidation.
- Data provenance, freshness, revision/vintage controls and provider health.
- Read-only macro context API for external MT5 EAs.

### Independent MT5 EAs
- Technical indicators, price action, chart structure and entry/exit logic.
- Broker symbol specifications, margin and execution checks.
- Position sizing, SL/TP, order submission and open-position management.
- Emergency protection and local event-risk rules, which must continue working if FiduLync or the network is unavailable.

FiduLync never places, modifies or closes broker orders. It does not return technical entries, stops, targets, lot sizes or order instructions.

## Current architecture

1. **Acquisition:** official statistical agencies, central banks, approved calendars, CFTC and licensed market-data sources.
2. **Integrity:** UTC-aware timestamps, source/retrieval/release times, freshness, revisions, point-in-time eligibility and feed health.
3. **Macro research:** growth, inflation, labour, trade, fiscal and economic-surprise context.
4. **Policy research:** central-bank stance, policy divergence, real yields and rate-path data when a verified source is configured.
5. **Cross-asset research:** yields, broad trade-weighted USD indices, gold, oil, equities, volatility, credit and positioning.
6. **Currency research:** G8 relative-value context, macro regimes, supporting/contradicting evidence and insufficient-evidence states.
7. **Presentation and bridge:** MacroLync terminal, research notebook, cross-asset observations and read-only MT5 macro-context API.

## Read-only MT5 API

GET /api/v1/macro-context?symbol=EURUSD

Required headers:
- Authorization: Bearer flmt5_<installation-token>
- X-MT5-Timestamp: UTC ISO-8601 timestamp no more than 60 seconds old.

The endpoint hashes the installation token and checks it against an active installation, applies a distributed rate limit, returns no-store responses and fails closed when authentication, rate limiting or required macro evidence is unavailable.

The response contains:
- Fundamental bias and score, or INSUFFICIENT_EVIDENCE.
- Macro regime context.
- Verified policy-rate differential and an explicitly labelled policy-minus-inflation proxy.
- High-impact event-risk context and calendar status.
- Snapshot source, currency source labels and observation timestamps.

Installation-token provisioning is an out-of-band privileged operation. There is deliberately no browser Owner Console or public token-creation form. Never commit or share tokens.

## Data provenance and truth policy

A configured API key does not prove that its value is valid, its provider subscription is active, or the intended use is licensed.

Each observation should retain:
- Provider/source and source URL.
- Observation period/date.
- Actual release/publication timestamp.
- Provider update timestamp where supplied.
- Retrieval timestamp.
- Revision/vintage date where available.
- Freshness and point-in-time eligibility status.

Use these freshness labels accurately: LIVE, DELAYED, LATEST PUBLISHED, CACHED, STALE, DERIVED and UNAVAILABLE. A macro observation may be the latest published observation even if its observation date is weeks old; do not mislabel it as a live market quote.

### Provider inventory

| Source | Intended use | Important limitation |
|---|---|---|
| FRED / ALFRED | US macro series, yields, real yields, broad USD and credit context | Preserve attribution, observation and vintage dates |
| BLS | US CPI, labour and wage statistics | Economic release cadence, not tick data |
| BEA | GDP, PCE, income and trade | Requires configured API key for key datasets |
| ECB, BoE, BoJ, BoC, RBA, RBNZ, SNB | Official policy and macro releases | Each series needs source-specific timestamp/freshness |
| World Bank / Eurostat | International growth, inflation and structural context | Publication cadence and revisions apply |
| CFTC COT | Weekly futures positioning | Tuesday positions are generally published Friday; not live order flow |
| Finnhub / Twelve Data / Alpha Vantage / FMP / FairEconomy | Optional licensed market/calendar data | Disabled unless the exact personal plan permits programmatic access, caching and internal display |
| Frankfurter | Reference FX rates | Daily reference data only; never executable or real-time quotes |
| MT5 broker | Broker-side execution truth inside the EA | No longer ingested by FiduLync's macro-only service |

OIS/futures repricing, forwards, options-implied volatility, dealer positioning and cross-currency basis must be labelled unconfigured unless a verified and authorized provider is connected. No source should be described as complete merely because it is available.

## Application and infrastructure

- Next.js 16 / React 19 / TypeScript.
- Vercel deployment and scheduled macro refresh.
- Supabase PostgreSQL for macro observations, provenance, feed health and research records.
- Server-only Supabase secret/service-role access; never expose secrets in browser bundles.
- Distributed rate limiting and no-store responses for privileged endpoints.
- GitHub Actions quality gates.
- Browser-local research notebook; disclose its local storage scope.

Historical financial, commerce and audit tables are retained for audit. They are not active product features and must not be dropped as part of the macro refactor without a separate retention/dependency review.

## Retired surfaces

- Storefront, customer, checkout, payment, subscription and licence routes.
- Browser Owner Console and sign-in/password-recovery pages.
- Technical signal generation and strategy/risk pages.
- App-side EA trade approval, broker telemetry ingestion and order supervision.

Legacy technical and commerce API routes return HTTP 410 where retired. Historical source and records are preserved until a safe dependency and retention review is complete.

## Development and verification

```bash
npm ci
npx tsc --noEmit
npm run lint
npm run test:quant
npm run build
npm audit --omit=dev --audit-level=high
```

MQL5 compilation still requires MetaEditor on Windows. A TypeScript build does not prove the MQL5 include compiles or that a live provider entitlement is valid.

## Current release posture

Work is being integrated on feat/fidulync-mainline-clean in PR #21. Do not merge or promote to production until the latest CI run passes, preview runtime routes are verified, provider data and timestamps are validated, Supabase RLS/advisors are reviewed, and the read-only macro-context endpoint is tested with a provisioned installation token. No live broker account is required for the macro-only application itself.
