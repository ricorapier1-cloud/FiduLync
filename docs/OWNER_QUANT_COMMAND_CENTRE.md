# FiduLync Owner Quantitative Command Centre

## Product role

The Owner Console is a private, single-operator trading command centre for research, portfolio-risk supervision, MT5 EA governance and operational control. Store, checkout, licensing, customer and platform-provider administration remain separate under Platform Administration.

The EA supervisor is not a broker execution service. It returns APPROVE / REDUCE / REJECT / ABSTAIN and risk ceilings only. It must never place, modify or close broker orders. Execution remains disabled until the real terminal, independent model validation, execution-quality evidence, demo validation and explicit authorization gates are passed.

## Console modules

- **Quantitative Trading Desk:** supported pair universe, D1/H4/H1 technical state, source-consistent broker quotes, spread and freshness gates, pair-specific macro verification, COT and economic-event context.
- **Risk:** account and risk-anchor supervision, open stop-risk, drawdown and loss-streak controls.
- **Market / EA operations:** MT5 installation, publisher health and market-data operations.
- **Research Governance:** model registry, reviewer status, execution-quality events and complete position-snapshot evidence.
- **Governance / Security / Reliability:** policy state, access controls, audit coverage and operational readiness.
- **Platform Administration:** existing store, customers, licensing, checkout and provider operations; not mixed into the trading desk.

## Technical data contract

The desk uses closed candles only and requires at least 200 valid closed bars on each of D1, H4 and H1 before full multi-timeframe alignment is available. It computes EMA(20/50/200), Wilder ATR(14), Wilder RSI(14), ALMA(20), KAMA(10), Gaussian Z-score, Kaufman Efficiency Ratio, ADX(14), a lag-variance Hurst exponent, 100-bar log-price trend R-squared, and 20-day ADR with current daily-range/ADR ratio. The trend-regime classifier uses ADX, KER, Hurst and R-squared together; these are diagnostics and filters, not proof of edge. Candle streams are selected from one installation, broker, server and symbol across all three timeframes; data from different sources must never be spliced into one indicator series.

A quote must belong to that same selected installation/broker/symbol stream and be no older than the server-owned two-second quote freshness limit. The read-only MT5 publisher now separates one-second quote updates from five-second account/position/execution-history snapshots and a 15-second closed-candle synchronization cadence. It records terminal-confirmed fills and closing deals with immutable evidence hashes. Requested-price slippage and order-to-fill latency are not inferred from deal history; they require an EA-side OnTradeTransaction telemetry bridge and remain unavailable until that bridge is compiled and demo-tested. Publisher output reports ingestion round-trip time; this is a target cadence, not a measured guarantee of end-to-end EA latency. The research spread guard uses the server-owned maximum spread and spread/ATR ceiling. A technical-data-ready state is not a model approval or a trade instruction.

## Position and exposure evidence\n\nThe MT5 publisher now sends a complete position set with a UUID snapshot ID, account login, capture time and expected position count. The ingestion API validates each position, inserts the position rows, then writes a completion manifest last. Owner governance only reads snapshots with a complete manifest and matching row count. An explicit zero-position manifest is a valid flat snapshot; missing or incomplete data is not. Native base/quote currency exposure is estimated from broker contract size and entry price. These currency units are not converted into account-currency risk and must not be confused with the broker-aware stop-risk calculation.\n\n## Fundamental data contract

A pair's fundamental state is verified only when:
- The current macro snapshot is no older than 24 hours and is not fallback reference data.
- Policy-rate and inflation inputs for the relevant currencies are explicitly provider-sourced.
- Relevant currency/gold COT positioning has a report date no older than 14 days.
- The economic calendar is provider-sourced and the snapshot is fresh.
- Any two-year yield differential actually used by the model has provider provenance.

Pair-level verification is used rather than requiring every G10 central bank to have a provider before any pair can be evaluated. Missing or stale inputs remain explicit blockers. The current official adapters cover selected currencies; AUD, JPY, CHF and NZD policy-rate coverage still requires official-source adapters before those pairs can pass full fundamental verification.

The macro engine persists full source-tagged snapshots in the service-role-only macro_snapshot_payloads table. Reference/fallback snapshots can be displayed for context but cannot create a directional EA bias. Partial snapshots cannot be labeled fully verified.

## Authentication

Owner access uses the pre-registered owner identity and Supabase passwordless email authentication. The client requests OTP without creating a new account, supports the secure magic-link redirect back to /owner, and verifies the resulting session again on the server before rendering owner data.

Production Auth setup still requires:
1. Configure a verified custom SMTP sender in Supabase Auth; the default Supabase email service is restricted and is not suitable for production delivery.
2. For numeric OTP emails, the Magic Link email template must render {{ .Token }}. If using the secure magic link instead, ensure the confirmation URL is preserved.
3. Add https://fidulync.vercel.app/owner to the Supabase Auth redirect allowlist. Add the Vercel preview wildcard only if preview login testing is required.
4. Test a real email request, numeric code or magic-link exchange, server-side owner verification, session refresh and sign-out.
5. Configure stronger step-up authentication (TOTP/passkey) and leaked-password protection where supported.

## Data and release state

The owner desk is deliberately honest about missing evidence. At the last database check, MT5 installations, market quotes, candles, account snapshots, position snapshots, execution-quality events, model records and macro snapshots were all empty. The desk must remain in awaiting-data / blocked states until authenticated data arrives.

Remaining terminal-dependent gates: install and run the updated MT5 publisher, verify its one-second quote cadence and observed RTT on the actual VPS/broker path, compile MQL5 in MetaEditor with zero errors/warnings, validate broker contract specifications and margin/stops, run Strategy Tester, demo forward-test, and independently reconcile execution and position evidence.

No profitability guarantee is made. Research-input readiness does not mean a strategy has positive expectancy or is safe for live capital.
