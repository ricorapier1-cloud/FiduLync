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
