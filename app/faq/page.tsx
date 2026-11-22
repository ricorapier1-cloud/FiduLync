import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MacroLync Help & Frequently Asked Questions',
  description: 'Help for FiduLync macroeconomic and fundamental intelligence research.',
};

const questions = [
  {
    q: 'What is FiduLync / MacroLync?',
    a: 'A private macroeconomic, monetary-policy, cross-asset and fundamental FX research platform. It studies what may drive currencies and why. It is not a public EA marketplace, broker, signal service or trading terminal.',
  },
  {
    q: 'Who is responsible for technical analysis and trading?',
    a: 'Your independent MT5 Expert Advisors. Each EA owns its indicators, price action, entries, exits, lot sizing, stop-loss, take-profit, broker checks, order execution, open-position management and emergency protections.',
  },
  {
    q: 'Does FiduLync place, modify or close broker orders?',
    a: 'No. FiduLync never submits, modifies or closes broker orders. Its MT5 interface is a read-only fundamental macro-context feed. Each EA must continue to protect itself if FiduLync, the network or a VPS connection becomes unavailable.',
  },
  {
    q: 'Does every value update in real time?',
    a: 'No. Economic data is published on official release schedules, COT is weekly, and some cross-asset series update daily. A source may be the latest published observation without being a live quote. The interface must show source and observation timestamps and must never label a reference or stale value as live.',
  },
  {
    q: 'What does policy minus inflation mean?',
    a: 'It is a simplified ex-post real-rate proxy calculated from a policy rate and a published inflation measure. It is not a matched-maturity market real yield, an OIS curve or an implied future policy path. Those require more specific market data.',
  },
  {
    q: 'Why might a currency bias say INSUFFICIENT EVIDENCE?',
    a: 'Because one or more required sources may be missing, stale, unlicensed, delayed, contradictory or not point-in-time safe. FiduLync must abstain rather than manufacture a directional conclusion.',
  },
  {
    q: 'Does the calendar guarantee that every event is covered?',
    a: 'No. Coverage depends on the connected calendar provider, its license, supported currencies, publication timestamps and freshness. If a verified calendar is unavailable, the MT5 macro bridge treats event-risk context conservatively and each EA must enforce its own local event rules.',
  },
  {
    q: 'How do I connect an MT5 EA?',
    a: 'When you have a Windows MT5 terminal, copy MacroContextBridge.mqh into MQL5/Include/FiduLync, allow WebRequest for the exact HTTPS FiduLync hostname, and configure a securely provisioned installation token. The bridge calls GET /api/v1/macro-context?symbol=EURUSD with a Bearer token and UTC X-MT5-Timestamp. Start on demo and verify the response before using it.',
  },
  {
    q: 'Where do I get the installation token?',
    a: 'Token provisioning is a privileged server-side operation. There is deliberately no browser Owner Console or public token-creation form. Do not send tokens, API keys, passwords or broker credentials in chat or screenshots.',
  },
  {
    q: 'Do I need to share my broker password?',
    a: 'Never. FiduLync does not need your broker password, investor password or trading credentials. Your EA connects to the broker locally through MT5.',
  },
  {
    q: 'Why are some advanced institutional datasets unavailable?',
    a: 'OIS/futures policy repricing, forwards, options-implied volatility, dealer positioning and cross-currency basis often require specialized licensed feeds. FiduLync labels them unconfigured until an authorized, tested source is connected.',
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-24 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / MACROLYNC HELP</p>
        <h1 className="mt-3 text-3xl font-semibold">Fundamental intelligence — Help</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Practical guidance for data provenance, macro research and the read-only MT5 context bridge.</p>
      </header>
      <div className="space-y-3">
        {questions.map((item) => (
          <details key={item.q} className="group rounded-xl border border-white/10 bg-[#0c1118] p-4 open:border-emerald-300/25">
            <summary className="cursor-pointer list-none pr-6 text-sm font-medium text-white marker:hidden">{item.q}</summary>
            <p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-400">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
