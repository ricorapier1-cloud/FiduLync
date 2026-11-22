import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FiduLync Privacy Notice',
  description: 'Privacy and data handling for the FiduLync MacroLync research terminal and read-only MT5 context API.',
};

const sections = [
  ['1. Operator and scope', 'FiduLync / MacroLync is operated by AkinsootoFx as a private research platform. It is not a customer SaaS, payment service, escrow service, EA marketplace or subscription product. The public research pages do not require browser sign-in.'],
  ['2. Data processed by the research terminal', 'The application retrieves public and provider-authorized macroeconomic observations, central-bank publications, economic-calendar events, cross-asset context and positioning information. Provider data may include source identifiers, observation periods, release timestamps, retrieval timestamps and revision/vintage metadata.'],
  ['3. Technical and security metadata', 'The service may process server logs, request timestamps, rate-limit counters, IP-derived rate-limit hashes, installation-token hashes and API error diagnostics to protect privileged endpoints and maintain service reliability. Raw installation tokens and provider API keys must not be written to client code or ordinary logs.'],
  ['4. MT5 installation and broker credentials', 'The read-only macro context API uses a per-installation bearer token stored as a cryptographic hash for lookup. FiduLync does not require or collect broker passwords, investor passwords, trading passwords or remote-access credentials. The EA connects to the broker locally through MetaTrader 5.'],
  ['5. Research notebook storage', 'The browser Research Notebook stores entries in the local browser storage of the device/profile where they are created. Those entries are not automatically synchronized to Supabase or another cloud backup. Clearing browser data or changing devices may remove access to those local notes. Do not store passwords, tokens or sensitive account credentials in the notebook.'],
  ['6. Service providers and data sources', 'Infrastructure providers may include Vercel for hosting, Supabase for PostgreSQL and server-side data access, and Redis-compatible infrastructure for caching/rate limiting. Market-data and macro providers are subject to their own privacy policies, licenses, rate limits and data-use terms. The operator should review and document applicable processor terms and data-transfer safeguards.'],
  ['7. Sharing and sale', 'FiduLync does not intend to sell personal information or redistribute third-party market data. Provider observations are used only within applicable source terms. Access to privileged database operations and installation provisioning is restricted to server-side authorized processes.'],
  ['8. Retention and audit history', 'Security events, installation metadata, source provenance and research records may be retained for operational security, reproducibility and audit. Historical financial or legacy commerce records are retained for audit and are not active customer workflows. Retention periods and deletion requests must be assessed against applicable legal and accounting duties.'],
  ['9. Security', 'Supabase secret/service-role keys and provider API keys remain server-side. Sensitive APIs require server authentication, validation and rate limiting. No internet-connected service can guarantee absolute security. Protect your devices and never share installation tokens or API keys in chat, screenshots or public repositories.'],
  ['10. Contact and updates', 'For privacy questions, contact the platform operator through the contact channel published by the rights holder. This notice may be updated when the application, connected providers or applicable legal requirements change.'],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-24 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PRIVACY</p>
        <h1 className="mt-3 text-3xl font-semibold">Privacy notice</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">How research observations, security metadata and the read-only MT5 context bridge are handled. Updated 22 November 2026.</p>
      </header>
      <div className="space-y-4">
        {sections.map(([title, body]) => (
          <section key={title} className="rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="mt-3 text-xs leading-6 text-slate-400">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-500">For research and data-use boundaries, see <Link href="/terms" className="text-emerald-300 underline">Research &amp; Risk Policy</Link>.</p>
    </div>
  );
}
