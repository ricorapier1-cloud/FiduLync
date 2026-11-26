import Link from 'next/link';

export const metadata = {
  title: 'Frequently Asked Questions & Architecture | MacroLync',
  description: 'Answers to common questions about MacroLync quantitative macro intelligence, data provenance, and the read-only MT5 macro context bridge.',
};

const faqs = [
  {
    q: 'What is MacroLync and what is its primary objective?',
    a: 'MacroLync is an institutional-grade macroeconomic, monetary-policy, and fundamental foreign-exchange intelligence platform. It concentrates exclusively on understanding what drives currencies and why markets move by synthesizing central bank policy expectations, interest-rate differentials, real yields, cross-asset capital flows, and economic catalysts.',
  },
  {
    q: 'How does MacroLync separate macro intelligence from technical execution?',
    a: 'MacroLync enforces a strict separation of concerns: macro analysis, fundamental bias scoring, regime classification, and event-risk lockouts are handled inside MacroLync. Technical chart analysis, trade entries/exits, position sizing, and broker order execution belong strictly inside individual MT5 Expert Advisors—NOT inside MacroLync.',
  },
  {
    q: 'How do external MetaTrader 5 Expert Advisors connect to MacroLync?',
    a: 'MacroLync exposes a secure, read-only REST JSON endpoint at `/api/v1/macro-context?symbol=EURUSD`. External MT5 Expert Advisors query this endpoint via WebRequest during their initialization or hourly cycle to retrieve current macro regime state, real-rate differentials, and upcoming event-lockout windows.',
  },
  {
    q: 'What data sources power MacroLync?',
    a: 'MacroLync ingests official statistical releases from the Federal Reserve Economic Data (FRED), European Central Bank (ECB Data Portal), Bank of Canada Valet API, Bank of England, and the US Commodity Futures Trading Commission (CFTC Commitments of Traders). Live currency pricing is sourced via institutional market data gateways.',
  },
  {
    q: 'What is point-in-time vintage integrity?',
    a: 'Economic indicators (GDP, CPI, employment) are frequently revised months after initial release. Backtesting models against revised data introduces fatal look-ahead bias. MacroLync tracks publication timestamps and release vintages to ensure historical research reflects only what market participants knew at the release timestamp.',
  },
  {
    q: 'How is research stored in the Trade Journal?',
    a: 'The Trade Journal is a zero-login, browser-based research workspace. Closed trades, P&amp;L, risk multiples and captured market context are persisted strictly inside your browser&apos;s local storage. No proprietary research data is transmitted to external servers.',
  },
  {
    q: 'Does MacroLync execute trades or provide financial advice?',
    a: 'No. MacroLync does not execute trades, manage broker accounts, or offer personalized investment advice. All models and regime classifications are provided strictly for research, quantitative study, and decision-support purposes.',
  },
];

export default function FAQPage() {
  return (
    <div className="macro-page pb-36 sm:pb-12 md:pb-8">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse macro-pulse-live" /> MACROLYNC ARCHITECTURE &amp; METHODOLOGY FAQ</span>
        <span className="macro-status-right">
          <Link href="/" className="macro-refresh">← RETURN TO TERMINAL</Link>
          <Link href="/notebook" className="macro-refresh">RESEARCH NOTEBOOK →</Link>
        </span>
      </div>

      <section className="macro-intro" aria-labelledby="faq-title">
        <div>
          <span className="eyebrow">RESEARCH &amp; INTEGRATION GUIDE</span>
          <h1 id="faq-title">Frequently Asked Questions.<br /><span>System architecture.</span></h1>
          <p>
            Key principles of MacroLync quantitative fundamental intelligence, data provenance, and external MT5 context integration.
          </p>
        </div>
        <div className="macro-intro-meta mono">
          <span>DOCUMENTATION / ARCHITECTURE</span>
          <span className="macro-provenance text-slate-300">
            STRICT RESPONSIBILITY BOUNDARY: Intelligence Center provides macro context; external EAs handle independent trade execution.
          </span>
        </div>
      </section>

      <section className="macro-section mt-8">
        <div className="space-y-4 max-w-4xl">
          {faqs.map((faq, index) => (
            <article key={index} className="macro-panel p-6 space-y-2">
              <h2 className="text-sm font-semibold text-slate-100 flex items-start gap-2">
                <span className="font-mono text-emerald-400">0{index + 1}.</span>
                {faq.q}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed font-sans pl-6">
                {faq.a}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* External MT5 Connection Code Snippet */}
      <section className="macro-section mt-8 max-w-4xl">
        <div className="macro-section-heading">
          <div>
            <span className="eyebrow">MT5 MQL5 INTEGRATION</span>
            <h2>How External EAs Consume Macro Context</h2>
          </div>
          <span className="macro-section-note mono">READ-ONLY REST API</span>
        </div>
        <div className="macro-panel p-5 font-mono text-xs text-slate-300 space-y-3">
          <p className="text-slate-400 text-[11px]">
            In your MT5 Expert Advisor, add your domain to <code>Tools → Options → Expert Advisors → Allow WebRequest for listed URL</code>:
          </p>
          <pre className="bg-[#05070a] p-4 rounded-lg border border-white/[0.08] text-emerald-300 overflow-x-auto text-[11px] leading-relaxed">
{`// MQL5 Snippet: Query MacroLync Read-Only Macro Context
string url = "https://fidulync.vercel.app/api/v1/macro-context?symbol=" + _Symbol;
char post[], result[];
string headers = "x-macro-key: YOUR_SERVER_SECRET\\r\\n";
int res = WebRequest("GET", url, headers, 3000, post, result, headers);

if(res == 200) {
   string response = CharArrayToString(result);
   // Parse JSON: macro_regime, fundamental_bias, news_lockout
   // If news_lockout == true, pause technical EA execution
}`}
          </pre>
        </div>
      </section>
    </div>
  );
}
