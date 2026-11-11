# MacroLync · Global FX Intelligence

MacroLync provides institutional-style FX macro research, policy divergence, catalyst risk, CFTC positioning, and a MetaTrader signal bridge.

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
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Optional Paystack Inline checkout key; hosted redirect is used if omitted |
| `PAYSTACK_VIP_PLAN_CODE` | Paystack monthly NGN plan configured for exactly ₦5,000 |
| `NEXT_PUBLIC_APP_URL` | Optional canonical HTTP(S) URL for metadata and Paystack callbacks; callbacks fall back to the request origin |
| `CRON_SECRET` | Bearer secret for scheduled settlement and macro-refresh endpoints |
| `ALPHA_VANTAGE_API_KEY` | Optional free-tier US Federal Funds Rate and CPI observations |
| `FMP_API_KEY` | Optional Financial Modeling Prep economic calendar feed |
| `MACRO_DATA_PROVIDER_URL` | Optional HTTPS endpoint returning the complete validated macro snapshot, including COT positions |
| `MACRO_DATA_PROVIDER_TOKEN` | Optional bearer token for the complete macro snapshot provider |
| `COT_DATA_PROVIDER_URL` | Optional HTTPS override returning a COT array or `{ "cot": [...] }`; the public CFTC legacy futures-only feed is used by default |
| `COT_DATA_PROVIDER_TOKEN` | Optional bearer token for the COT provider override |
| `MT5_CREDENTIALS_ENCRYPTION_KEY` | Base64-encoded 32-byte AES-256-GCM key for MT5 investor credentials |

Generate a distinct encryption key for each environment and store it in your deployment secret manager:

```bash
openssl rand -base64 32
```

Never commit environment files, secret values or investor credentials.

## Supabase setup

Apply the migrations in `supabase/migrations/` to a Supabase project with Auth and Storage enabled. The institutional platform migration adds deal fee allocation, inspection deadlines, private dispute evidence, EA listings and provider-review queues, encrypted MT5 integration storage, disbursements, arbitration audit logs and restrictive RLS policies.

Enable Email/Password and Google providers in Supabase Auth and add the deployed site URL to the Auth redirect allowlist. Apply the macro production infrastructure migration to add profile tier/watchlist state and service-role-only subscription, key-hash, and snapshot tables. Public profile state uses `profiles`, keyed to `auth.users`; generated MT5 keys are returned only once and stored as SHA-256 hashes.

The runtime edge-guard migration normalizes existing 1.5% fee allocations and restores missing 48-hour inspection deadlines for funded, disputed and settling deals.

The two allowlisted administrator email addresses must have Supabase Auth accounts. The migration assigns their profile role; administrator APIs independently verify the authenticated user, allowlisted email and database role.

Configure the private `dispute-evidence` Storage bucket and ensure the production project has applied the RLS migration before enabling public deal creation.

## Payments and settlement

Configure Paystack's webhook URL to `https://<your-domain>/api/paystack-webhook`. Configure the VIP plan in Paystack for exactly NGN 5,000 monthly; checkout rejects payment activation unless the signed webhook matches the authenticated account, pending reference, amount, and currency. Deal funding begins at `/api/escrow/<reference>/fund`; only a signed Paystack charge webhook with the expected currency and amount marks a deal funded. The 48-hour inspection deadline is persisted server-side, and a dispute atomically freezes a funded deal.

`vercel.json` schedules `/api/cron/settlements` hourly and `/api/cron/sync-macro` every Friday at 23:00 UTC. Set `CRON_SECRET`; the macro job persists snapshots only when it has live CFTC/COT positioning. The COT adapter reads the official CFTC legacy futures-only report and calculates historical net-position percentiles; the normalized provider override remains available. Alpha Vantage and Financial Modeling Prep feeds are optional, with validated static seeds retained as fallback. The MT5 bridge is available at `/api/v1/macro-signal?pair=EURUSD&api_key=<key>` and validates a generated account key on each request.

## Verification and risk disclosures

The AlgoLync marketplace displays published Supabase listings and recorded verification metrics only; no seeded sample performance, simulated quotes or demo download artifacts are served. Myfxbook and FXBlue submissions are reviewed by an administrator before a listing can be marked verified. MT5 investor credentials are accepted only by the authenticated server endpoint and encrypted with AES-256-GCM; configure the key before accepting those credentials. Automated purchase-to-license provisioning is not enabled; the legacy license-verification endpoint returns `410 Gone` rather than claiming licenses exist without a live license data source.

Escrow creation associates an authenticated creator session when one is present. The customer dashboard requires Supabase Auth and reads only deals associated with that user. Apply the escrow creator migration before deploying this version.

Trading and escrow services require appropriate legal, financial, identity-verification, fraud-monitoring, incident-response and provider approvals before production use. Provider settlement timing and account eligibility remain subject to Paystack and bank rules.

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build
```
