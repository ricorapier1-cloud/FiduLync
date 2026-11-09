# FiduLync · AlgoLync

FiduLync provides escrow-backed deal links; AlgoLync presents MetaTrader tools with transparent, source-attributed verification states.

## Local development

```bash
npm install
npm run dev
```

Set the following environment variables in the deployment environment:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser Supabase Auth client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service access; never expose to the browser |
| `PAYSTACK_SECRET_KEY` | Server-side checkout, refund and transfer requests |
| `NEXT_PUBLIC_APP_URL` | Canonical HTTPS application URL used for Paystack callbacks |
| `CRON_SECRET` | Bearer secret for the scheduled settlement endpoint |
| `MT5_CREDENTIALS_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM key for MT5 investor credentials |

Generate a distinct encryption key for each environment and store it in your deployment secret manager:

```bash
openssl rand -base64 32
```

Never commit environment files, secret values or investor credentials.

## Supabase setup

Apply the migrations in `supabase/migrations/` to a Supabase project with Auth and Storage enabled. The institutional platform migration adds deal fee allocation, inspection deadlines, private dispute evidence, EA listings and provider-review queues, encrypted MT5 integration storage, disbursements, arbitration audit logs and restrictive RLS policies.

The two allowlisted administrator email addresses must have Supabase Auth accounts. The migration assigns their profile role; administrator APIs independently verify the authenticated user, allowlisted email and database role.

Configure the private `dispute-evidence` Storage bucket and ensure the production project has applied the RLS migration before enabling public deal creation.

## Payments and settlement

Configure Paystack's webhook URL to `https://<your-domain>/api/paystack/webhook`. Deal funding begins at `/api/escrow/<reference>/fund`; only a signed Paystack charge webhook with the expected currency and amount marks a deal funded. The 48-hour inspection deadline is persisted server-side, and a dispute atomically freezes a funded deal.

`vercel.json` schedules `/api/cron/settlements` hourly. Set `CRON_SECRET` and enable Paystack transfers/refunds before using it. Automated seller bank transfers are currently limited to NGN; unsupported payout currencies remain unsettled and require an explicitly configured provider workflow. Provider transfer completion is reconciled through the Paystack webhook.

## Verification and risk disclosures

Myfxbook and FXBlue submissions are reviewed by an administrator before a listing can be marked verified. MT5 investor credentials are accepted only by the authenticated server endpoint and encrypted with AES-256-GCM; configure the key before accepting those credentials. Sample marketplace metrics and equity curves are explicitly illustrative and are not represented as audited live results.

Trading and escrow services require appropriate legal, financial, identity-verification, fraud-monitoring, incident-response and provider approvals before production use. Provider settlement timing and account eligibility remain subject to Paystack and bank rules.

## Validation

```bash
npm run lint
npm run build
```
