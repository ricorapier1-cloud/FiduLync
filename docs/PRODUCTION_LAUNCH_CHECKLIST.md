# FiduLync production launch checklist

This runbook is for the project owner. Never commit secret values to GitHub, paste them into source files, or expose them in browser code.

## Current release posture

- Development branch: `feat/personal-quant-edition`
- Production branch: `main` (not changed by this work)
- Public project domain: `https://fidulync.vercel.app`
- Production remains on `main`; the current Personal Quant feature branch is not yet promoted.
- Paystack live processing is disabled, and paid checkout remains blocked until merchant activation plus an approved private compiled `.ex5` release artifact.
- License email delivery and email-verified MT5 account transfers require `RESEND_API_KEY` and a verified `LICENSE_FROM_EMAIL`.
- MT5 heartbeat ingestion now accepts only a valid signed 24-hour AlgoLync licence lease and rechecks the licence, product artifact and bound seat. The separate owner MT5 publisher pipeline still requires its installation token.
- No compiled `.ex5` trading robot is represented as available until it has been built and tested in MetaEditor, uploaded to private Storage, hash metadata registered, and explicitly owner-approved.

## Required Vercel Production environment variables

In Vercel → Project → Settings → Environment Variables, configure the following for **Production**. Configure Preview as well when you want to test the same flows on preview deployments.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public URL only) |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase secret/service-role key; never prefix with `NEXT_PUBLIC_` |
| `PAYSTACK_SECRET_KEY` | Paystack secret key for initialize and transaction verification; legacy webhook signature fallback |
| `PAYSTACK_WEBHOOK_SECRET` | Preferred timestamped webhook signing secret (`whsec_...`) from Paystack Dashboard; deploy before disabling legacy signatures |
| `ALGOLYNC_LEASE_SIGNING_SECRET` | Server-only signing key for 24-hour MT5 license leases (already provisioned in Vercel) |
| `RESEND_API_KEY` | Server-only transactional email API key for license delivery and transfer verification |
| `LICENSE_FROM_EMAIL` | Verified sender identity/domain configured with the email provider (for example, `AlgoLync <licenses@your-verified-domain>`) |
| `PAYSTACK_PUBLIC_KEY` and/or `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key if the checkout UI requires it |
| `ALGOLYNC_PRIVATE_KEY` (or legacy `ALGO_PRIVATE_API_KEY`) | Long random secret shared only with trusted EA clients for private heartbeat/trade ingestion |
| `CRON_SECRET` | Long random secret used to authorize the scheduled macro refresh |
| `OWNER_EMAIL` | Explicit owner email matching the owner audit policy; no server-side fallback |\n| `NEXT_PUBLIC_APP_URL` | Set to `https://fidulync.vercel.app` |

The server Supabase helper accepts either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, and either `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`. Do not use a publishable/anon key for server-side writes.

Other configured market-data providers may require `FX_API_KEY`, `FRED_API_KEY`, `FINNHUB_API_KEY`, or `GEMINI_API_KEY` depending on which provider-backed features are enabled. Keep these server-only.

## Paystack setup

1. Confirm the Paystack account is activated for the currencies and business model being sold.
2. Add the live secret key to Vercel Production as `PAYSTACK_SECRET_KEY`. Use the test key only in a non-production environment.
3. Set `NEXT_PUBLIC_APP_URL=https://fidulync.vercel.app`.
4. In Paystack Dashboard → Settings → API Keys & Webhooks, set the webhook URL to `https://fidulync.vercel.app/api/paystack/webhook`. If Paystack's timestamped webhook signing secret is enabled, add its dashboard-issued `whsec_...` value to Vercel as `PAYSTACK_WEBHOOK_SECRET`. Until then, the endpoint supports legacy `x-paystack-signature` verification.
5. Configure `RESEND_API_KEY` and `LICENSE_FROM_EMAIL` in Vercel Production so licence delivery and account-transfer codes can be emailed. Verify the sender domain with the email provider first.
6. Deploy after changing environment variables.
7. Test a successful payment, failed payment, duplicate webhook delivery, subscription creation, invoice failure, invoice renewal, non-renewal and cancellation using a Paystack test account in Preview before enabling live sales.

## MT5 / EA bridge setup (when a laptop is available)

1. Set the same strong `ALGOLYNC_PRIVATE_KEY` in Vercel and the EA's private request configuration (the legacy `ALGO_PRIVATE_API_KEY` alias is also accepted). Do not hardcode it into a public downloadable source file.
2. Add the exact verified deployment origin to MT5 Tools → Options → Expert Advisors → Allow WebRequest for listed URL.
3. Put actual product `.mq5` source files in `MQL5/Experts/Release/`; run `scripts/compile_mt5.ps1 -MetaEditorPath "<actual MetaEditor path>" -RequireProductSources` and resolve all compiler errors and warnings.
4. Upload the compiled `.ex5` through `/owner` → Release governance, verify the displayed SHA-256, complete demo-account validation, and explicitly approve the artifact before attempting paid or demo license validation.
5. Verify publisher heartbeat, closed-trade ingestion, customer-specific account history, and stale/offline status.
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


## EA artifact release workflow

The owner console includes direct-to-private-Storage `.ex5` upload, SHA-256 metadata registration, explicit release approval and audited revocation. Binary upload uses a short-lived signed Supabase Storage URL so large files do not pass through the Vercel function body. Uploading does not approve a release. Checkout, demo entitlement creation, paid license provisioning and validation all remain blocked until the artifact is approved and the private object is still present.
