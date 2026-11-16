# FiduLync / MacroLync — Manual Setup Checklist
Updated: 2026-11-16

This guide lists only actions requiring the project owner's account or consent. Do not paste API secrets into chat, GitHub issues, source files, screenshots, or public logs.

## What the engineering work handles
- Add and maintain official-source adapters and provider health reporting.
- Normalize observations, timestamps, revisions and source metadata.
- Add data-quality and stale-feed gates.
- Build broker-aware MT5 market-data ingestion and versioned API contracts.
- Add automated tests, deployment previews, smoke tests and release checks.
- Preserve `ricorapier1@gmail.com` as private owner identity and `fidulync@gmail.com` as customer support.

## Owner actions — only when requested

### 1. No API key action is required immediately
Existing Vercel configuration includes names for `FRED_API_KEY`, `FINNHUB_API_KEY`, `GEMINI_API_KEY`, `FX_API_KEY`, `CRON_SECRET`, Supabase and Upstash. The names exist; credential validity, account quota and data rights still need a server-side health check. Do not rotate or delete these credentials without a reason.

### 2. Register for free official US statistical APIs
These are the next keys worth creating because they provide source-of-record data:
- BLS API registration: https://www.bls.gov/developers/
- BEA API registration: https://apps.bea.gov/API/signup/

Use the free registration options. Keep the keys private. Once the engineering branch confirms the exact environment-variable names and adapter support, add the keys in Vercel:
Project → Settings → Environment Variables → Add New → Production (and Preview if requested).
Do not add them before the matching code is deployed. Never send the key in an email or commit it to GitHub.

### 3. Owner email delivery
Owner OTP uses Supabase Auth. Test sign-in at https://fidulync.vercel.app/owner only after a deployment includes the latest owner-access code. If no email arrives, the owner must configure a trusted SMTP sender in Supabase Auth settings. Keep owner login restricted to `ricorapier1@gmail.com`. Customer support remains `fidulync@gmail.com`.

### 4. Broker MT5 data bridge
No laptop is needed to prepare the cloud architecture, but actual broker-specific candles and execution telemetry require a running MT5 terminal/EA. When a laptop is available, install the FiduLync bridge EA, enable WebRequest to the FiduLync domain, and connect the chosen demo broker account. Do not enable live trading during the first validation stage.
Until this bridge is operating, independent market candles must come from a separately licensed provider; the app must display technical data as unavailable and abstain from execution decisions.

### 5. Provider terms
Before commercial display or redistribution of any market data, the owner may need to accept a provider plan or obtain written commercial-use permission. Free API access is not automatically a commercial redistribution licence. Do not pay for a provider without comparing coverage, latency, historical depth, display rights and redistribution terms.

## What must be true before launch
- Provider health endpoint reports successful authentication, quota status where exposed, response age and schema validity.
- Macro observations show provider, series, observation period, publication timestamp, retrieval timestamp and revision/vintage where available.
- A fallback/reference value is never labelled live.
- Missing or stale calendar, market candle or essential macro inputs force ABSTAIN / execution-ineligible.
- Broker quotes, bid/ask spread, symbol specification and server time are validated separately from research reference prices.
- BLS/BEA/IMF/Eurostat adapters are tested with known official observations.
- Historical tests use point-in-time vintages where possible and avoid look-ahead bias.
- Out-of-sample and demo forward tests pass before any live EA execution is enabled.

## Important
The app must not claim that every global forex driver is covered or that signals are profitable. It should expose coverage gaps and abstain when evidence is insufficient.
