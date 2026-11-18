# FiduLync Personal Quant — MT5 supervisor setup

## What this integration does

The MT5 publisher sends broker quotes, closed H1/H4/D1 candles, and an account snapshot to FiduLync. The EA supervisor endpoint authenticates the installation, reads server-stored account and quote context, evaluates the proposal against the server-owned risk policy, and writes a durable decision record.

The supervisor is advisory and fail-closed. It does not send, modify, or close broker orders. The included `FiduLync_Supervisor_Probe.mq5` is a connectivity probe only and intentionally contains no `OrderSend` call.

## Current safety state

The default personal policy has execution permission disabled, model validation disabled, and execution-quality verification disabled. Macro/news context is also not yet sufficient for a trade approval. Therefore the current endpoint is expected to return REJECT, ABSTAIN, or DEGRADED — never treat a positive dashboard signal as trade authorization.

Do not change these flags to true just to force an approval. They require independently evidenced out-of-sample validation, verified broker execution characteristics, and a reviewed operational risk policy.

## Windows MT5 setup

1. In the FiduLync owner console, create a new MT5 publisher installation. Copy its installation ID and one-time publisher token into a secure password manager. The token cannot be recovered; revoke and recreate the installation if lost or exposed.
2. On the Windows VPS/PC where the broker's MT5 terminal is already logged in, install Python 3.11+ and the MetaTrader5 package: `py -m pip install MetaTrader5`.
3. Set environment variables in that Windows session:
   - `FIDULYNC_PUBLISHER_TOKEN` to the one-time token.
   - `FIDULYNC_INGEST_URL` to `https://fidulync.vercel.app/api/v1/market-data/ingest`.
   - `MT5_SYMBOL_MAP` to canonical-to-broker symbols. The default map covers seven major USD FX pairs (EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD) plus XAUUSD. Add broker suffixes where needed. Historical candle batches are chunked to respect the API request limit.
4. Run `py scripts/mt5_market_publisher.py`. Confirm accepted quote/candle batches and account snapshots in the owner diagnostics. The publisher reads the connected terminal; it does not request or store the broker password.
5. Copy `MQL5/Include/FiduLync/QuantSupervisor.mqh` into the terminal's `MQL5/Include/FiduLync/` directory and `MQL5/Experts/FiduLync_Supervisor_Probe.mq5` into `MQL5/Experts/`.
6. If the broker uses suffixes, set the probe's `InpCanonicalSymbol` to the matching canonical publisher symbol (for example, `EURUSD` for chart symbol `EURUSD.a`). Compile the probe in MetaEditor. In MT5, open Tools → Options → Expert Advisors and add `https://fidulync.vercel.app` to the allowed WebRequest URLs.
7. Attach the probe to a demo-account chart. Enter the installation ID and publisher token in its inputs. Review the Experts log and confirm that unavailable/stale data produces a non-approval decision.

## Operational and validation limitations

- The account-risk anchor starts from the first trusted snapshot received after this migration. It is not a reconstruction of earlier historical drawdown.
- Open-position risk is marked unverified if any open position lacks a usable stop-loss or broker tick-value metadata. The supervisor abstains in that case.
- The current server policy deliberately prevents trade approvals. Portfolio correlation, reliable consecutive-loss state, economic-calendar lockouts, and a broker-validated proposed-margin calculation still need to be completed and tested before any execution permission can be considered.
- Broker-specific minimum volume, volume step, stop levels, tick value and contract specifications must be validated on the actual terminal. Do not assume all brokers use 0.01 volume steps.
- The included probe does not place orders. It is for connectivity, authentication, freshness, audit and fail-closed behaviour only.
- MetaEditor compilation, Strategy Tester, and demo forward testing must be completed on Windows MT5. A Vercel build cannot substitute for these checks.
