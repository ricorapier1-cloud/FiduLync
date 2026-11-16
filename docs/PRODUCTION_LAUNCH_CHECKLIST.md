# FiduLync production launch checklist

This runbook is for the project owner. Never commit secret values to GitHub, paste them into source files, or expose them in browser code.

## Current release posture

- Development branch: `fix/institutional-api-contracts`
- Production branch: `main` (not changed by this work)
- Public project domain: `https://fidulync.vercel.app`
- Paystack payments fail closed until the production secret is configured.
- License email delivery and email-verified MT5 account transfers require `RESEND_API_KEY` and a verified `LICENSE_FROM_EMAIL`.
- MT5 heartbeat and trade ingestion fail closed until the private EA API key is configured.
- No compiled `.ex5` trading robot is represented as available until it has been built and tested in MetaEditor.

## Required Vercel Production environment variables

In Vercel → Project → Settings → Environment Variables, configure the following for **Production**. Configure Preview as well when you want to test the same flows on preview deployments.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public URL only) |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase secret/service-role key; never prefix with `NEXT_PUBLIC_` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key for initialize, verify and webhook signature validation |
| `RESEND_API_KEY` | Server-only transactional email API key for license delivery and transfer verification |
| `LICENSE_FROM_EMAIL` | Verified sender identity/domain configured with the email provider (for example, `AlgoLync <licenses@your-verified-domain>`) |
| `PAYSTACK_PUBLIC_KEY` and/or `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key if the checkout UI requires it |
| `ALGO_PRIVATE_API_KEY` | Long random secret shared only with trusted EA clients for private heartbeat/trade ingestion |
| `CRON_SECRET` | Long random secret used to authorize the scheduled macro refresh |
| `NEXT_PUBLIC_APP_URL` | Set to `https://fidulync.vercel.app` |

The server Supabase helper accepts either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, and either `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`. Do not use a publishable/anon key for server-side writes.

Other configured market-data providers may require `FX_API_KEY`, `FRED_API_KEY`, `FINNHUB_API_KEY`, or `GEMINI_API_KEY` depending on which provider-backed features are enabled. Keep these server-only.

## Paystack setup

1. Confirm the Paystack account is activated for the currencies and business model being sold.
2. Add the live secret key to Vercel Production as `PAYSTACK_SECRET_KEY`. Use the test key only in a non-production environment.
3. Set `NEXT_PUBLIC_APP_URL=https://fidulync.vercel.app`.
4. In Paystack Dashboard → Settings → API Keys & Webhooks, set the webhook URL to:
   `https://fidulync.vercel.app/api/v1/paystack-webhook`
5. Configure `RESEND_API_KEY` and `LICENSE_FROM_EMAIL` in Vercel Production so license delivery and account-transfer codes can be emailed. Verify the sender domain with the email provider first.
6. Deploy after changing environment variables.
7. Test a successful payment, failed payment, duplicate webhook delivery, and a callback retry with a Paystack test account in Preview before enabling live sales.

The checkout currently prices subscriptions in minor currency units: NGN 65,000 monthly, USD 49 monthly, NGN 250,000 lifetime, USD 199 lifetime. Confirm these prices and tax/refund terms before enabling live sales.

## MT5 / EA bridge setup (when a laptop is available)

1. Set the same strong `ALGO_PRIVATE_API_KEY` in Vercel and the EA's private request configuration. Do not hardcode it into a public downloadable source file.
2. Add `https://fidulync.vercel.app` to MT5 Tools → Options → Expert Advisors → Allow WebRequest for listed URL.
3. Compile the EA in MetaEditor and resolve all compiler errors and warnings.
4. Verify license validation against a real purchased test license and the correct MT5 account.
5. Verify heartbeat, closed-trade ingestion, customer-specific account history, and offline status.
6. Run on a demo account before any live trading. No automated profitability or safety guarantee is implied.

## Release gates

Do not promote the development branch to `main` or switch on live selling until:
- The latest production build is READY.
- Required production secrets are configured and confirmed without exposing their values.
- Paystack test-mode payment and webhook flows pass.
- License issuance is idempotent and account-bound.
- Supabase customer data isolation is tested with two different MT5 accounts.
- Macro data freshness and cron authentication are tested.
- Public routes, login, store, dashboard, and support journeys have been smoke-tested.

## Security notes

- Never put private keys, Supabase secret keys, service-role keys, Paystack secret keys, or cron secrets in client-side variables or Git.
- Rotate any credential that has been pasted into public source, logs, or chat.
- Keep the WhatsApp support component and its existing behavior unchanged.
