# MacroLync MT5 Market-Data Bridge — Implementation Contract

Status: architecture contract and quantitative engine integration. The production MT5 ingest endpoint and per-customer credential issuance are not yet enabled. Do not label an MT5 connection as live until a terminal has authenticated and its observations have passed validation.

## Decision

Use MT5 as the broker-specific execution-data source, not as the only global research feed.

MT5 is the correct source for the connected account's:
- Bid/ask ticks and spread.
- Broker-specific H1/H4/D1 OHLC candles.
- Symbol names/suffixes, digits, point, tick size/value and contract specifications.
- Broker/server time, quote freshness, session availability and later execution slippage.

It is not a substitute for official macroeconomic sources, cross-asset market data, historical point-in-time macro vintages, or independent price verification. A customer's private terminal is not automatically visible to a cloud application.

## Connection choices

### Preferred production model: MT5 Expert Advisor pushes data

A small, analysis-only FiduLync MT5 connector EA runs on the customer's MT5 terminal and sends signed HTTPS POST batches to the FiduLync ingestion API using MQL5 `WebRequest()`.

Advantages:
- Uses the exact broker feed and symbol contract the customer trades.
- No broker password or trading permission needs to be sent to FiduLync.
- Does not require enabling Python trading permissions or DLL imports.
- Can send closed candles, bid/ask snapshots, spread and symbol metadata.
- Works with a Windows VPS or a customer's Windows PC; MT5 terminal must remain online.

Security requirements before enabling:
- Unique installation credential per user/terminal; store only a strong hash server-side.
- Credential revocation/rotation, user ownership checks, HTTPS, timestamp and nonce/replay protection.
- Strict payload size, symbol/timeframe allowlists, request throttling and schema validation.
- No order placement capability in the connector. Data-only permissions.
- Do not expose a shared global ingest secret in a downloadable EA.

### Alternative: MT5 Python integration on a Windows VPS

MetaQuotes' official Python package connects to a running MT5 terminal and can read ticks, bars, symbol information and market depth. A small Windows service can poll the terminal and push data to the same HTTPS ingestion API.

This is convenient for a single controlled research terminal, but it needs a continuously running Windows machine/VPS, Python and MT5 installed. It must not be hosted inside a Vercel serverless function: the terminal is a stateful desktop process and cannot live inside an ephemeral serverless runtime.

### Not recommended as the main connection

- Asking users for their MT5 investor/master password.
- Scraping MT5 web pages or using an undocumented broker endpoint.
- Treating daily reference FX rates as real-time market quotes.
- Connecting one administrator's terminal and implying it represents every customer's broker prices.

## Canonical observation contract

All timestamps are UTC. Price observations retain their original broker symbol and normalized instrument.

A candle payload must contain:
- `symbol`, `timeframe`, `timestamp` (bar open, Unix milliseconds or ISO-8601 UTC)
- `open`, `high`, `low`, `close`
- `tick_volume`, `spread_points`, `real_volume` where the broker supplies them
- `broker`, `server`, `source_observed_at`, `received_at`
- `is_closed`, `digits`, `point`, `tick_size`, `tick_value`, `contract_size`

A tick payload must contain:
- `symbol`, `bid`, `ask`, `timestamp`, `received_at`
- `spread_points`, `digits`, `point`, `tick_size`, `tick_value`
- `broker`, `server`

Reject crossed quotes (bid > ask), non-positive prices, impossible OHLC ranges, duplicate/out-of-order bars, timestamps too far in the future, stale observations, unknown timeframes and unsupported symbols. Never synthesize missing candles. Store raw observations before normalizing them.

## Data path

1. Terminal obtains broker-native rates and ticks.
2. Connector sends HTTPS batches with installation credential and UTC timestamps.
3. FiduLync authenticates the installation and validates schema, ownership, freshness, replay protection and limits.
4. Raw observations are persisted with source/broker metadata.
5. Normalizer maps broker symbol aliases (e.g. suffixes) to canonical instruments without discarding original names.
6. Research engine computes features from closed candles only.
7. Independent execution gate checks latest tick age, spread percentile, session, missing bars, macro calendar status and account-specific constraints.
8. UI shows broker, symbol, timeframe, last observation, freshness, coverage and any failed checks.

## Quantitative engine

The technical research engine now exposes:
- Rolling Gaussian Z-score and Kaufman Efficiency Ratio.
- ADX and ATR / normalized ATR regime context.
- KAMA and ALMA adaptive trend references.
- Hurst exponent estimate using a multi-scale rescaled-range slope (diagnostic, not a standalone trade trigger).
- Linear-regression R-squared as trend-fit diagnostic.
- HH/HL versus LH/LL-style recent swing structure classification.
- Multi-timeframe EMA alignment and regime classification.

These metrics are deterministic diagnostics. They are not yet an independently validated predictive model. Feature correlation must be controlled, weights calibrated walk-forward, and all performance assessed out of sample after spread, commission, slippage and financing.

## Free market data options

1. **Customer's MT5 broker feed:** free to the customer as part of their brokerage account and best for that broker's executable context; not a universal independent feed.
2. **Dukascopy historical export:** useful for free historical tick/bid-ask research and backtesting; not a substitute for the customer's current broker quote or a guaranteed production real-time API. Verify data-use terms before redistribution.
3. **Official macro APIs:** BLS, BEA, FRED/ALFRED, ECB, Eurostat, IMF, OECD, World Bank, CFTC, Bank of Canada and EIA. These explain drivers; they do not provide complete executable FX tick/candle feeds.
4. **Finnhub/Twelve Data and other commercial vendors:** use only after verifying actual account entitlements, forex coverage, latency, historical depth and customer-facing commercial/redistribution rights. A free key is not proof of commercial rights.

## Release gates

Do not enable directional/execution-eligible signals until:
- An authenticated MT5 installation has delivered data successfully.
- H1/H4/D1 candle coverage, closed-bar timestamps, duplicates, gaps and broker metadata pass tests.
- Bid/ask and spread observations are fresh.
- Provider outage and stale-data tests prove the engine fails closed.
- The exact data licence permits the intended internal/customer-facing use.
- Historical walk-forward and out-of-sample tests pass with realistic transaction costs.

## References

- MetaQuotes Python integration: https://www.mql5.com/en/docs/python_metatrader5
- MT5 bar retrieval: https://www.mql5.com/en/docs/python_metatrader5/mt5copyratesfrompos_py
- MT5 initialization: https://www.mql5.com/en/docs/python_metatrader5/mt5initialize_py
- MT5 terminal WebRequest settings: https://www.metatrader5.com/en/terminal/help/startworking/settings
- Dukascopy historical data: https://www.dukascopy.com/swiss/english/marketwatch/historical/
- Dukascopy tick-data download guide: https://www.dukascopy-node.app/downloading-tick-data
