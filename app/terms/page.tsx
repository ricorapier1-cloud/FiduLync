import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Use & Trading Risk Disclosure',
  description: 'Terms, licensing conditions and risk disclosures for FiduLync, MacroLync and AlgoLync.',
};

const sections = [
  {
    title: '1. Platform scope and separate products',
    body: 'FiduLync provides software tools for market research, quantitative analysis, account-risk monitoring, MT5 connectivity and AlgoLync Expert Advisor licensing. MacroLync research outputs, AlgoLync EA products, customer licensing and any owner-only control-plane tools are separate services with distinct permissions. Availability of a feature does not mean it is approved for live trading.',
  },
  {
    title: '2. No broker, investment adviser or fiduciary relationship',
    body: 'FiduLync, MacroLync and AlgoLync are software providers, not banks, brokers, dealers, custodians, portfolio managers or investment advisers. Nothing in the platform is a personalized recommendation, solicitation, offer to buy or sell a financial instrument, or a promise to execute a trade. Users remain solely responsible for their trading decisions and compliance with the laws and broker terms applicable to them.',
  },
  {
    title: '3. High-risk leveraged trading warning',
    body: 'Foreign exchange, CFDs, futures, precious metals and other leveraged products carry a high level of risk and may not be suitable for all investors. Leverage magnifies gains and losses. You may lose some or all of your invested capital; depending on the product, broker agreement and jurisdiction, losses may exceed the initial deposit. Prices can gap, spreads can widen, liquidity can disappear, orders can be rejected or filled at materially different prices, and systems or connectivity can fail. Do not trade money you cannot afford to lose. Seek independent professional advice where appropriate.',
  },
  {
    title: '4. Expert Advisors and automated trading risk',
    body: 'An EA can submit orders rapidly and repeatedly and may behave unexpectedly because of software defects, configuration errors, broker restrictions, market gaps, VPS/network interruptions, stale data, terminal restarts or third-party service outages. Always test on a demo account and in a controlled forward-test environment before considering live use. Keep broker-side stop-loss protection and independent account-level risk limits. Never assume that a cloud licence check, signal, model score or risk approval guarantees a safe order or prevents loss.',
  },
  {
    title: '5. Backtests, simulated results and live verified telemetry',
    body: 'All illustrative curves, sample win rates, profit factors, Sharpe ratios, drawdowns and other simulated or backtested figures must be labelled as simulated/backtested, with their assumptions and limitations. They are not verified customer results and do not predict future performance. Backtests may be affected by overfitting, look-ahead or survivorship bias, data gaps, broker-specific price histories, spread/commission/swap assumptions, latency, slippage, partial fills and execution constraints. Live verified telemetry is a separate category and may only be labelled verified when it is derived from authenticated, account-isolated broker/MT5 records with a stated sample period, trade count, account currency, broker/server and methodology. If such evidence is unavailable, the platform must show “Not available” rather than invent or infer a live statistic.',
  },
  {
    title: '6. Model, signal and research limitations',
    body: 'Technical indicators, macroeconomic data, currency-strength scores, correlations, regime classifications, forecasts and confluence scores are model outputs based on available data and assumptions. They may be delayed, incomplete, revised, erroneous or unavailable. A score is not a calibrated probability unless explicitly validated as one. Historical relationships can break down. Missing, stale or inconsistent data should cause the affected feature to abstain or display an unavailable state rather than silently substitute fabricated values.',
  },
  {
    title: '7. Licensing, account seats and product delivery',
    body: 'An AlgoLync licence is issued only after the payment provider confirms a successful transaction and the server durably records the entitlement. The standard included seat allowance is one LIVE MT5 account and two DEMO MT5 accounts per eligible paid licence, subject to the product entitlement displayed at checkout. Account assignment is enforced server-side. Replacing an assigned account is subject to a 72-hour cooldown; a request may be rejected until the cooldown expires. Demo licences are time-limited and DEMO-only. A one-time licence is a non-recurring purchase for the stated product/version entitlement; it does not imply unlimited future upgrades, support or perpetual availability unless expressly stated at checkout. Monthly licences are time-limited and require a successful renewal payment to continue; automatic renewal is not implied unless the checkout clearly states and obtains consent for it.',
  },
  {
    title: '8. Payments, cancellations and refunds',
    body: 'Payments are processed through Paystack or another clearly identified payment provider. The platform stores payment references and entitlement records; payment-card and bank credentials should be entered only on the provider-hosted payment interface. The exact price, currency, licence duration, included seats and any applicable taxes or fees are shown before payment. Cancellation, renewal and refund terms must be displayed at checkout and will be applied subject to mandatory consumer-protection law in the customer’s jurisdiction. A payment redirect or browser success message alone does not prove that a licence has been issued.',
  },
  {
    title: '9. Data, broker and third-party provider terms',
    body: 'Market data may originate from a connected MT5 broker terminal or third-party providers. FX has no single consolidated global tape; the customer’s broker quote is the relevant execution reference for that account. Provider data can be delayed, incomplete, rate-limited, revised or subject to redistribution restrictions. Users must comply with the provider’s commercial-use, display, caching and redistribution terms. FiduLync does not grant rights to redistribute third-party market data.',
  },
  {
    title: '10. Security and account responsibility',
    body: 'Never share a broker trading password, remote-desktop password, owner-console password, publisher token or API secret. Use strong unique passwords and enable available account security controls. Connector credentials are installation-scoped and should be revoked if exposed. Customer licences and MT5 seat assignments are sensitive bearer credentials; protect them and do not post them publicly. The platform may suspend credentials or entitlements where fraud, abuse, compromise or material security risk is reasonably suspected.',
  },
  {
    title: '11. Availability, limitations and liability',
    body: 'The platform depends on hosting, database, payment provider, email, broker terminal, VPS, network and external data services. Planned maintenance, outages, API quotas and third-party terms may affect availability. To the maximum extent permitted by applicable law, the software is supplied without a guarantee of uninterrupted service, error-free operation or trading performance. Nothing in these terms excludes liability that cannot lawfully be excluded.',
  },
  {
    title: '12. Legal review and jurisdiction',
    body: 'These operational terms and risk notices are a product disclosure baseline, not legal advice and not a representation that the platform is licensed or compliant in every country. Before opening commercial sales or enabling live payment processing, the operator must obtain jurisdiction-specific legal, tax, privacy and financial-services advice and publish the applicable company identity, contact address, governing law, complaint process, cancellation terms and statutory disclosures.',
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-[75vh] w-full max-w-4xl px-5 py-10 pb-44 text-slate-100">
      <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
      <header className="mb-8 mt-8">
        <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / MACROLYNC / ALGOLYNC</p>
        <h1 className="mt-3 text-3xl font-semibold">Terms of Use &amp; Trading Risk Disclosure</h1>
        <p className="mt-3 text-xs leading-6 text-slate-400">Operational product terms and material trading-risk notices. Effective date: 19 November 2026.</p>
        <p className="mt-3 text-xs leading-5 text-amber-200">Important: this baseline disclosure requires review by qualified counsel in every market where the products are sold. It is not a legal opinion or a claim of regulatory approval.</p>
      </header>
      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-white/10 bg-[#0c1118] p-5">
            <h2 className="text-sm font-semibold text-white">{section.title}</h2>
            <p className="mt-3 text-xs leading-6 text-slate-400">{section.body}</p>
          </section>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-4 text-xs">
        <Link href="/privacy" className="text-emerald-300 underline">Read Privacy Notice</Link>
        <Link href="/faq" className="text-emerald-300 underline">Help &amp; FAQ</Link>
      </div>
    </main>
  );
}
