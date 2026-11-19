# FiduLync Institutional Platform — Refinement & Release Specification

**Scope:** FiduLync platform, MacroLync market intelligence, AlgoLync EA licensing and owner operations.  
**Architecture target:** Next.js App Router / React 19 / Tailwind CSS 4, Supabase PostgreSQL/Auth, Vercel, Paystack and MT5/MQL5.  
**Status:** Implementation candidate on feat/personal-quant-edition; not a production certification.

## 1. Architecture and delivery gates

- Maintain strict TypeScript, zero-warning ESLint and reproducible production builds.
- Run dependency audit, TypeScript, quant governance tests, lint, production build, Python publisher tests and MQL5 distribution parity in CI.
- Public APIs fail closed if the database, authentication provider or distributed rate limiter is unavailable. No local-development entitlement, demo-prefix bypass, fake license, or unpersisted success response is permitted.
- Use server-only Supabase credentials. Never ship service-role keys, Paystack secret keys, owner tokens or installation tokens to browser bundles.
- Keep database schema changes versioned in Supabase migrations whose filenames match the applied remote migration versions.
- Production promotion requires a successful exact-commit Vercel deployment, runtime smoke tests and all product/security release gates. A passing build alone is not a release approval.

## 2. API security and persistence

The following routes must validate input shape, enforce request-size limits, use durable IP sliding-window rate limits and return no-store responses:

- POST /api/v1/validate-license
- GET|POST /api/v1/bind-account
- POST /api/v1/provision-demo-license
- GET /api/owner/verify

The limiter uses the trusted Vercel x-real-ip header, HMAC-hashes the IP-derived key, and calls the atomic PostgreSQL consume_api_rate_limit function. If the trusted IP, Supabase service credential or RPC is unavailable, the endpoint returns 503 instead of silently disabling rate limiting.

Licence validation requires a valid active entitlement, product slug, account number and LIVE/DEMO mode. Demo licences are DEMO-only. A licence key does not bypass database checks. Seat assignment is performed by the server-only bind_algolync_seat RPC under a licence row lock.

Account binding has an included allowance of **1 LIVE + 2 DEMO seats** for the paid EA products. Product-specific database entitlements remain authoritative. A rebind must identify the old account and the replacement account; the server verifies ownership of the old seat and enforces the 72-hour cooldown atomically. Duplicate or over-capacity account assignments are rejected.

Demo entitlements are persisted, expire after 14 days and receive zero LIVE seats. No placeholder, preview or offline license key is ever displayed as a real licence.

## 3. Owner control plane

- Normal owner login is email + password only. OTP/magic-link login is not used. Password-reset email is for recovery only.
- Public owner registration remains disabled. The server verifies the authenticated Supabase user, confirmed email and configured owner identity on every privileged request.
- Owner verification, operations, market intelligence, control-plane, diagnostics, license issuance/revocation and MT5 installation lifecycle endpoints are rate limited.
- MT5 installation tokens are random, stored only as SHA-256 hashes, displayed once, scoped to the authenticated owner and revocable.
- Licence revocation requires owner authentication, a reason and explicit confirmation. The licence status update and owner-audit event are committed in one database function.
- Customer credentials, payment secrets and full connector tokens are never returned by owner read APIs.

## 4. AlgoLync storefront and Paystack

- /store is the canonical AlgoLync storefront. /licensing redirects to /store. The private quantitative research workspace remains available at /research.
- Checkout offers monthly (30-day) and one-time licence terms in NGN and USD. Monthly access requires a new successful renewal payment; automatic renewal must not be implied unless a Paystack subscription flow is explicitly enabled and disclosed.
- The server reads current product prices and seat entitlements from ea_products. Browser-supplied prices are never trusted.
- Paystack references include the full EA slug and a cryptographically random suffix. The callback URL is same-origin HTTPS.
- A browser redirect never issues a licence. The webhook signature and Paystack transaction verification must succeed; reference, product, plan, currency and exact minor-unit amount must match the server-side catalogue.
- The provision_algolync_license_v2 database function is idempotent and atomically persists the product-bound entitlement. A failed or ambiguous database write never falls back to a locally fabricated licence.
- Paystack live processing remains disabled unless merchant compliance approval and the explicit live-payment environment gate are confirmed.

## 5. Performance evidence and customer disclosures

- Catalog win rate, profit factor, Sharpe, drawdown and equity curves are labelled SIMULATED / ILLUSTRATIVE — NOT LIVE VERIFIED.
- User-reported closed-trade records are labelled as reported telemetry, not independent broker verification.
- Live verified performance may be displayed only after authenticated MT5 installation provenance, account isolation, complete closed-trade history, account-currency and broker/server context, execution-cost evidence and reconciliation are available. Otherwise show “Not available”.
- Terms disclose leveraged trading risk, loss of capital, EA/software/network/broker failure, model limitations, backtest bias, data-provider restrictions, licence duration, account seats and the absence of guaranteed results.
- Privacy and risk pages are operational baselines. They still require the operator’s legal entity/contact details, jurisdiction-specific legal review, tax/privacy review and final cancellation/refund terms before public commercial launch.

## 6. Navigation and mobile UX

- Secondary routes /store, /account, /owner, /privacy, /terms, /faq and /guide provide a clear Back to Terminal link.
- The mobile bottom bar is limited to four primary destinations; full secondary navigation remains in the desktop menu/drawer and footer.
- Mobile content reserves bottom safe-area clearance for fixed navigation and floating support controls. Store, checkout, legal pages and long telemetry tables use additional bottom padding.
- Checkout requires acknowledgement of the trading-risk disclosure and links to the full Terms and Privacy Notice.

## 7. Implemented in this refinement branch

- Durable PostgreSQL sliding-window rate-limit table/RPC with explicit deny RLS policy.
- Atomic seat binding/rebinding RPC with 72-hour cooldown and product seat limits.
- Product-bound, exact-amount Paystack licence provisioning RPC and database-authoritative one-time pricing.
- Password-only owner authentication retained; owner verification and privileged APIs hardened.
- Owner-only audited licence revocation API and control-plane action.
- Owner-authenticated and rate-limited MT5 installation token lifecycle.
- Canonical /store route, /research route for the private Quant Lab and /licensing compatibility redirect.
- Simulated-vs-reported-vs-live-verified performance labels, risk acknowledgement, Terms and Privacy Notice.
- MQL5 licence helper now sends actual MT5 account mode and matches the server validation contract.
- Python regression tests for security contracts and MQL5 source/download parity.

## 8. Release blockers that must remain visible

1. Latest branch CI must pass after all current commits.
2. A Vercel preview must be created for the exact final commit and tested; previous deployment quota limits prevented that.
3. Supabase leaked-password protection remains disabled and must be enabled where the plan supports it.
4. Configure and test production SMTP, password recovery template, /owner redirect allowlist and MFA/step-up policy.
5. Confirm Paystack merchant verification, refund/cancellation language, live-payment gate and webhook endpoint in the merchant dashboard.
6. Confirm market-data commercial rights and complete the operator/legal/privacy disclosures.
7. Test customer purchase, webhook replay, exact-amount mismatch, failed DB write, duplicate seat, over-capacity seat, demo-on-live rejection, rebind before/after 72 hours, owner revocation and MT5 token revocation in a preview/staging environment.
8. Compile the MQL5 helper and consuming EA in MetaEditor on Windows, then run MT5 Strategy Tester and demo forward tests.
9. Do not merge or promote until exact-head runtime and security gates pass.

**Engineering standard:** Fail closed, preserve evidence, avoid unsupported claims, and never describe an untested path as production-ready or error-free.
