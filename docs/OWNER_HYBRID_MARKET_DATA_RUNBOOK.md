# FiduLync Personal Quant Edition — owner and market-data runbook

## Product boundary

FiduLync is a private, single-operator, personal non-commercial quantitative research and MT5 supervision workspace. There is no customer checkout, Paystack, subscription, escrow, customer licensing or public EA marketplace. Historical commercial routes return HTTP 410. The owner login, private MT5 publisher and research governance remain active.

## Private owner access

- Open /owner and sign in using the registered owner email address and password.
- The server verifies the Supabase Auth access token against the exact configured owner email and a confirmed email address.
- Preserve the existing owner account and password-recovery flow. Do not create public owner registration.
- Use the owner console to issue and revoke per-terminal MT5 publisher tokens. Tokens are displayed once; only their hashes are stored.
- Never expose Supabase service-role keys, publisher tokens or owner access tokens in browser code or source control.

## Hybrid market data

1. Register a publisher in /owner. The bearer token is displayed once; store it only in the local Windows MT5 publisher environment.
2. Publisher sends HTTPS POST batches to /api/v1/market-data/ingest using:
   - Authorization: Bearer <publisher-token>
   - x-mt5-timestamp: <UTC ISO timestamp>
   - x-mt5-nonce: <unique UUID per request>
   - JSON body with quotes[] and candles[]
3. The ingestion endpoint hashes the token, resolves an active installation, enforces a five-minute request timestamp window, stores the nonce to prevent replay, validates quote/OHLC/timeframe values and upserts into the existing MT5 market tables.
4. Technical analysis selects closed candles from one active installation only. H1/H4/D1 feeds must be fresh (2h/8h/48h maximum respectively) and have at least 200 candles per timeframe. A provider candle fallback may support descriptive research when fresh, but it cannot pass the Ghost Protocol execution-quality gate.
5. Spot quotes prefer fresh MT5 broker quotes. Frankfurter is a public daily reference-rate source and may be used for contextual comparison only; it is never an executable quote. Finnhub and Twelve Data may be enabled only when the owner's personal plan explicitly permits the exact display/use. ExchangeRate-API, Gold-API and custom providers remain opt-in until their personal-use terms are verified.
6. The Ghost Protocol requires a fresh broker quote and candles from the same MT5 installation. Quote age is limited by the owner risk policy (default 2 seconds), with spread, spread/ATR, structure and ATR stability contributing to its 0–1 quality score. The threshold is 0.65. This is a deterministic filter, not a probability.
7. Signals remain fail-closed when required macro/technical data is missing, stale, incomplete, or comes from mismatched broker installations.

## Windows MT5 publisher

The repository includes scripts/mt5_market_publisher.py. It uses the official MetaTrader5 Python module against an already logged-in Windows MT5 terminal; no MetaEditor compilation is required for this publisher.

1. Install Python 3.11+ and MetaTrader 5 on a Windows PC/VPS. Log in to the broker terminal manually and confirm Market Watch symbols are available.
2. Install the Python package: py -m pip install MetaTrader5.
3. Create a publisher token in /owner, then set it only in the local environment as FIDULYNC_PUBLISHER_TOKEN.
4. Set FIDULYNC_INGEST_URL to https://fidulync.vercel.app/api/v1/market-data/ingest.
5. Set MT5_SYMBOL_MAP for the symbols actually offered by the broker, including suffixes, for example EURUSD=EURUSD.a,GBPUSD=GBPUSD.a,USDJPY=USDJPY.a,XAUUSD=XAUUSD.a. Partial maps are supported; unavailable symbols are not fabricated.
6. Run py scripts/mt5_market_publisher.py. It sends bounded recent closed H1/H4/D1 bars and refreshed broker quotes, then only new closed bars. It never opens or modifies trades.
7. Check the owner console's publisher last-seen time, quote age and market diagnostics. If the publisher stops, quotes become stale and Ghost Protocol abstains.

## Historical 1996–2026 research backfill

The separate scripts/mt5_historical_backfill.py utility imports closed H1/H4/D1 bars from the configured start date (default 1996-01-01) using MT5 copy_rates_range in bounded time chunks and batches of at most 1,000 candles.

1. Run the live publisher first and verify the installation token and ingestion endpoint.
2. In MT5, set Tools → Options → Charts → Max bars in chart to a suitably high value (for example 1,000,000) and allow the broker to supply history.
3. Set MT5_BACKFILL_START=1996-01-01, MT5_BACKFILL_SYMBOLS to a small first batch (for example EURUSD,GBPUSD,XAUUSD), and MT5_BACKFILL_TIMEFRAMES=H1,H4,D1.
4. Run py scripts/mt5_historical_backfill.py. It uses the same private publisher token and ingestion endpoint, publishes only closed broker bars, and is idempotent on installation/symbol/timeframe/bar time.
5. Review first/last timestamps, gaps and row counts in the owner research diagnostics. Broker retention differs by symbol and timeframe; no missing historical bars are synthesized. Expand the symbol universe only after the first batch is verified.

The backfill script is read-only. It does not place orders, modify positions or publish account balances. Long-term history is stored for later multi-regime research; the live signal engine intentionally uses a bounded recent window.

## Personal data-provider permissions

- FRED and official public data are used for personal research subject to their terms and attribution. Preserve series-level copyright notices. FRED-derived observations are excluded from external AI prompts.
- CFTC COT is weekly positioning context, not intraday order flow.
- Finnhub, Twelve Data, Alpha Vantage, FMP, FairEconomy and custom feeds remain disabled until the owner's personal plan explicitly allows the precise asset class, programmatic access, caching and display.
- BLS and BEA are not direct live adapters in the current build; their US series are currently sourced through FRED where available.
- Do not use data-provider commercial approval flags as a substitute for the owner's actual personal-plan terms.

## Deployment and validation

- Verify the exact reviewed Git commit has a successful GitHub CI run and a READY Vercel preview.
- Verify owner password sign-in, owner-only terminal registration, one-time token issuance, replay rejection, quote/candle upsert, same-installation quote/candle matching and stale-data fail-closed behaviour.
- Configure the GitHub Actions CRON_SECRET to match the Vercel CRON_SECRET before expecting scheduled hourly macro refreshes.
- Do not call a market feed LIVE until a publisher has ingested fresh broker timestamps and diagnostics confirm the feed.
- Production promotion requires an authenticated owner smoke test and runtime verification. A successful web build cannot prove MetaEditor compilation or broker connectivity.

## Personal EA source and release evidence

The owner console's Research governance section manages private evidence for the owner's own EA builds:

1. Add your own MQL5 source to MQL5/Experts/Release/ on the Windows laptop and compile with scripts/compile_mt5.ps1 -RequireProductSources.
2. Run MetaEditor compilation, Strategy Tester and demo-account compatibility checks. The web application cannot perform terminal-dependent tests.
3. Upload the resulting .ex5 through /owner → Release governance. The browser calculates SHA-256 and uploads directly to the private algolync-artifacts bucket using a short-lived signed upload URL.
4. The server verifies the private object and atomically registers its hash, size, version and owner audit event. Uploading always resets approval to false.
5. The owner must explicitly attest to zero MetaEditor errors/warnings and demo validation, provide a reason, then approve the personal release. Approval and revocation are separately audited.
6. The personal MT5 supervisor pipeline uses per-installation publisher tokens, not customer licences or paid entitlements. An artifact remains untrusted until its hash, MetaEditor result and demo-validation evidence are reviewed.

No performance metrics or equity curves are published until independently verified backtest and broker-forward datasets exist. Artifact approval does not certify strategy profitability or independent review.

## Intermarket research

Optional broker symbols DXY, USOIL and SPX500 may be mapped in MT5_SYMBOL_MAP, for example DXY=USDX,USOIL=WTI,SPX500=US500. Configure only symbols actually available from the broker. The owner research-governance panel calculates descriptive H1 correlations and 0–2 bar lead/lag associations from aligned data. These are research observations only, not causal claims, and do not independently authorize EA execution.
