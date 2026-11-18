# FiduLync Personal Quant — MT5 supervisor setup

## What this integration does

The MT5 publisher sends broker quotes, closed H1/H4/D1 candles, and an account snapshot to FiduLync. The EA supervisor endpoint authenticates the installation, reads server-stored account and quote context, evaluates the proposal against the server-owned risk policy, and writes a durable decision record.

The supervisor is advisory and fail-closed. It does not send, modify, or close broker orders. The included `FiduLync_Supervisor_Probe.mq5` is a connectivity probe only and intentionally contains no `OrderSend` call.

## Current safety state

The default personal policy has execution permission disabled, model validation disabled, and execution-quality verification disabled. Macro/news context is also not yet sufficient for a trade approval. Therefore the current endpoint is expected to return REJECT, ABSTAIN, or DEGRADED — never treat a positive dashboard signal as trade authorization.

Do not change these flags to true just to force an approval. They require independently evidenced out-of-sample validation, verified broker execution characteristics, and a reviewed operational risk policy.

## Windows MT5 setup

1. In the FiduLync owner console, create a new MT5 publisher installation. Copy its installation ID and one-time publisher token into a secure password manager. The token cannot be recovered; revoke and recreate the installation if lost or exposed.
2. On the Windows VPS/PC where the broker's MT5 terminal is already logged in, install Python 3.11+ and the MetaTrader5 package: `py -m pip install MetaTrader5`. If downloading from the Personal EA Lab, download both `FiduLync_MT5_Market_Publisher.py` and its companion `mt5_risk_state.py` into the same folder.
3. Set environment variables in that Windows session:
   - `FIDULYNC_PUBLISHER_TOKEN` to the one-time token.
   - `FIDULYNC_INGEST_URL` to `https://YOUR-VERIFIED-DEPLOYMENT-URL/api/v1/market-data/ingest`. Do not point it at the old production deployment until the new account-snapshot ingestion code has been deployed and verified.
   - `MT5_SYMBOL_MAP` to canonical-to-broker symbols. The default map covers seven major USD FX pairs (EURUSD, GBPUSD, USDJPY, USDCHF, USDCAD, AUDUSD, NZDUSD) plus XAUUSD. Add broker suffixes where needed. Historical candle batches are chunked to respect the API request limit.
4. Run `py scripts/mt5_market_publisher.py` from a repository checkout, or `py FiduLync_MT5_Market_Publisher.py` when using the downloaded file pair. The default publisher interval is 15 seconds so account and quote freshness can be checked; closed candles are sent only when new bars are available. The publisher also derives the consecutive losing-position count from the terminal's available closed-deal history, including commission, swap and fees; the API marks it verified only when history retrieval succeeds and the data is fresh. Confirm accepted quote/candle batches and account snapshots in the owner diagnostics. The publisher reads the connected terminal; it does not request or store the broker password.
5. Download `QuantSupervisor.mqh` and `FiduLync_Supervisor_Probe.mq5`. Save the include as `MQL5/Include/FiduLync/QuantSupervisor.mqh` and the probe as `MQL5/Experts/FiduLync_Supervisor_Probe.mq5`.
6. Do not attach the probe until a Vercel deployment containing the new supervisor API has been created and verified. The existing production deployment has not yet been updated, and the latest preview build is currently blocked by the Vercel daily deployment quota. When a verified deployment is available, set `InpFiduLyncBaseUrl` to that exact deployment URL. If the broker uses suffixes, set `InpCanonicalSymbol` to the matching canonical publisher symbol (for example, `EURUSD` for chart symbol `EURUSD.a`). Compile the probe in MetaEditor. In MT5, open Tools → Options → Expert Advisors and add `https://fidulync.vercel.app` to the allowed WebRequest URLs.
7. Attach the probe to a demo-account chart. Enter the installation ID and publisher token in its inputs. Review the Experts log and confirm that unavailable/stale data produces a non-approval decision.

## Operational and validation limitations

- The account-risk anchor starts from the first trusted snapshot received after this migration. It is not a reconstruction of earlier historical drawdown.
- Open-position risk is marked unverified if any open position lacks a usable stop-loss or broker tick-value metadata. The supervisor abstains in that case.
- The current server policy deliberately prevents trade approvals. Consecutive losses are derived from the terminal's available deal history and are rejected when that history is missing or stale; verify that the broker terminal has complete account history loaded. Portfolio correlation, independent economic-calendar verification, out-of-sample model evidence, and execution-quality validation remain release gates.
- Broker-specific minimum volume, volume step, stop levels, tick value and contract specifications must be validated on the actual terminal. Do not assume all brokers use 0.01 volume steps.
- The included probe does not place orders. It is for connectivity, authentication, freshness, audit and fail-closed behaviour only.
- MetaEditor compilation, Strategy Tester, and demo forward testing must be completed on Windows MT5. A Vercel build cannot substitute for these checks.
