import type { Metadata } from 'next';
import Link from 'next/link';
import { getMacroSnapshot } from '@/lib/macroEngine';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Cross-Asset Macro Research',
  description: 'Source-attributed cross-asset macro observations and G8 monetary-policy context.',
};

function valueLabel(value: number | undefined, suffix = '') {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) + suffix : 'UNAVAILABLE';
}

function dateLabel(value: string | undefined) {
  if (!value) return 'Timestamp unavailable';
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Timestamp invalid';
}

export default async function CrossAssetMacroPage() {
  const snapshot = await getMacroSnapshot();
  const us = snapshot.usIndicators;
  const assets = [
    { name: 'US 10Y nominal Treasury yield', value: us?.tenYearTreasuryYieldPct, asOf: us?.tenYearTreasuryYieldAsOf, unit: '%' },
    { name: 'US 10Y TIPS real yield', value: us?.tenYearRealYieldPct, asOf: us?.tenYearRealYieldAsOf, unit: '%' },
    { name: 'US 10Y breakeven inflation', value: us?.tenYearBreakevenInflationPct, asOf: us?.tenYearBreakevenInflationAsOf, unit: '%' },
    { name: 'US broad trade-weighted USD index', value: us?.usdBroadIndex, asOf: us?.usdBroadIndexAsOf, unit: '' },
    { name: 'VIX', value: us?.vixIndex, asOf: us?.vixIndexAsOf, unit: '' },
    { name: 'S&P 500 index', value: us?.sp500Index, asOf: us?.sp500IndexAsOf, unit: '' },
    { name: 'WTI crude oil', value: us?.wtiOilUsd, asOf: us?.wtiOilAsOf, unit: ' USD' },
    { name: 'Brent crude oil', value: us?.brentOilUsd, asOf: us?.brentOilAsOf, unit: ' USD' },
    { name: 'US high-yield credit spread', value: us?.usHighYieldSpreadPct, asOf: us?.usHighYieldSpreadAsOf, unit: '%' },
  ];
  const catalysts = [...snapshot.catalysts].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const sourceLabel = snapshot.source === 'provider' ? 'PROVIDER' : snapshot.source === 'partial' ? 'PARTIAL' : 'UNAVAILABLE';

  return (
    <div className="min-h-screen bg-[#050b10] px-4 py-8 pb-24 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link href="/" className="font-mono text-xs text-emerald-300 hover:underline">← BACK TO MACRO TERMINAL</Link>
        <header className="border-b border-white/10 pb-6">
          <p className="font-mono text-[10px] tracking-[0.2em] text-emerald-300">MACROLYNC / CROSS-ASSET RESEARCH</p>
          <h1 className="mt-3 text-3xl font-semibold">Cross-asset macro observations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Source-attributed observations for macro research. These are not executable quotes or tick-real-time prices. Macro statistics appear at their latest published observation; their release cadence is set by each publisher. Each value retains its observation period, and unavailable fields remain blank rather than being estimated.</p>
          <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] text-slate-400">
            <span>SNAPSHOT: {sourceLabel}</span>
            <span>AS OF: {dateLabel(snapshot.asOf)}</span>
            <span>BLS/BEA RETRIEVED: {dateLabel(us?.retrievedAt)}</span>
            <span>FRED RETRIEVED: {dateLabel(us?.fredRetrievedAt)}</span>
          </div>
        </header>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Cross-asset observations</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.name} className="rounded-xl border border-white/10 bg-[#0b141c] p-4">
                <p className="text-xs text-slate-400">{asset.name}</p>
                <p className="mt-2 font-mono text-2xl font-semibold">{valueLabel(asset.value, asset.unit)}</p>
                <p className="mt-2 text-[10px] text-slate-500">{dateLabel(asset.asOf)}</p>
                <p className="mt-1 text-[10px] text-slate-500">{us?.sources?.join(' · ') || 'Source manifest unavailable'}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">G8 policy and inflation differential context</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-white/[0.04] text-slate-400">
                <tr><th className="p-3">Currency</th><th className="p-3">Central bank</th><th className="p-3">Policy rate</th><th className="p-3">Inflation</th><th className="p-3">Policy − inflation proxy</th><th className="p-3">As of</th></tr>
              </thead>
              <tbody>
                {snapshot.currencies.filter((item) => ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].includes(item.code)).map((item) => (
                  <tr key={item.code} className="border-t border-white/[0.06]">
                    <td className="p-3 font-mono font-semibold">{item.code}</td><td className="p-3">{item.centralBank}</td>
                    <td className="p-3 font-mono">{valueLabel(item.policyRate, '%')} <span className="text-[10px] text-slate-500">{item.policyRateProvider ?? item.policyRateSource ?? ''}</span></td>
                    <td className="p-3 font-mono">{valueLabel(item.inflation, '%')} <span className="text-[10px] text-slate-500">{item.inflationProvider ?? item.inflationSource ?? ''}</span></td>
                    <td className="p-3 font-mono">{valueLabel(item.policyRate - item.inflation, ' pp')}</td>
                    <td className="p-3 text-slate-500">Policy: {dateLabel(item.policyRateAsOf)}<br />Inflation: {dateLabel(item.inflationAsOf)}</td>
                  </tr>
                ))}
                {snapshot.currencies.filter((item) => ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'].includes(item.code)).length === 0 && (
                  <tr><td className="p-4 text-slate-500" colSpan={6}>No verified G8 currency observations are currently available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">Policy minus inflation is a simple ex-post proxy, not a matched-maturity market real yield or an OIS-implied policy path.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">CFTC positioning context</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-white/[0.04] text-slate-400"><tr><th className="p-3">Market</th><th className="p-3">Net contracts</th><th className="p-3">Historical percentile</th><th className="p-3">Weekly change</th><th className="p-3">Position date / publication</th></tr></thead>
              <tbody>
                {snapshot.cot.map((item) => (
                  <tr key={item.market} className="border-t border-white/[0.06]"><td className="p-3 font-mono">{item.market}</td><td className="p-3 font-mono">{item.netContracts.toLocaleString('en-US')}</td><td className="p-3 font-mono">{item.percentile.toFixed(1)}%</td><td className="p-3 font-mono">{item.weeklyChange.toLocaleString('en-US')}</td><td className="p-3 text-slate-500">Position: {dateLabel(item.asOf)}<br />Published: {item.publishedAt ? dateLabel(item.publishedAt) : 'Not supplied'}<br />Sample: {item.sampleSize ?? 'Unavailable'}</td></tr>
                ))}
                {snapshot.cot.length === 0 && <tr><td className="p-4 text-slate-500" colSpan={5}>COT positioning is unavailable or not verified under the current provider policy.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">COT is weekly positioning data, not live order flow or dealer positioning.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Economic catalysts</h2>
          <div className="space-y-2">
            {catalysts.map((event) => (
              <article key={event.id} className="rounded-lg border border-white/10 bg-[#0b141c] p-3 sm:flex sm:items-center sm:justify-between">
                <div><p className="text-sm font-medium">{event.title}</p><p className="mt-1 text-xs text-slate-500">{event.region} · {event.impact} impact</p></div>
                <div className="mt-2 text-left font-mono text-[10px] text-slate-400 sm:mt-0 sm:text-right">{dateLabel(event.scheduledAt)}<p>Consensus: {event.consensus} · Actual: {event.actual ?? 'Pending'}</p></div>
              </article>
            ))}
            {catalysts.length === 0 && <p className="rounded-lg border border-white/10 p-4 text-xs text-slate-500">No verified calendar events are currently available.</p>}
          </div>
        </section>

        <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs leading-5 text-amber-100/80">Correlation matrices, lead/lag estimates and structural-break tests are intentionally not displayed until synchronized historical observations with consistent timestamps and source coverage are available. This page does not invent those statistics.</p>
      </div>
    </div>
  );
}
