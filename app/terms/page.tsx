import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Macro Research, Data Provenance & Risk Policy',
  description: 'Research-only scope, source provenance, data licensing and MT5 responsibility boundaries for FiduLync MacroLync.',
};

const sections = [
  {
    title: '1. Product scope and responsibility boundary',
    body: 'FiduLync / MacroLync is a private macroeconomic, monetary-policy, cross-asset and fundamental FX research platform. It is not a broker, investment adviser, managed account, copy-trading service, signal vendor, EA marketplace, payment service or customer SaaS. Independent MT5 Expert Advisors own technical analysis, trade decisions, position sizing, order execution and all broker-side risk protection.',
  },
  {
    title: '2. Research, not investment advice or execution',
    body: 'Macro observations, currency context, economic-surprise analysis, policy differentials, cross-asset observations, positioning and scenario assessments are research tools only. They are not recommendations, solicitations, trade instructions, calibrated probabilities or promises of market direction. FiduLync never places, modifies or closes broker orders and does not provide technical entries, stop-losses, take-profits or lot sizes.',
  },
  {
    title: '3. Data provenance, point-in-time integrity and freshness',
    body: 'Observations should retain source/provider, observation period, actual release timestamp, provider update timestamp where available, retrieval timestamp, revision/vintage and freshness state. Historical research must not use a macro value before its publication time. Reference rates, delayed feeds, cached observations and derived estimates must never be described as live executable broker prices. Missing, stale, revised, incomplete or contradictory inputs must be labelled unavailable or insufficient evidence.',
  },
  {
    title: '4. Provider terms and attribution',
    body: 'The operator is responsible for using each API and dataset only within its applicable personal-use terms, rate limits, caching rules, exchange entitlements and copyright restrictions. FRED data must retain required attribution and series-level notices. CFTC positioning is weekly and is not intraday order flow. Frankfurter rates are reference data, not live trading quotes. Third-party market data is not redistributed. A configured API key does not prove that a plan or entitlement is active.',
  },
  {
    title: '5. Advanced market-data limitations',
    body: 'OIS and policy-futures repricing, forwards, options-implied volatility, dealer positioning, cross-currency basis and matched-maturity real-yield curves require suitable authorized sources. They must be labelled unconfigured until a source is connected, its use rights are documented, and its data quality is verified. Do not infer these datasets from unrelated proxies.',
  },
  {
    title: '6. AI-generated commentary',
    body: 'Optional AI commentary is explanatory only. It must use supplied, permitted facts, identify unavailable context and never invent prices, events, source observations or certainty. AI output has no execution authority. External AI prompts must respect provider terms and source-specific restrictions.',
  },
  {
    title: '7. MT5 macro context bridge',
    body: 'The MT5 interface is a read-only fundamental context endpoint authenticated by a per-installation token. It may return fundamental bias, macro regime, rate differentials, event-risk context and provenance. It never returns technical entries or order instructions. Each EA must independently enforce its local event-risk rules and protect open positions if FiduLync or the network is unavailable. Never share broker passwords or installation tokens.',
  },
  {
    title: '8. Capital and automated-trading risk',
    body: 'Forex, CFDs, futures, precious metals and leveraged products carry substantial risk. Gaps, spread expansion, slippage, low liquidity, rejected orders, broker outages, VPS/network failure and software defects can cause rapid losses. Compile and test each EA in MetaEditor, use Strategy Tester and forward-test on demo before considering live use. Never trade money you cannot afford to lose.',
  },
  {
    title: '9. Security and privacy',
    body: 'The browser research terminal does not require sign-in. That does not make privileged APIs public: machine ingestion, administrative provisioning and MT5 context access remain server-authenticated, rate-limited and validated. Supabase secret/service-role keys and provider API keys remain server-side. The research notebook uses browser-local storage and is not a cloud backup.',
  },
  {
    title: '10. No warranty or performance certification',
    body: 'The application and provider feeds are research tooling. Availability, accuracy, completeness, timeliness and fitness for a particular purpose are not guaranteed. A successful software build or API response does not certify a model, strategy, broker execution path, EA or live-trading system as profitable or safe.',
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-24 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / MACROLYNC</p>
        <h1 className="mt-3 text-3xl font-semibold">Research, data & risk policy</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Macro research scope, source attribution, data integrity and the read-only MT5 context boundary.</p>
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
    </div>
  );
}
