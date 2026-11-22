# FiduLync multi-account portfolio risk

## Scope

This module aggregates independently authenticated MT5 account snapshots across the owner's active terminal installations. It is a risk-observation and EA-supervision capability only. It never sends, modifies or closes broker orders.

## Data contract

The aggregation endpoint reads:
- `mt5_installations` scoped to the authenticated owner and active installations;
- the newest `mt5_position_snapshot_manifests` per installation/account, including incomplete manifests so an incomplete newest snapshot cannot be replaced by an older complete one;
- `mt5_open_position_snapshots` rows linked by the exact manifest snapshot UUID;
- the newest `mt5_account_snapshots` per installation/account.

A position set is usable only when the latest manifest is complete, the observed row count equals `expected_positions`, every position row is marked complete, and the account and position snapshots are fresh and time-aligned within five seconds.

## Risk accounting

Cash risk remains separated by MT5 account and account currency. The service does not add USD, EUR, GBP or other account-currency cash balances together. It compares the broker-published `open_risk_cash` with a second estimate reconstructed from position volume, entry, stop, tick size and loss-side tick value. A missing stop, missing contract metadata, stale snapshot, incomplete manifest, or material reconciliation difference makes the account risk unavailable rather than zero.

Native base/quote currency exposure is reported separately in currency units. For a long position, base currency exposure is positive and quote currency exposure negative; the signs reverse for a short. These native currency units are not account-currency P/L, delta-equivalent exposure or a substitute for a portfolio covariance model. Metals and non-FX contracts require correct broker-provided base/quote and contract metadata.

The starting portfolio risk ceiling is the server-owned `maxPortfolioRiskPct` policy (currently 2% per account). Daily, weekly and high-water drawdown ceilings remain separately enforced by the EA supervisor using account-specific equity anchors. This first implementation does not combine risk cash across accounts with different deposit currencies.

## Endpoint and security

`GET /api/owner/portfolio-risk` is server-authorized with the existing privileged owner bearer verification and distributed rate limit. It is not exposed to anonymous browser clients. The public research terminal remains no-login; private account and portfolio telemetry must not become public merely to remove the browser login interface.

The endpoint is read-only and returns `READY`, `DEGRADED` or `UNAVAILABLE`. It does not grant trading permission. EA execution remains disabled until the existing independent data, model-validation, execution-quality, demo-forward and explicit-authorization gates pass.

## Current limitation

The live Supabase project currently has no MT5 account/position telemetry rows. The endpoint will therefore return `UNAVAILABLE` until a Windows MT5 terminal, broker account and authenticated publisher are connected. A successful web build is not evidence of broker connectivity or profitability.
