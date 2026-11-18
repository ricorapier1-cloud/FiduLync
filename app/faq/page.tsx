import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & Frequently Asked Questions',
  description: 'Help for FiduLync Personal Quant, the manual risk planner and MT5 research bridge.',
};

const questions = [
  {
    q: 'What is FiduLync Personal Quant?',
    a: 'A private quantitative research and risk-supervision workspace for the owner\'s own G10 FX and XAUUSD trading. It combines macro context, technical research, manual risk planning and MT5 EA telemetry.',
  },
  {
    q: 'Does FiduLync place or manage broker orders?',
    a: 'No. The current product is a research and supervisory layer. It does not submit, modify or close broker orders. Any future EA approval response will be a short-lived risk permission only; the EA must independently recheck the quote and keep local protections active.',
  },
  {
    q: 'Can I plan a manual trade without a laptop?',
    a: 'Yes. Open Risk Planner, enter your account equity, intended entry, stop and target, then enter the exact tick size, tick value and volume limits from your broker. The calculator rejects a minimum lot that exceeds your chosen risk budget. It is an estimate, not a trade recommendation.',
  },
  {
    q: 'Why must I enter broker symbol specifications?',
    a: 'Tick size, tick value, contract size, minimum volume and volume step can differ by broker and symbol. FiduLync must not guess those values, especially for gold. Verify them in your own MT5 terminal before relying on any sizing calculation.',
  },
  {
    q: 'How do I connect MetaTrader 5?',
    a: 'When you have access to a Windows MT5 terminal, compile the EA in MetaEditor, install the required MQL5 include, allow https://fidulync.vercel.app under Tools → Options → Expert Advisors → Allow WebRequest, and register the terminal through the restricted Owner Console. Start with shadow or demo testing.',
  },
  {
    q: 'Why does Performance Lab show no win rate or profit factor?',
    a: 'Because verified, account-isolated closed-trade history has not yet been connected and validated for this personal workspace. Blank metrics are intentional. The application will not display invented performance statistics.',
  },
  {
    q: 'Does a high confluence score mean a profitable trade?',
    a: 'No. A confluence score is a research summary, not a calibrated probability or promise of profit. Any model must pass cost-aware walk-forward testing, out-of-sample validation and demo forward testing before it can be considered for a tightly capped live pilot.',
  },
  {
    q: 'Does FiduLync support silver (XAGUSD)?',
    a: 'Not in the confirmed initial scope. The current confirmed instruments are G10 FX and XAUUSD. XAGUSD remains disabled until its data mapping and broker-specific contract and tick-value calculations are explicitly approved and tested.',
  },
  {
    q: 'Do I need to share my broker password?',
    a: 'Never. FiduLync does not need your broker password. Use only the restricted owner sign-in and per-installation connector credentials. Do not share one-time codes, API keys or MT5 publisher tokens in chat or screenshots.',
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-36 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / HELP DESK</p>
        <h1 className="mt-3 text-3xl font-semibold">Personal Quant — Help</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Practical guidance for research, risk planning and future MT5 onboarding.</p>
      </header>
      <div className="space-y-3">
        {questions.map((item) => (
          <details key={item.q} className="group rounded-xl border border-white/10 bg-[#0c1118] p-4 open:border-emerald-300/25">
            <summary className="cursor-pointer list-none pr-6 text-sm font-medium text-white marker:hidden">{item.q}</summary>
            <p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-400">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-8 text-xs text-slate-500">For account access or technical issues, use the support link in the application. Never send passwords or secret keys.</p>
    </main>
  );
}
