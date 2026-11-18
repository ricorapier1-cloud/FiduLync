import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms, Privacy & Risk Disclosure',
  description: 'Personal-use terms and trading risk disclosure for FiduLync Personal Quant.',
};

const sections = [
  {
    title: '1. Personal-use scope',
    body: 'FiduLync Personal Quant is provided for the owner\'s own research, risk planning and supervision of the owner\'s MetaTrader 5 installations. The current confirmed instrument scope is G10 foreign exchange pairs and XAUUSD. XAGUSD is not enabled in the initial scope. The application is not currently offered as a customer subscription, EA marketplace, escrow service or signal-selling service.',
  },
  {
    title: '2. No brokerage or investment advice',
    body: 'FiduLync is software for quantitative research and risk analysis. It is not a broker, dealer, custodian, portfolio manager or investment adviser. Market commentary, model outputs, technical indicators, confluence scores and risk calculations are informational only and are not personalized investment advice or instructions to trade.',
  },
  {
    title: '3. Trading risk and no performance guarantee',
    body: 'Foreign exchange and precious-metals trading involve substantial risk, including leverage, slippage, gaps, spread widening, rejected orders, financing costs, outages and loss of capital. Backtests and historical metrics do not guarantee future results. No win rate, return, profit factor or drawdown outcome is promised. Use demo and shadow testing before any live deployment.',
  },
  {
    title: '4. EA supervision and execution boundary',
    body: 'The intended architecture separates research signals from execution permission. FiduLync does not directly place, modify or close broker orders. Any future supervisory approval is not a guarantee that an order will be safe or profitable. The EA remains responsible for rechecking live quotes, broker rules, volume limits and account state, and for maintaining local risk controls and broker-side stop-loss protection.',
  },
  {
    title: '5. Data quality and external providers',
    body: 'Market data may be supplied by a connected MT5 terminal or configured third-party providers. Foreign exchange has no single consolidated global tape; broker quotes are the execution reference for that broker account. Provider data may be delayed, incomplete, revised, rate-limited or unavailable. The application must identify reference, delayed, stale and unavailable data and must not treat those states as live execution data.',
  },
  {
    title: '6. Security and account credentials',
    body: 'Never provide FiduLync with your broker password, remote desktop password or one-time authentication code. Connector tokens and API keys must be kept secret and revocable. Use only the restricted owner identity and installation-specific credentials. You are responsible for securing your device, email account, MT5 terminal and broker account.',
  },
  {
    title: '7. Personal data and telemetry',
    body: 'The application may process owner account identifiers, terminal installation identifiers, market data, EA heartbeat telemetry and trade records for the purpose of operating the personal research workspace. Access to privileged owner diagnostics must be authenticated. Credentials and provider API keys must not be exposed in browser code, public logs or user-visible diagnostics. Historical records should not be deleted as part of the product conversion.',
  },
  {
    title: '8. Availability and technical limitations',
    body: 'The service depends on hosting, database, network, broker terminal and external data-provider availability. API quotas, data licensing terms, broker rules and provider restrictions continue to apply. Personal use does not grant permission to redistribute third-party data. Some functions require a Windows MT5 terminal and MetaEditor and cannot be fully verified from a mobile browser.',
  },
  {
    title: '9. Changes and acceptance',
    body: 'These terms describe the current personal-use product boundary and may be updated as the application is implemented and tested. Do not enable live trading based solely on the presence of a feature or a successful software build. A production release requires independent security, data, broker and demo validation.',
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-36 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC PERSONAL QUANT / POLICY</p>
        <h1 className="mt-3 text-3xl font-semibold">Terms &amp; Risk Disclosure</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">Personal-use product scope, data handling and trading-risk boundaries. Effective date: 18 November 2026.</p>
      </header>
      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold text-white">{section.title}</h2>
            <p className="mt-3 text-xs leading-6 text-slate-400">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-[10px] leading-5 text-slate-500">This is an operational disclosure for the personal workspace, not a substitute for legal advice or any provider&apos;s data licence.</p>
    </main>
  );
}
