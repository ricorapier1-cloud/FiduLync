import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Notice',
  description: 'How FiduLync, MacroLync and AlgoLync process account, licensing and telemetry data.',
};

const sections = [
  ['1. Data controller and contact', 'FiduLync is operated by AkinsootoFx. Before commercial launch, the operator must publish its full legal entity name, registered/business address, privacy contact and applicable data-protection contact details on this page.'],
  ['2. Data we process', 'Depending on the features used, we may process customer email addresses, payment references, licence identifiers, MT5 account login numbers, broker/server labels, EA version information, terminal heartbeat telemetry, account balance/equity and position snapshots, execution-quality events, closed-trade records, support correspondence and basic security/network metadata such as IP-derived rate-limit hashes. Do not submit broker passwords or remote-access credentials.'],
  ['3. Payment information', 'Checkout is handed off to Paystack or another named payment processor. Payment-card and bank credentials are entered on the processor-hosted payment page. FiduLync is designed to retain the payment reference, amount, currency, status, customer email and licence entitlement details needed for reconciliation; it should not collect or store full card numbers, CVV values, PINs or online-banking passwords.'],
  ['4. Purposes and legal bases', 'Data is used to authenticate owner/customer access, issue and validate licences, enforce account-seat limits, process payment confirmations, provide customer support, operate MT5 telemetry and research features, prevent fraud and abuse, secure the service, and meet applicable legal/accounting obligations. The final legal basis for each purpose must be documented by the operator under the laws that apply to the customer.'],
  ['5. Service providers and transfers', 'Data may be processed by Supabase (database/authentication), Vercel (hosting), Paystack (payments), email delivery providers, market-data providers and other infrastructure providers configured by the operator. Those providers may process data in countries outside the customer’s country. The operator must document each processor, its location, transfer safeguards and retention terms before commercial launch.'],
  ['6. Sharing and sale', 'FiduLync does not intend to sell personal information. Data is shared only with service providers needed to operate the service, where required by law, to protect users or the platform, or with a recipient the user has expressly authorized. Provider access should be limited to the minimum necessary.'],
  ['7. Security', 'The platform uses server-side authorization, database access controls, rate limiting and restricted service credentials. No internet-connected service can guarantee absolute security. Users must protect passwords, email accounts, licence keys, MT5 publisher tokens and devices. If a credential is exposed, revoke or rotate it promptly and contact the operator.'],
  ['8. Retention', 'Payment and licence records, security audit events and relevant telemetry may be retained for service operation, fraud prevention, dispute handling and legal/accounting requirements. Retention periods should be documented by data category and applied consistently. Users may request deletion where applicable law provides that right, subject to legal retention duties and legitimate security needs.'],
  ['9. User rights', 'Depending on applicable law, users may have rights to access, correct, delete, restrict or object to certain processing, and to receive a copy of their data or withdraw consent where consent is the legal basis. Requests should be sent to the published privacy contact. Identity verification may be required before responding.'],
  ['10. Children', 'The commercial licensing service is not designed for children. Do not create a customer account or submit personal data if you are below the age required to enter a binding contract in your jurisdiction.'],
  ['11. Updates', 'This notice may be updated when the platform, providers or applicable legal requirements change. Material changes should be dated and communicated through the service where required.'],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-44 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PRIVACY</p>
        <h1 className="mt-3 text-3xl font-semibold">Privacy Notice</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">How account, payment, licensing and MT5 telemetry data is processed. Updated 19 November 2026.</p>
        <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100">Operator contact and jurisdiction-specific privacy details must be completed and legally reviewed before public commercial launch.</p>
      </header>
      <div className="space-y-4">
        {sections.map(([title, body]) => (
          <section key={title} className="rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="mt-3 text-xs leading-6 text-slate-400">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-500">For product and trading-risk terms, see <Link href="/terms" className="text-emerald-300 underline">Terms &amp; Risk Disclosure</Link>.</p>
    </main>
  );
}
