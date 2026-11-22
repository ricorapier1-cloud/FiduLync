import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';

export const metadata = {
  title: 'Terms of Service & Research Risk Disclosure | MacroLync',
  description: 'Institutional terms of service, market risk warnings, and non-advisory research governance for MacroLync.',
};

export default function TermsPage() {
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
          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-amber-300">
            <BrandGlyph name="shield-alert" size={14} className="text-amber-300" />
            REGULATORY DISCLOSURE &amp; RESEARCH GOVERNANCE
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Terms of Service &amp; Risk Disclosure
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Effective Date: November 2026. Please review these operational rules and statutory risk warnings before utilizing the MacroLync research terminal or connecting external execution systems.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-xs leading-6 text-slate-300">
          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-amber-300">
              1. High Risk Capital &amp; Leveraged Financial Markets Warning
            </h2>
            <p className="mt-3">
              Trading spot foreign exchange (Forex), currency futures, and Contracts for Difference (CFDs) carries an extremely high level of financial risk and may not be suitable for all investors. High leverage can amplify losses as well as gains, potentially resulting in the rapid loss of your entire deposited capital.
            </p>
            <p className="mt-2 text-slate-400">
              Before executing trades or configuring automated Expert Advisors based on MacroLync quantitative models, you should independently evaluate whether leveraged trading aligns with your investment objectives, financial resources, and risk tolerance. You should never trade with capital you cannot afford to lose.
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              2. Non-Advisory &amp; Pure Research Disclaimer
            </h2>
            <p className="mt-3">
              MacroLync operates strictly as a quantitative software intelligence provider and macroeconomic research platform. None of the materials, currency bias scores, regime classifications, or API endpoints constitute personal financial, tax, or investment advice.
            </p>
            <p className="mt-2 text-slate-400">
              All trading execution decisions remain solely at your own discretion and risk. MacroLync does not act as a broker, custodian, portfolio manager, or registered investment adviser.
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              3. Independent Technical Execution
            </h2>
            <p className="mt-3">
              Technical chart analysis, entry/exit criteria, order routing, lot sizing, and active position management belong strictly inside individual MT5 Expert Advisors—NOT inside MacroLync. MacroLync exposes a read-only macro context API (`/api/v1/macro-context`) for external EAs, but assumes no responsibility for order execution or broker latency.
            </p>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-6">
            <h2 className="text-base font-semibold text-slate-100">
              4. Data Provenance &amp; Revisions
            </h2>
            <p className="mt-3">
              Official macroeconomic statistics (such as GDP and Non-Farm Payrolls) are subject to periodic revisions by government statistical bureaus. MacroLync utilizes point-in-time publication records to maintain vintage integrity, but does not warrant that provider feeds will be completely uninterrupted or free from preliminary estimation errors.
            </p>
          </section>

          <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
            <h2 className="text-base font-semibold text-emerald-300">
              5. Operator &amp; Research Compliance Contact
            </h2>
            <p className="mt-2 text-slate-300">
              For research inquiries, data verification, or institutional queries, contact our desk directly:
            </p>
            <div className="mt-3 font-mono text-xs text-slate-200 space-y-1">
              <div>Research Desk: WhatsApp +234 803 721 2445</div>
              <div>Email: fidulync@gmail.com</div>
              <div>Platform: MacroLync Institutional Macro Intelligence Center</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
