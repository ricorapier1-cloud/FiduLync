# FiduLync owner and hybrid market-data runbook

## Private owner access

- Open `/owner` and sign in using the registered owner email address and password.
- Customer registration, checkout, subscription, escrow and customer licence provisioning are outside the Personal Quant Edition.
- The server verifies the Supabase Auth access token against the exact configured owner email and a confirmed email address.
- Preserve the existing owner account and password-recovery flow. Do not create public owner registration.
- Use the owner console to issue and revoke per-terminal MT5 publisher tokens. Tokens are displayed once; only their hashes are stored.
- Never expose Supabase service-role keys, publisher tokens or owner access tokens in browser code or source control.

## Hybrid market data

1. Register a publisher in `/owner`. The bearer token is displayed once; store it in the MT5 publisher terminal's private input, never in source control or a browser URL.
2. Publisher sends HTTPS POST batches to `/api/v1/market-data/ingest` using:
   - `Authorization: Bearer <publisher-token>`
   - `x-mt5-timestamp: <UTC ISO timestamp>`
   - `x-mt5-nonce: <unique UUID per request>`
   - JSON body with `quotes[]` and `candles[]`
3. The ingestion endpoint hashes the token, resolves an active installation, enforces a five-minute timestamp window, stores the nonce to prevent replay, validates quote/OHLC/timeframe values, and upserts into the existing MT5 market tables.
4. Technical analysis selects closed candles from one active installation only. H1/H4/D1 feeds must be fresh (2h/8h/48h maximum respectively) and have at least 200 candles per timeframe. If MT5 data is incomplete, the existing independent HTTPS candle provider may be used only when it returns fresh data.
5. Spot quotes prefer fresh MT5 broker quotes. Frankfurter is a public daily reference-rate source and may be used for contextual comparison only; it is never an executable quote. Finnhub and Twelve Data may be enabled only when your own personal plan explicitly permits the exact display/use. ExchangeRate-API, Gold-API and custom providers remain opt-in until their personal-use terms are verified. No reference rate may be represented as a live broker quote.
6. Signals remain fail-closed when required macro/technical data is missing, stale, or incomplete.

### Windows VPS publisher

The repository includes `scripts/mt5_market_publisher.py`. It uses the official MetaTrader5 Python module against an already logged-in Windows MT5 terminal; no MetaEditor compilation is required for this publisher.

1. Install Python 3.11+ and MetaTrader 5 on a Windows VPS. Log in to the broker terminal manually and confirm Market Watch symbols are available.
2. Install the Python package: `py -m pip install MetaTrader5`.
3. Create a publisher token in `/owner`, then set it only in the VPS environment as `FIDULYNC_PUBLISHER_TOKEN`.
4. Set `MT5_SYMBOL_MAP` if the broker uses suffixes, for example `EURUSD=EURUSD.a,GBPUSD=GBPUSD.a,USDJPY=USDJPY.a,XAUUSD=XAUUSD.a`.
5. Run `py scripts/mt5_market_publisher.py`. It sends the initial 200 closed bars for H1/H4/D1, then only new closed bars, plus refreshed quotes. It never opens or modifies trades.
6. Check the owner console's publisher last-seen time and market diagnostics. If the publisher is stopped, quotes become stale and technical signals must fail closed.

No broker master/investor passwords are collected or stored. A Windows MT5 terminal on a VPS or PC must run the publisher before MT5 candles/quotes can appear; Vercel cannot host the MT5 terminal itself.

## Paystack

- `PAYSTACK_LIVE_ENABLED` remains false until Paystack confirms merchant activation and the public product, pricing, refund and contact disclosures are ready.
- Paid checkout and demo-license issuance are additionally blocked until an approved compiled `.ex5` artifact exists in private Storage, its SHA-256 metadata is registered, and the owner explicitly approves release.
- A live key beginning `sk_live_` is rejected unless `PAYSTACK_LIVE_ENABLED=true`. Keep it disabled until all release and merchant gates pass.
- Owner complimentary licensing does not call Paystack and does not create a paid transaction.

## Deployment checklist

- Apply the migration `20261117120000_owner_lifetime_and_mt5_hybrid.sql` to the linked Supabase project after review.
- Configure Supabase Auth email delivery and allow the production redirect `https://fidulync.vercel.app/owner`.
- Deploy the application branch and verify owner email/password sign-in, owner-only issuance, invalid-email rejection, publisher token creation, replay rejection, quote/candle upsert, and stale-data fail-closed behavior.
- Do not call the market feed LIVE until a publisher has successfully ingested fresh broker timestamps and diagnostics confirm the feed. No broker feed is currently registered in the database.


## Optional intermarket research feeds

The publisher supports optional canonical symbols `DXY`, `USOIL` and `SPX500` in addition to the core FX/metals universe. Map them to the broker's actual symbol names in `MT5_SYMBOL_MAP`, for example `DXY=USDX,USOIL=WTI,SPX500=US500` while retaining every required core symbol. The broker terminal must expose the mapped symbols and closed H1 history. The owner research-governance panel then calculates descriptive H1 correlations and 0–2 bar lead/lag associations from aligned data. These are research observations only; they are not causal claims and do not alter EA decisions. No intermarket result is shown as available until the broker feed provides enough aligned observations.


## EA release artifact workflow

The owner console's **Research governance** section is intended to contain the private compiled-artifact workflow:

1. Add the real commercial `.mq5` source to `MQL5/Experts/Release/` on the Windows laptop and compile with `scripts/compile_mt5.ps1 -RequireProductSources`.
2. Run MetaEditor, Strategy Tester and demo-account compatibility checks. The application cannot perform these terminal-dependent tests.
3. Upload the resulting `.ex5` through `/owner` → Release governance. The browser calculates SHA-256 and uploads directly to the private `algolync-artifacts` bucket using a short-lived signed upload URL; the binary does not pass through Vercel's serverless request body.
4. The server verifies the private object exists and atomically registers its hash, size, version and owner audit event. Uploading always resets approval to false.
5. The owner must explicitly attest to zero MetaEditor errors/warnings and demo validation, provide a reason, then approve the release. Approval and revocation are separately audited.
6. The personal MT5 supervisor pipeline does not require customer licences or paid entitlements. A compiled EA artifact remains untrusted until its hash, MetaEditor result and demo-validation evidence are reviewed.

No performance metrics or equity curves are published until independently verified backtest and broker-forward datasets exist. The artifact workflow does not itself certify strategy profitability or independent review.
