# FiduLync owner and hybrid market-data runbook

## Owner access and complimentary license

- Open `/owner` and request a Supabase email sign-in link using the verified owner mailbox `ricorapier1@gmail.com`.
- The server verifies the Supabase Auth access token against Auth and requires the exact owner email plus a confirmed email address. Customer support addresses do not satisfy this check.
- Issue an owner license by entering the MT5 login. The server generates the key using cryptographic randomness, stores it in `public.licenses` with tier `OWNER_LIFETIME`, active status, and a null expiry, and records an audit event.
- The license is bound to that MT5 login by the existing license validator. Do not expose service-role keys or owner tokens in the browser.
- The owner audit table is service-role only and has RLS enabled.

## Hybrid market data

1. Register a publisher in `/owner`. The bearer token is displayed once; store it in the MT5 publisher terminal's private input, never in source control or a browser URL.
2. Publisher sends HTTPS POST batches to `/api/v1/market-data/ingest` using:
   - `Authorization: Bearer <publisher-token>`
   - `x-mt5-timestamp: <UTC ISO timestamp>`
   - `x-mt5-nonce: <unique UUID per request>`
   - JSON body with `quotes[]` and `candles[]`
3. The ingestion endpoint hashes the token, resolves an active installation, enforces a five-minute timestamp window, stores the nonce to prevent replay, validates quote/OHLC/timeframe values, and upserts into the existing MT5 market tables.
4. Technical analysis selects closed candles from one active installation only. H1/H4/D1 feeds must be fresh (2h/8h/48h maximum respectively) and have at least 200 candles per timeframe. If MT5 data is incomplete, the existing independent HTTPS candle provider may be used only when it returns fresh data.
5. Spot quotes prefer fresh MT5 broker quotes; Finnhub and existing reference providers remain independent fallback sources. Reference-rate sources must never be represented as real-time executable broker prices.
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

- Checkout can continue using a test key for controlled testing.
- A live key beginning `sk_live_` is rejected unless `PAYSTACK_LIVE_ENABLED=true`.
- Leave that variable false or unset until Paystack confirms merchant activation in writing and the public product, pricing, refund, and contact disclosures are ready.
- Owner complimentary licensing does not call Paystack and does not create a paid transaction.

## Deployment checklist

- Apply the migration `20261117120000_owner_lifetime_and_mt5_hybrid.sql` to the linked Supabase project after review.
- Configure Supabase Auth email delivery and allow the production redirect `https://fidulync.vercel.app/owner`.
- Deploy the application branch and verify owner OTP, owner-only issuance, invalid-email rejection, publisher token creation, replay rejection, quote/candle upsert, and stale-data fail-closed behavior.
- Do not call the market feed LIVE until a publisher has successfully ingested fresh broker timestamps and diagnostics confirm the feed.


## Optional intermarket research feeds

The publisher supports optional canonical symbols `DXY`, `USOIL` and `SPX500` in addition to the core FX/metals universe. Map them to the broker's actual symbol names in `MT5_SYMBOL_MAP`, for example `DXY=USDX,USOIL=WTI,SPX500=US500` while retaining every required core symbol. The broker terminal must expose the mapped symbols and closed H1 history. The owner research-governance panel then calculates descriptive H1 correlations and 0–2 bar lead/lag associations from aligned data. These are research observations only; they are not causal claims and do not alter EA decisions. No intermarket result is shown as available until the broker feed provides enough aligned observations.
