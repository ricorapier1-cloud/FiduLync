# FiduLync MT5 connector — owner setup and operations

## What is implemented

- Owner-only, passwordless token issuance at `/owner`.
- A unique 256-bit random installation token is returned once; only its SHA-256 hash is stored in Supabase.
- Owner can list installations and revoke an individual token.
- `POST /api/mt5/ingest` accepts data-only closed H1/H4/D1 candles and fresh bid/ask quotes.
- Server validates credentials, request timestamp, nonce replay, OHLC consistency, symbol format, freshness, payload size and per-installation request rate.
- Raw broker candle and quote observations are stored in private Supabase tables with broker/server and contract metadata.
- MacroLync's technical engine now prefers fresh broker candles from the MT5 tables and falls back to the configured external candle provider only when MT5 data is not available.
- Downloadable source: `/downloads/FiduLync_MT5_Data_Connector.mq5`.

## First-time connection

1. Sign in at `https://fidulync.vercel.app/owner` using the private owner email `ricorapier1@gmail.com`.
2. Create a connector token in the MT5 market-data connector section. Give it a label such as `IC Markets NY2`.
3. Copy the token immediately. It is shown once. Never post it in chat, email, source control, or a public group.
4. Download the MQ5 source from `https://fidulync.vercel.app/downloads/FiduLync_MT5_Data_Connector.mq5`.
5. On a Windows computer or Windows VPS with MT5 installed, open MetaEditor, create/open the EA file, paste or save the source, and compile it. This source is not a compiled EX5 binary.
6. In MT5, open Tools → Options → Expert Advisors and enable WebRequest for:
   `https://fidulync.vercel.app`
7. Attach the data connector EA to a chart. Set its unique token in `InpInstallationToken`. Leave `InpIngestUrl` as supplied.
8. To collect several symbols, enter the exact broker symbol names in `InpSymbols`, comma-separated (for example `EURUSD,GBPUSD,USDJPY`). Empty means chart symbol only. Broker suffixes must match exactly.
9. Leave the timer at 90 seconds initially. The connector requests up to 200 closed bars for H1/H4/D1, sends them in safe batches, and periodically refreshes the latest data.
10. Return to `/owner`. The installation should show its broker/server and a recent Last seen timestamp. Revoke it immediately if the token is exposed.

## Device requirement

The MT5 terminal and connector must run on Windows (local PC or Windows VPS) and remain online. Android MT5 cannot run this desktop MQL5 connector. The owner console and API can be operated from a phone, but the connector cannot be compiled or run from Android alone. The MQ5 source is provided now so it is ready when a Windows terminal is available.

## Data integrity and limits

- This is a data-only EA. It contains no order placement, modification, or account-password handling.
- MT5 closed-bar history is used for research; bid/ask is a point-in-time broker quote, not a consolidated global FX quote.
- Connector sends 200 bars per timeframe by default. The database stores broker-specific symbol names as sent.
- The server allows a bounded number of batches per installation per minute. Do not configure an excessively short timer or too many symbols; begin with 1–3 symbols and increase only after confirming stable ingestion.
- The technical engine currently expects exact canonical symbol names (e.g. `EURUSD`). If your broker uses a suffix (e.g. `EURUSD.a`), use the canonical symbol only after a symbol-alias mapping has been added; do not assume suffix stripping is safe.
- A fresh terminal heartbeat alone does not prove all requested symbols have complete H1/H4/D1 coverage. A signal remains unavailable unless all three timeframes contain at least 200 valid closed candles.
- Market holidays, weekends, broker maintenance, missing history and terminal disconnections may cause data to be marked stale/unavailable. The engine should fail closed rather than fabricate data.
- Keep official macro sources (FRED, ECB, BLS, BEA, CFTC, etc.) separate from broker price observations. MT5 is not a substitute for fundamental data or independent cross-market verification.
- This integration does not claim predictive accuracy or profitability. Walk-forward and out-of-sample validation after transaction costs remain required.

## Troubleshooting

- **No connector token controls:** owner login must complete and server-side owner verification must pass.
- **WebRequest error -1:** add the exact HTTPS origin to MT5's Expert Advisors WebRequest allowlist.
- **HTTP 401:** token is missing, malformed, revoked, or does not match the installation record.
- **HTTP 409:** nonce replay; connector should create a new request nonce on every upload.
- **HTTP 429:** too many requests; restore the 90-second timer and reduce symbols per terminal.
- **HTTP 400:** inspect terminal logs; request timestamps must be UTC ISO-8601, candles must be closed and OHLC valid.
- **Last seen is recent but technical feed is unavailable:** check exact broker symbol spelling and H1/H4/D1 history coverage; open each symbol/timeframe once in MT5 to allow history download.
- **Token lost:** revoke the old installation and create a new token. The server never reveals an existing token again.

## Operational security

- Do not put the token in a public downloadable EA default, GitHub, screenshots or shared chat.
- Do not use the same token across customers or terminals.
- Revoke old installations from the owner console.
- Supabase service-role credentials remain server-only. The three MT5 tables have RLS enabled and no anon/authenticated table grants.
- Rotate/revoke credentials immediately if a terminal or VPS is compromised.
