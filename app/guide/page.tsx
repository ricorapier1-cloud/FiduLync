'use client';

import Link from 'next/link';

export default function PersonalQuantGuidePage() {
  return (
    <main className="min-h-screen bg-[#080a0f] px-4 py-10 pb-36 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <Link href="/" className="text-xs font-mono text-emerald-300 hover:underline">← BACK TO TERMINAL</Link>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5">Print / Save PDF</button>
            <Link href="/risk" className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-semibold text-[#07120d]">Manual Risk Planner</Link>
          </div>
        </header>

        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">FIDULYNC / PERSONAL QUANT EDITION</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Personal setup and MT5 connection guide</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Use FiduLync as a private quantitative research, discretionary risk-planning and EA-supervision workspace. It does not place, modify or close broker orders.</p>
        </div>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">Before you start</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>You can open the dashboards and download source files from your phone.</li>
            <li>Live broker quotes, account snapshots and MetaEditor compilation require a Windows PC or Windows VPS running a logged-in MT5 terminal.</li>
            <li>Use a demo account first. Do not share broker passwords, investor passwords, owner tokens or publisher tokens.</li>
            <li>The server policy intentionally keeps trade approvals disabled until model, data and execution validation are complete.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">1. Register your private MT5 connector</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Open the <Link href="/owner" className="text-emerald-300 underline">Owner Control Centre</Link> and sign in with the configured owner email.</li>
            <li>Open Market Data Operations and create a terminal installation.</li>
            <li>Copy the installation ID and one-time publisher token into a secure password manager. The token is shown once; revoke and recreate the installation if lost or exposed.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">2. Start the read-only MT5 market publisher</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>On the Windows PC/VPS with MT5 already logged in, install Python 3.11+ and run <code className="rounded bg-black/40 px-1.5 py-0.5 text-emerald-200">py -m pip install MetaTrader5</code>.</li>
            <li>From the Personal EA Lab, download both <a href="/downloads/FiduLync_MT5_Market_Publisher.py" className="text-emerald-300 underline">FiduLync_MT5_Market_Publisher.py</a> and <a href="/downloads/mt5_risk_state.py" className="text-emerald-300 underline">mt5_risk_state.py</a>. Save them in the same folder.</li>
            <li>Set the private token and the exact verified deployment URL in that Windows session. Do not point the publisher at production until the updated ingestion route has been deployed and verified.</li>
            <li>Set broker symbol suffix mappings if necessary. The default universe includes major FX pairs and XAUUSD.</li>
            <li>Run the publisher. It sends broker quotes about once per second, account and complete open-position snapshots about every five seconds, and closed H1/H4/D1 candles on a separate 15-second synchronization cadence. It also publishes terminal-confirmed fill/close-deal evidence and a loss-streak estimate derived from the terminal&apos;s available closed-deal history. Requested-price slippage and order-to-fill latency are not inferred from history and require an additional EA-side transaction bridge. Console logs include ingestion round-trip time. These are target publisher intervals, not a guarantee of end-to-end broker execution latency. It never sends orders.</li>
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs leading-6 text-slate-300"><code>{`set FIDULYNC_PUBLISHER_TOKEN=YOUR_ONE_TIME_TOKEN
set FIDULYNC_INGEST_URL=https://YOUR_VERIFIED_DEPLOYMENT/api/v1/market-data/ingest
set MT5_SYMBOL_MAP=EURUSD=EURUSD,GBPUSD=GBPUSD,USDJPY=USDJPY,USDCHF=USDCHF,USDCAD=USDCAD,AUDUSD=AUDUSD,NZDUSD=NZDUSD,EURJPY=EURJPY,XAUUSD=XAUUSD
py FiduLync_MT5_Market_Publisher.py`}</code></pre>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">3. Test the EA supervisor — no-trade probe only</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Download <a href="/downloads/QuantSupervisor.mqh" className="text-emerald-300 underline">QuantSupervisor.mqh</a> and save it as <code className="text-emerald-200">MQL5/Include/FiduLync/QuantSupervisor.mqh</code>.</li>
            <li>Download <a href="/downloads/FiduLync_Supervisor_Probe.mq5" className="text-emerald-300 underline">FiduLync_Supervisor_Probe.mq5</a> into <code className="text-emerald-200">MQL5/Experts/</code>.</li>
            <li>In MetaEditor, compile the probe. In MT5 Tools → Options → Expert Advisors, allow WebRequest only to the exact verified deployment hostname.</li>
            <li>Attach the probe to a demo chart and enter the deployment URL, installation ID and publisher token. Review the Experts log and the latest supervisor decision in the Owner Control Centre.</li>
          </ol>
          <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100">The probe contains no OrderSend call. APPROVE is not currently enabled by the server policy; stale, incomplete or unverified data must result in ABSTAIN or DEGRADED.</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">4. Use the research and manual risk tools</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li><Link href="/" className="text-emerald-300 underline">MacroLync Dashboard</Link> — macro, currency-strength and market research context.</li>
            <li><Link href="/risk" className="text-emerald-300 underline">Manual Risk Planner</Link> — calculate risk and broker-aware position sizing before a discretionary trade.</li>
            <li><Link href="/analytics" className="text-emerald-300 underline">Analytics</Link> — inspect available trade and research records.</li>
            <li><Link href="/research" className="text-emerald-300 underline">Quant Lab</Link> — download free sample EAs and the MT5 bridge/probe source.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0c1016] p-5 sm:p-6">
          <h2 className="text-base font-semibold">Important limitations</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>The initial daily, weekly and high-water equity anchors begin with the first trusted snapshot received after their migration; they do not reconstruct earlier account drawdown.</li>
            <li>Loss-streak verification depends on the broker history available to the connected MT5 terminal. Missing or stale history blocks supervision.</li>
            <li>Broker tick values, volume steps, stop levels and margin calculations must be checked on the actual account and symbol.</li>
            <li>MetaEditor compilation, Strategy Tester and demo forward testing cannot be replaced by a web build. No model or signal guarantees profit.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
