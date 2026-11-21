# FiduLync Institutional Platform Hardening Standard

**Scope:** FiduLync core, MacroLync research and AlgoLync licensing/storefront.  
**Release posture:** fail closed; private owner workspace and paid customer flows remain separate.

## 1. Architecture and delivery controls

- Next.js App Router, React 19 and Tailwind CSS must pass TypeScript, ESLint with zero warnings, production build, quantitative governance tests and security-contract tests.
- CI must be tied to the exact commit under review. A green result from an earlier commit does not approve a newer head.
- Every public API that reads or mutates entitlements must validate input types, bound request size, return no-store cache headers for sensitive responses and use a distributed IP sliding-window limiter.
- The distributed limiter must fail closed: missing trusted client IP, missing Supabase credentials, malformed RPC response, timeout or database error returns 503; exhausted windows return 429. Never fall back to per-instance memory in production.
- Supabase persistence errors must be surfaced as failure. No optimistic success, local fallback entitlement, fabricated data or permissive default.
- Database mutations with financial or entitlement consequences must be transactional, idempotent and protected by database constraints/RPCs.

## 2. Administrator control plane

- Normal owner authentication is email + password. Password recovery is a separate recovery-only flow, never the routine login method.
- The owner identity is one explicitly configured OWNER_EMAIL (with the documented primary owner fallback only for deployments that have not set the variable). Support and customer mailboxes are not administrators.
- Every privileged server request independently validates the bearer session against Supabase Auth, checks the exact administrator email and requires confirmed email. Browser state, hidden buttons and client-supplied roles are never authorization.
- Owner routes use distributed rate limits and no-store responses. Connector tokens are generated once, stored as hashes, scoped to an installation, and revocable.
- Administrative actions must write an attributable audit event. If an audit record is required for an action and cannot be committed, do not report success; compensate/revoke where the action can be safely reversed.
- Independent model reviewers remain a separate, explicitly configured Supabase user-ID allowlist. A reviewer is not implicitly an owner.

## 3. Navigation and mobile layout

- /store, /account, /owner, /privacy, /terms, /faq and /guide expose a clear Back to Terminal link.
- Shared mobile page-frame clearance must account for the fixed bottom tab bar, floating support control and device safe-area inset. Tables use horizontal scrolling; checkout and destructive actions remain reachable above the fixed navigation.
- Avoid route-specific arbitrary padding that conflicts with the shared shell; verify at narrow phone widths and with browser zoom.

## 4. AlgoLync commercial licensing

- Monthly and one-time purchases use Paystack-hosted checkout. The server calculates the amount from the active database product catalogue; the browser never sets an authoritative price.
- A licence is issued only after Paystack server-side verification confirms success, exact reference, currency, amount, product slug and plan metadata.
- Webhook HMAC signature verification uses constant-time comparison. Browser redirects are not payment proof.
- Payment-reference uniqueness and an atomic provisioning RPC make webhook/callback retries idempotent. A reference cannot be reused for a different email, product, tier or currency.
- The standard paid entitlement is one LIVE and two DEMO seats unless the active product record explicitly configures otherwise. Seat counts are read from server-side entitlement records, not UI constants.
- Seat binding is transactional and database-enforced: an MT5 login cannot occupy multiple seats; account type must match; only free entitled slots can be consumed; replacement requires the previous account to be bound to that licence; a 72-hour rebind cooldown is enforced in the database.
- Monthly access expires according to the issued term and requires a verified renewal payment. One-time access is non-recurring and grants only the stated product/version entitlement. Do not imply automatic renewal or unlimited upgrades unless explicitly configured and consented to.
- Demo licences remain DEMO-only and time-limited. Demo provisioning is rate-limited and must not mint paid entitlements.

## 5. Quantitative performance and statutory disclosures

- Simulated/backtest metrics, user-reported closed-trade ledgers and independently reconciled live broker telemetry are separate evidence classes.
- A result may be called live verified only when it is attributable to an authenticated installation/account, has complete closed-trade evidence, reconciled account currency and execution costs, a defined period/sample size, and a documented verification methodology.
- Missing evidence displays Not available; it must never be replaced with sample or inferred performance.
- Storefront checkout displays material leveraged-trading, EA automation, backtest limitations, payment duration, seat terms, privacy notice and links to full terms before payment. The customer must affirmatively acknowledge the disclosure.
- Terms/privacy text is an operational baseline, not a legal opinion. Before commercial sales in any jurisdiction, obtain qualified legal, tax, privacy and financial-services review; complete the operator identity/contact, governing law, cancellation/refund and complaint details required by law.

## 6. Release gates

1. Exact-head CI green: TypeScript, zero-warning lint, production build, security contracts and quant tests.
2. Exact-head Vercel preview deployed and smoke-tested for owner sign-in/denial, customer checkout initialization, webhook verification, licence issuance idempotency, seat limits/cooldown and all navigation.
3. Supabase migration and RPC grants verified in the target project; RLS and service-role boundaries reviewed.
4. Paystack test-mode end-to-end transaction and webhook replay verified before any live key is enabled.
5. Legal and merchant onboarding complete before live commercial payments.
6. MT5 MetaEditor compilation, Strategy Tester and demo forward test complete before any EA is considered live-ready.
7. Production promotion only from the tested commit. Do not merge or promote on stale preview evidence.

No build, security audit or test suite can guarantee zero defects, safe trading outcomes or profitability. Production readiness is a set of verified release gates, not a claim of perfection.
