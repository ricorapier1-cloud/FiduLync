import Link from 'next/link';

export default function MacroLyncGuidePage() {
  return (
    <div className="min-h-screen bg-[#080a0f] px-4 py-10 pb-24 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="border-b border-white/10 pb-5">
          <Link href="/" className="text-xs font-mono text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
          <p className="mt-6 font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / MACROLYNC</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Fundamental intelligence and MT5 connection guide</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">FiduLync researches macroeconomic and fundamental conditions. Your independent MT5 Expert Advisors remain responsible for technical analysis, entries, exits, sizing, orders and all broker-side protection.</p>
        </header>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">What FiduLync provides</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Official macroeconomic releases, central-bank policy and economic surprises.</li>
            <li>Currency fundamentals, policy divergence, inflation and real-rate proxies.</li>
            <li>Cross-asset context, commodities, positioning and geopolitical catalysts where verified sources are available.</li>
            <li>Evidence provenance, release/retrieval timestamps, data freshness and explicit insufficient-evidence states.</li>
            <li>A read-only macro context response for an independently configured MT5 EA.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">What your EA must do independently</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Technical indicators, price action, market structure and chart confirmation.</li>
            <li>Entry/exit decisions, lot sizing, stop-loss, take-profit and position management.</li>
            <li>Broker symbol specifications, margin, spread, slippage and execution checks.</li>
            <li>Emergency protection and event-risk enforcement that continue working if FiduLync or the network is unavailable.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">Read-only MT5 macro context API</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Endpoint: <code className="break-all text-emerald-200">GET /api/v1/macro-context?symbol=EURUSD</code></p>
          <p className="mt-2 text-sm leading-6 text-slate-300">The endpoint requires an active installation token in the Authorization Bearer header and a UTC X-MT5-Timestamp header no more than 60 seconds old. It returns fundamental bias, macro regime, verified policy differentials, event-risk context and provenance. It never returns technical entries, stops, targets, lot sizes or order instructions.</p>
          <p className="mt-3 text-sm leading-6 text-amber-200">An installation token must be provisioned through a trusted server-side administrative procedure. There is deliberately no browser Owner Console or public token-creation form. Never put the token in source control or share it in chat.</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">MT5 WebRequest must be permitted for the exact HTTPS FiduLync hostname. Test with a demo account first. The EA must abstain from using unavailable or insufficient macro context.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="/mql5/MacroContextBridge.mqh" download className="rounded-lg border border-emerald-300/30 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/10">Download MacroContextBridge.mqh</a>
            <Link href="/" className="rounded-lg border border-white/10 px-4 py-2 text-xs text-slate-200 hover:bg-white/5">Open Macro Terminal</Link>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">Important data limitations</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">A configured API key does not prove that a provider subscription or display entitlement is active. OIS/futures repricing, options-implied volatility, forwards and cross-currency basis remain unavailable unless a suitable licensed feed is connected and verified. Economic observations update on their publishers&apos; release schedules; they are not tick-by-tick data.</p>
          <p className="mt-3 text-sm leading-6 text-slate-400">Never interpret a reference exchange rate, cached observation, model estimate or stale value as a live tradable quote. FiduLync is a research tool, not a broker, signal guarantee or trade execution service.</p>
        </section>
      </div>
    </div>
  );
}
