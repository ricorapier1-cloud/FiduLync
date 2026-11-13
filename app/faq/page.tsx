import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';

export const metadata = {
  title: 'Frequently Asked Questions | MacroLync & AlgoLync',
  description: 'Answers to common questions about AlgoLync Expert Advisors, one-time lifetime licenses, MT5 setup, and broker compatibility.',
};

const faqs = [
  {
    q: 'How does the AlgoLync one-time purchase license work?',
    a: 'When you purchase an AlgoLync Expert Advisor, you receive an authorized license key granting permanent, lifetime access. Your license is bound directly to your MetaTrader 5 account login number. There are zero recurring monthly charges or hidden renewal fees.',
  },
  {
    q: 'Are AlgoLync Expert Advisors compatible with FTMO and prop firms?',
    a: 'Yes. Our strategy architecture includes built-in proprietary equity shields, hard daily loss circuit breakers, and maximum drawdown caps specifically designed to respect prop-firm pass and funded rules. Additionally, the integrated macro news lockout halts execution during Tier-1 market shocks.',
  },
  {
    q: 'Which MetaTrader 5 brokers are recommended?',
    a: 'AlgoLync systems execute on any broker supporting MetaTrader 5. For optimal execution and minimal slippage, we recommend True ECN or Raw Spread accounts with low latency VPS hosting (such as IC Markets, Pepperstone, or Tickmill) with leverage ranging from 1:30 to 1:500.',
  },
  {
    q: 'How do I install the license helper and signal bridge in MT5?',
    a: 'Installation requires only three straightforward steps:\n1. Download MacroLyncLicense.mqh and MacroLyncBridge.mqh and place them inside your MT5 terminal folder under MQL5/Include/.\n2. In MetaTrader 5, navigate to Tools → Options → Expert Advisors.\n3. Check "Allow WebRequest for listed URL" and add https://fidulync.vercel.app to the list.\nYour EA will automatically verify authorization with our server upon initialization.',
  },
  {
    q: 'Can I transfer my license if my MT5 account number changes?',
    a: 'Yes. If you switch brokers, open a new prop-firm phase, or change your account login, contact our trading desk via WhatsApp (+234 803 721 2445) with your license key and invoice proof. Our team will rebind your key to your new MT5 login.',
  },
  {
    q: 'What is your refund policy for software purchases?',
    a: 'Due to the proprietary nature of algorithmic software and instant cloud key generation, digital licenses are non-refundable once activated. However, our desk provides full technical onboarding support over WhatsApp to guarantee your EA connects and runs cleanly.',
  },
  {
    q: 'Do I need to keep my computer turned on 24/7?',
    a: 'For automated trading execution, we recommend running your MetaTrader 5 terminal on a Virtual Private Server (VPS) located close to your broker\'s trading server (typically London or New York). This ensures uninterrupted execution without relying on home internet or power.',
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8 lg:py-12">
        {/* Navigation & Header */}
        <div className="border-b border-white/[0.08] pb-7">
          <div className="flex items-center gap-2">
            <Link
              href="/store"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
            >
              <span>←</span> Back to AlgoLync Store
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            KNOWLEDGE BASE &amp; TERMINAL GUIDANCE
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Everything you need to know about our quantitative EAs, one-time lifetime licensing, MT5 installation, and prop-firm compliance.
          </p>
        </div>

        {/* FAQ Accordion / Cards */}
        <div className="mt-8 space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-white/[0.08] bg-[#0c1016] p-5 transition hover:border-white/[0.14]"
            >
              <h2 className="flex items-start gap-3 text-base font-semibold text-slate-100">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 font-mono text-[10px] text-emerald-400">
                  {index + 1}
                </span>
                {faq.q}
              </h2>
              <div className="mt-3 text-xs leading-6 text-slate-300 pl-8 whitespace-pre-line">
                {faq.a}
              </div>
            </div>
          ))}
        </div>

        {/* WhatsApp Callout */}
        <div className="mt-10 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.04] p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">Have a specific question?</span>
              <h2 className="mt-1 text-lg font-semibold text-slate-100">Speak directly with our Trading Desk</h2>
              <p className="mt-1 text-xs text-slate-300">
                Ask about EA customization, MT5 setup assistance, or institutional inquiries.
              </p>
            </div>
            <a
              href="https://wa.me/2348037212445?text=Hello%20Desk%2C%20I%20have%20an%20enquiry%20from%20the%20AlgoLync%20FAQ%20page."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 text-xs font-semibold text-[#07120d] transition hover:bg-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
            >
              <BrandGlyph name="mail" size={14} />
              Chat on WhatsApp: +234 803 721 2445
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
