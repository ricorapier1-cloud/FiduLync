# FiduLync MT5 Market-Data Runbook

## Product boundary

FiduLync has no browser login or owner-console interface. Research pages are accessible without a user account. Sensitive installation-management and ingestion APIs remain server-authorized.

## Access and token handling

- Installation tokens must be provisioned and revoked through an authorized server-side operator process.
- Tokens must never be placed in browser code, source control, screenshots or public chat.
- Only token hashes are stored server-side.

## Hybrid market data

1. Obtain an installation token through the authorized server-side provisioning process. No browser UI is available to create or display tokens.
2. The publisher sends HTTPS POST batches to `/api/v1/market-data/ingest` using `Authorization: Bearer <publisher-token>`, `x-mt5-timestamp`, `x-mt5-nonce` and a JSON body with `quotes[]` and `candles[]`.
3. The ingestion endpoint hashes the token, resolves an active installation, enforces a five-minute request timestamp window, stores the nonce to prevent replay, validates quote/OHLC/timeframe values and upserts into the existing MT5 market tables.
4. Technical analysis selects closed candles from one active installation only. H1/H4/D1 feeds must be fresh (2h/8h/48h maximum respectively) and have at least 200 candles per timeframe.
5. Spot quotes prefer fresh MT5 broker quotes. Frankfurter is a public daily reference-rate source, never an executable quote. Other feeds may be enabled only when the provider plan permits the exact display/use.
6. Ghost Protocol requires a fresh broker quote and candles from the same MT5 installation. Quote age is limited by the risk policy (default 2 seconds), with spread, spread/ATR, structure and ATR stability contributing to its 0–1 quality score. The threshold is 0.65. This is a deterministic filter, not a probability.
7. Signals remain fail-closed when required data is missing, stale, incomplete or comes from mismatched broker installations.

## Windows MT5 publisher

The repository includes `scripts/mt5_market_publisher.py`. It uses the official MetaTrader5 Python module against an already logged-in Windows MT5 terminal; no MetaEditor compilation is required for this publisher.

1. Install Python 3.11+ and MetaTrader 5 on a Windows PC/VPS. Log in to the broker terminal manually and confirm Market Watch symbols are available.
2. Install the Python package: `py -m pip install MetaTrader5`.
3. Set `FIDULYNC_INGEST_URL=https://fidulync.vercel.app/api/v1/market-data/ingest`.
4. Set `FIDULYNC_PUBLISHER_TOKEN` only after an authorized operator has provisioned the installation token.
5. Set `MT5_SYMBOL_MAP` for broker symbols, including suffixes, e.g. `EURUSD=EURUSD.a,GBPUSD=GBPUSD.a,USDJPY=USDJPY.a,XAUUSD=XAUUSD.a`.
6. Keep `MT5_PUBLISH_INTERVAL_SECONDS=1` (default). Run `py scripts/mt5_market_publisher.py`. It sends bounded recent closed H1/H4/D1 bars and refreshed broker quotes, then only new closed bars. It never opens or modifies trades.
7. Verify publisher last-seen time, quote age and market diagnostics through authorized server-side diagnostics. If the publisher stops, quotes become stale and Ghost Protocol abstains.

## Historical 1996–2026 research backfill

The separate `scripts/mt5_historical_backfill.py` utility imports closed H1/H4/D1 bars from the configured start date (default 1996-01-01) using MT5 `copy_rates_range` in bounded time chunks and batches of at most 1,000 candles.

1. Run the live publisher first and verify the installation token and ingestion endpoint.
2. In MT5, set Tools → Options → Charts → Max bars in chart to a suitably high value (for example 1,000,000) and allow the broker to supply history.
3. Set `MT5_BACKFILL_START=1996-01-01`, `MT5_BACKFILL_SYMBOLS` to a small first batch (e.g. EURUSD, GBPUSD, XAUUSD), and `MT5_BACKFILL_TIMEFRAMES=H1,H4,D1`.
4. Run `py scripts/mt5_historical_backfill.py`. It uses the same private publisher token and ingestion endpoint, publishes only broker-returned bars, and reports actual imported coverage. It never fills gaps with synthetic candles.

## Security

- Never commit publisher tokens, Supabase service-role keys, provider keys or account credentials.
- The browser application is accessible without login; all sensitive administrative and ingestion endpoints must continue to enforce server-side authorization and rate limits.
- MT5 market-data publishing is read-only. It does not open, modify or close broker orders.
