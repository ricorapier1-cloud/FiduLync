import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';

export const metadata = {
  title: 'Privacy & Data Governance Policy | MacroLync',
  description: 'Data protection principles, investor confidentiality, and local storage research governance for MacroLync.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 pb-36">
      <div className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8 lg:py-12">
        <div className="border-b border-white/[0.08] pb-7">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
            >
              <span>←</span> Back to Terminal
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-cyan-300">
            <BrandGlyph name="shield" size={14} className="text-cyan-300" />
            CONFIDENTIALITY &amp; RESEARCH DATA GOVERNANCE
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Privacy &amp; Data Governance Policy
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Effective Date: November 2026. This policy outlines how MacroLync processes information, protects researcher confidentiality, and isolates macroeconomic research from external trade execution.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-xs leading-6 text-slate-300">
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-cyan-300">
              1. Non-Custodial Architecture &amp; Zero Broker Credential Access
            </h2>
            <p className="mt-3">
              MacroLync operates strictly as an analytical intelligence and research platform. We never collect, request, or store trading passwords, broker account credentials, withdrawal authorization codes, or private identity banking documents.
            </p>
            <p className="mt-2 text-slate-400">
              External Expert Advisors execute locally inside your own MetaTrader 5 (MT5) client terminal or virtual private server (VPS). The external connection to MacroLync is strictly a read-only HTTP GET query requesting macroeconomic context.
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-cyan-300">
              2. Private Read-Only MT5 Account Data
            </h2>
            <p className="mt-3">
              The optional Portfolio &amp; Accounts connector stores broker-reported account snapshots, open-position data, synchronized deal history, broker quotes and closed OHLCV candles in private Supabase tables protected by row-level security and server-side access tokens.
            </p>
            <p className="mt-2 text-slate-400">
              Only the data required for account analytics is transmitted from the user&apos;s MT5 terminal. Broker master/investor passwords, withdrawal credentials and order-control permissions are never collected. The publisher cannot place, modify or close trades. The browser read token is held in session storage for the current tab.
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-cyan-300">
              3. Telemetry &amp; Server Logging
            </h2>
            <p className="mt-3">
              Web server logs maintain minimal standard HTTP access records (including IP address, requested URL, user-agent, and response latency) strictly for DDoS mitigation, rate-limiting enforcement, and service stability diagnostics.
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-cyan-300">
              4. Inquiries &amp; Governance Contact
            </h2>
            <p className="mt-3">
              Inquiries regarding data governance, research compliance, and system architecture may be directed to our research desk at <span className="font-mono text-cyan-300">fidulync@gmail.com</span> or via WhatsApp at <span className="font-mono text-cyan-300">+234 803 721 2445</span>.
            </p>
          </section>
        </div>

        <div className="mt-10 border-t border-white/[0.08] pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>&copy; 2026 MacroLync Institutional Research Center</div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
            <Link href="/faq" className="hover:text-slate-300">FAQ</Link>
            <Link href="/notebook" className="hover:text-slate-300">Notebook</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
