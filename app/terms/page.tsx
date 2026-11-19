import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Personal Use, Data Provenance & Trading Risk',
  description: 'Personal-use scope, data-source terms and risk disclosures for FiduLync Personal Quant Edition.',
};

const sections = [
  {
    title: '1. Personal-use scope',
    body: 'FiduLync Personal Quant Edition is a private, single-operator research and MT5 EA-supervision workspace. It is not a customer SaaS, broker, investment adviser, managed account, copy-trading service, marketplace, escrow service or payment product. Customer registration, checkout, subscriptions and commercial EA licensing are not part of this edition.',
  },
  {
    title: '2. Research, not investment advice',
    body: 'Macro observations, technical indicators, quantitative scores, currency strength, correlations, market regimes, event-risk summaries and model outputs are research tools. They are not recommendations, solicitations or promises to buy or sell any financial instrument. A confluence score is not a calibrated probability unless separate out-of-sample calibration evidence is explicitly supplied.',
  },
  {
    title: '3. Market-data provenance and freshness',
    body: 'Every observation should retain its provider, source timestamp, retrieval timestamp, symbol, timeframe and broker/terminal identity where applicable. Reference rates, delayed feeds, historical bars and cached observations must never be described as real-time executable broker prices. Missing, stale, revised, incomplete or contradictory inputs must be labelled unavailable/degraded and excluded from affected decisions.',
  },
  {
    title: '4. Provider terms and attribution',
    body: 'The owner is responsible for using each API and dataset only within its applicable personal-use plan, rate limits, caching rules, exchange entitlements and copyright restrictions. FRED data is used only for personal, non-commercial research with required attribution and series-level copyright notices preserved. FRED-derived observations are not sent to external AI prompts. CFTC positioning is weekly and is not an intraday flow measure. Frankfurter rates are public reference rates, not live trading quotes. Third-party data is not redistributed.',
  },
  {
    title: '5. AI-generated commentary',
    body: 'Optional AI commentary is explanatory only. It must use supplied, permitted facts, identify unavailable context, and never invent prices, events, source observations or certainty. AI output has no execution authority. When FRED observations are present, they are kept out of external AI prompts and local deterministic analysis is used instead.',
  },
  {
    title: '6. Technical research and backtesting',
    body: 'Indicators and backtests depend on source quality, correct timestamps, broker specifications and realistic costs. Avoid look-ahead bias, survivorship bias, data leakage, overfitting and unrepresentative market regimes. Separate in-sample, validation and untouched out-of-sample data. Include spread, commission, swap, slippage, latency, rejected orders and stressed-market conditions. Simulated/backtested results are not live verified performance and do not predict future results.',
  },
  {
    title: '7. MT5 connectivity and EA supervision',
    body: 'The private MT5 connector is designed for authenticated data publishing and research/risk supervision. The central application does not place, modify or close broker orders. EA approval responses are not guarantees; the EA must independently validate prices, contract specifications, margin, stop-loss, take-profit, spread, slippage, news and account-level risk immediately before any order. Never share broker passwords. Publisher tokens are secrets and must be stored privately and revoked if exposed.',
  },
  {
    title: '8. Capital and automated-trading risk',
    body: 'Forex, CFDs, futures, precious metals and leveraged products carry substantial risk. Leverage magnifies losses; gaps, spread expansion, slippage, low liquidity, rejected orders, broker outages, VPS/network failure and software defects can cause losses beyond expectations. Always compile and test MQL5 code in MetaEditor, run Strategy Tester and forward-test on a demo account before considering live use. Never trade money you cannot afford to lose.',
  },
  {
    title: '9. Security and personal data',
    body: 'Access is restricted to the configured owner identity. Server-side secrets, service-role keys, API keys and MT5 publisher tokens must never be placed in client code, public repositories or screenshots. The platform should collect only the account telemetry needed for the owner’s own research and risk supervision. No public customer accounts are intended.',
  },
  {
    title: '10. No warranty or performance certification',
    body: 'The application and provider feeds are supplied as research tooling. Availability, accuracy, completeness, timeliness and fitness for a particular purpose are not guaranteed. A successful software build or API response does not certify a strategy, broker execution path, EA or live-trading system as profitable or safe.',
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-44 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACROLYNC</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PERSONAL QUANT EDITION</p>
        <h1 className="mt-3 text-3xl font-semibold">Personal-use & risk policy</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Private research, source attribution, data integrity, MT5 supervision and capital-risk boundaries.</p>
      </header>
      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold text-white">{section.title}</h2>
            <p className="mt-3 text-xs leading-6 text-slate-400">{section.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-8 text-[10px] leading-5 text-slate-500">This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.</p>
    </main>
  );
}
