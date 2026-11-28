import Link from 'next/link';
import type { MacroSnapshot } from '@/types/macro';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';

function format(value: number | undefined, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) + suffix : '—';
}
function timestamp(value?: string) {
  if (!value) return 'Timestamp unavailable';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Invalid timestamp';
}
function sourceStatus(snapshot: MacroSnapshot) {
  return snapshot.source === 'provider' ? 'LATEST PUBLISHED · PROVIDER VERIFIED'
    : snapshot.source === 'partial' ? 'PARTIAL · PROVIDER VERIFIED INPUTS' : 'UNAVAILABLE';
}

export default function MacroIntelligenceDashboard({ snapshot }: { snapshot: MacroSnapshot }) {
  const strength = getCurrencyStrengthIndex(snapshot);
  const currencies = snapshot.currencies.filter((item) =>
    ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'].includes(item.code));
  const events = [...snapshot.catalysts].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const highImpact = events.filter((event) => event.impact === 'High');
  const us = snapshot.usIndicators;

  return (
    <div className="min-h-screen bg-[#050b10] px-4 py-8 pb-24 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.24em] text-emerald-300">FIDULYNC / MACROLYNC INTELLIGENCE</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Global macro & fundamental terminal</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Understand the economic, monetary-policy and cross-asset forces that can drive currencies. This is a research terminal, not an execution or broker-quote screen. Macro statistics update on their official release schedules; they are latest published observations, not tick-real-time prices. COT is weekly.</p>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-mono">
            <span className="rounded-lg border border-white/10 px-3 py-2">DATA: {sourceStatus(snapshot)}</span>
            <span className="rounded-lg border border-white/10 px-3 py-2">RETRIEVED: {timestamp(snapshot.asOf)}</span>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-4"><p className="text-xs text-slate-500">Verified G8 currency profiles</p><p className="mt-2 font-mono text-3xl">{currencies.length}/8</p><p className="mt-1 text-[10px] text-slate-500">Provider-attributed profiles available in this snapshot</p></article>
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-4"><p className="text-xs text-slate-500">CFTC positioning markets</p><p className="mt-2 font-mono text-3xl">{snapshot.cot.length}</p><p className="mt-1 text-[10px] text-slate-500">Weekly positioning observations, not live flow</p></article>
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-4"><p className="text-xs text-slate-500">High-impact calendar events</p><p className="mt-2 font-mono text-3xl">{highImpact.length}</p><p className="mt-1 text-[10px] text-slate-500">Only events available from an approved source</p></article>
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-4"><p className="text-xs text-slate-500">Calendar provenance</p><p className="mt-2 font-mono text-xl">{snapshot.calendarSource === 'provider' ? 'PROVIDER' : 'UNAVAILABLE'}</p><p className="mt-1 text-[10px] text-slate-500">{snapshot.calendarProvider ?? 'No verified provider calendar selected'} · retrieved {timestamp(snapshot.calendarRetrievedAt)}</p></article>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-mono text-[10px] tracking-widest text-emerald-300">RELATIVE FUNDAMENTAL CONTEXT</p><h2 className="mt-2 text-lg font-semibold">G8 currency strength</h2></div>
              <span className="text-[10px] text-slate-500">Descriptive cross-sectional score · not a forecast</span>
            </div>
            <div className="mt-5 space-y-3">
              {strength.map((item) => (
                <div key={item.currency} className="grid grid-cols-[44px_1fr_42px] items-center gap-3">
                  <span className="font-mono text-xs font-semibold">{item.currency}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: Math.max(2, Math.min(100, (item.score + 100) / 2)) + '%' }} /></div>
                  <span className="text-right font-mono text-xs">{item.score > 0 ? '+' : ''}{item.score}</span>
                </div>
              ))}
              {strength.length === 0 && <p className="rounded-lg border border-white/10 p-4 text-xs text-slate-500">Insufficient verified policy-rate and inflation observations to calculate a relative G8 context score.</p>}
            </div>
            <p className="mt-4 text-[10px] leading-5 text-slate-500">The score standardizes available policy rates and policy-minus-inflation proxies across currencies. It is not a calibrated return forecast, trade probability or entry signal.</p>
          </article>

          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-5">
            <p className="font-mono text-[10px] tracking-widest text-emerald-300">US MACRO PULSE</p>
            <h2 className="mt-2 text-lg font-semibold">Growth, inflation & labour</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-slate-500">Headline CPI YoY</p><p className="mt-1 font-mono text-xl">{format(us?.cpiYearOverYearPct, '%')}</p><p className="text-[10px] text-slate-600">{us?.cpiPeriod ?? 'Period unavailable'}</p></div>
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-slate-500">Core CPI YoY</p><p className="mt-1 font-mono text-xl">{format(us?.coreCpiYearOverYearPct, '%')}</p><p className="text-[10px] text-slate-600">{us?.coreCpiPeriod ?? 'Period unavailable'}</p></div>
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-slate-500">Unemployment</p><p className="mt-1 font-mono text-xl">{format(us?.unemploymentRatePct, '%')}</p><p className="text-[10px] text-slate-600">{us?.unemploymentPeriod ?? 'Period unavailable'}</p></div>
              <div className="rounded-lg bg-black/20 p-3"><p className="text-[10px] text-slate-500">Nonfarm payroll change</p><p className="mt-1 font-mono text-xl">{format(us?.nonfarmPayrollMonthlyChangeThousands, 'k')}</p><p className="text-[10px] text-slate-600">{us?.payrollPeriod ?? 'Period unavailable'}</p></div>
            </div>
            <p className="mt-4 text-[10px] text-slate-500">US sources: {us?.sources.join(' · ') || 'Unavailable'} · BLS/BEA retrieved {timestamp(us?.retrievedAt)} · FRED retrieved {timestamp(us?.fredRetrievedAt)}</p>
          </article>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#0b141c] p-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[10px] tracking-widest text-emerald-300">MONETARY POLICY MONITOR</p><h2 className="mt-2 text-lg font-semibold">Central-bank policy & inflation matrix</h2></div><Link href="/analytics" className="text-xs text-emerald-300 hover:underline">Cross-asset observations →</Link></div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="text-slate-500"><tr><th className="p-3">Currency</th><th className="p-3">Central bank</th><th className="p-3">Policy rate</th><th className="p-3">Inflation</th><th className="p-3">Policy − inflation proxy</th><th className="p-3">Policy / inflation observations</th></tr></thead>
              <tbody>{currencies.map((item) => (
                <tr key={item.code} className="border-t border-white/[0.06]"><td className="p-3 font-mono font-semibold">{item.code}</td><td className="p-3">{item.centralBank}</td><td className="p-3 font-mono">{format(item.policyRate, '%')}<span className="ml-1 text-[10px] text-slate-600">{item.policyRateProvider ?? item.policyRateSource}</span></td><td className="p-3 font-mono">{format(item.inflation, '%')}<span className="ml-1 text-[10px] text-slate-600">{item.inflationProvider ?? item.inflationSource}</span></td><td className="p-3 font-mono">{format(item.policyRate - item.inflation, ' pp')}</td><td className="p-3 text-slate-500"><span>Policy: {timestamp(item.policyRateAsOf)}</span><br /><span>Inflation: {timestamp(item.inflationAsOf)}</span></td></tr>
              ))}</tbody>
            </table>
            {currencies.length === 0 && <p className="p-4 text-xs text-slate-500">No verified G8 policy and inflation profiles are available.</p>}
          </div>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">Policy minus inflation is a simplified ex-post proxy, not a matched-maturity market real yield or OIS-implied policy path.</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-5">
            <p className="font-mono text-[10px] tracking-widest text-emerald-300">INSTITUTIONAL POSITIONING</p><h2 className="mt-2 text-lg font-semibold">CFTC COT</h2>
            <div className="mt-4 space-y-2">{snapshot.cot.slice(0, 8).map((item) => <div key={item.market} className="border-b border-white/[0.06] py-2 text-xs"><div className="flex items-center justify-between gap-3"><span>{item.market}</span><span className="font-mono text-slate-300">{item.netContracts.toLocaleString('en-US')} · P{item.percentile.toFixed(0)} · n={item.sampleSize ?? '—'}</span></div><p className="mt-1 text-[10px] text-slate-500">Position date: {timestamp(item.asOf)} · Publication timestamp: {item.publishedAt ? timestamp(item.publishedAt) : 'not supplied by source'}</p></div>)}</div>
            {snapshot.cot.length === 0 && <p className="mt-3 text-xs text-slate-500">Verified COT observations unavailable.</p>}
            <p className="mt-3 text-[10px] text-slate-500">Weekly futures positioning, not live order flow. Observation date and publication date must not be conflated.</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-[#0b141c] p-5">
            <p className="font-mono text-[10px] tracking-widest text-emerald-300">MACRO CATALYSTS</p><h2 className="mt-2 text-lg font-semibold">Upcoming economic events</h2>
            <div className="mt-4 space-y-3">{events.slice(0, 8).map((event) => <div key={event.id} className="border-b border-white/[0.06] pb-3"><div className="flex items-start justify-between gap-3"><p className="text-xs font-medium">{event.title}</p><span className={event.impact === 'High' ? 'text-[10px] text-amber-300' : 'text-[10px] text-slate-500'}>{event.impact}</span></div><p className="mt-1 text-[10px] text-slate-500">{event.region} · {timestamp(event.scheduledAt)}</p><p className="mt-1 text-[10px] text-slate-500">Consensus: {event.consensus} · Actual: {event.actual ?? 'Pending'}</p></div>)}</div>
            {events.length === 0 && <p className="mt-3 text-xs text-slate-500">No verified calendar events are currently available.</p>}
            <p className="mt-3 text-[10px] text-slate-500">Calendar source: {snapshot.calendarProvider ?? 'not verified'} · {snapshot.calendarSource}</p>
          </article>
        </section>

        <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <p className="font-mono text-[10px] tracking-widest text-amber-200">EVIDENCE LIMITATIONS</p>
          <p className="mt-2 text-xs leading-5 text-amber-100/80">Only observations actually returned by approved providers are shown. OIS/futures repricing, options, forwards, cross-currency basis, matched maturity real-yield spreads, historical surprise consensus and fully synchronized cross-asset correlation history are not claimed as available unless their sources are connected and validated. A missing field is not zero.</p>
        </section>
      </div>
    </div>
  );
}
