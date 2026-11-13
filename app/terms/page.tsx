import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';

export const metadata = {
  title: 'Terms of Service & Risk Disclosure | MacroLync & AlgoLync',
  description: 'Institutional terms of service, high-risk capital warnings, software licensing agreements, and risk disclosures for MacroLync and AlgoLync.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8 lg:py-12">
        {/* Navigation & Header */}
        <div className="border-b border-white/[0.08] pb-7">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
            >
              <span>←</span> Back to Terminal
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-amber-300">
            <BrandGlyph name="shield-alert" size={14} className="text-amber-300" />
            REGULATORY DISCLOSURE &amp; LEGAL GOVERNANCE
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Terms of Service &amp; Risk Disclosure
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Effective Date: November 2026. Please review these operational rules and statutory risk warnings before utilizing our platform or purchasing software licenses.
          </p>
        </div>

        {/* Content Sections */}
        <div className="mt-8 space-y-8 text-xs leading-6 text-slate-300">
          {/* Section 1 */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-amber-300">
              1. High Risk Capital &amp; Leveraged Trading Warning
            </h2>
            <p className="mt-3">
              Trading spot foreign exchange (Forex), currency futures, and Contracts for Difference (CFDs) carries an extremely high level of financial risk and is not suitable for all investors. Leveraged trading can result in the rapid loss of your entire deposited capital.
            </p>
            <p className="mt-2">
              Before running any Expert Advisor (EA) or executing trades based on MacroLync quantitative signals, you must independently evaluate whether trading is appropriate in light of your financial condition, level of experience, and risk tolerance. You should never trade with money you cannot afford to lose.
            </p>
          </section>

          {/* Section 2 */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              2. Non-Advisory &amp; Research-Only Disclaimer
            </h2>
            <p className="mt-3">
              MacroLync and AlgoLync operate exclusively as quantitative software vendors and macroeconomic research intelligence providers. None of the content, currency bias scores, regime indicators, or API endpoints constitute personal financial, tax, or investment advice.
            </p>
            <p className="mt-2">
              All trading decisions remain solely at your own discretion and risk. MacroLync and AlgoLync do not act as a broker, custodian, portfolio manager, or registered financial adviser.
            </p>
          </section>

          {/* Section 3 */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              3. Algorithmic Software Licensing &amp; Activation
            </h2>
            <p className="mt-3">
              AlgoLync strategies (including Eridam Nexus Adaptive Pro and Velocity Vault) are delivered under a proprietary one-time software license:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1.5 text-slate-300">
              <li>Each purchase grants a non-exclusive, non-transferable, single-operator lifetime license bound to your designated MetaTrader 5 account.</li>
              <li>You may not redistribute, resell, sublicense, decompile, reverse-engineer, or publicly share the binary files (.ex5) or client include files (.mqh).</li>
              <li>Attempting to bypass cloud license validation or broadcast proprietary signals will result in immediate termination of the license key without compensation.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              4. Execution Risks &amp; Third-Party Broker Dependencies
            </h2>
            <p className="mt-3">
              Automated execution depends on external technical factors beyond our control, including broker execution speed, server slippage, spread widening during news releases, VPS uptime, and Internet connectivity.
            </p>
            <p className="mt-2">
              MacroLync and AlgoLync are not liable for any losses, margin calls, or missed trades caused by broker server outages, data feed latency, or network disconnects.
            </p>
          </section>

          {/* Section 5 */}
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              5. Refund Policy
            </h2>
            <p className="mt-3">
              Due to the nature of electronic digital products and instant server key binding, all software license sales are final and non-refundable once an activation key has been verified against an MT5 account.
            </p>
            <p className="mt-2">
              Our trading desk provides complete setup assistance and onboarding over WhatsApp to ensure your system is properly configured.
            </p>
          </section>

          {/* Section 6 - Privacy */}
          <section id="privacy" className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              6. Privacy Policy &amp; Account Data
            </h2>
            <p className="mt-3">
              We collect minimal operational data necessary to service your license: your account login number, generated license key, and heartbeat telemetry. We never collect or store your broker trading account password or personal trading credentials.
            </p>
          </section>

          {/* Desk Contact */}
          <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
            <h2 className="text-base font-semibold text-emerald-300">
              7. Operator &amp; Compliance Inquiries
            </h2>
            <p className="mt-2 text-slate-300">
              For licensing transfers, account rebinding, or corporate institutional inquiries, contact our desk directly:
            </p>
            <div className="mt-3 font-mono text-xs text-slate-200">
              <div>Desk Contact: WhatsApp +234 803 721 2445</div>
              <div>Platform: MacroLync &amp; AlgoLync</div>
              <div>Operating Jurisdiction: Federal Republic of Nigeria &amp; International Private E-Commerce</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
