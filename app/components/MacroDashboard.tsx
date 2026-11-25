'use client';

import { useEffect, useMemo, useState } from 'react';
import BrandGlyph from '@/components/BrandGlyph';
import { getCurrencyStrengthIndex } from '@/lib/currencyStrength';
import { generatePairDossier } from '@/lib/macro/dossierEngine';
import type { MacroSnapshot, PairDossier } from '@/types/macro';
import type { GoldMacroContext } from '@/lib/macro/goldAndRegimeEngine';
import DeskTerminal from '@/app/components/DeskTerminal';
import PairOpportunityBoard from '@/app/components/PairOpportunityBoard';
import EABridgeDiagnostics from '@/app/components/EABridgeDiagnostics';

type MacroDashboardProps = {
  initialSnapshot: MacroSnapshot;
  initialGoldContext: GoldMacroContext | null;
};

const pairs = [
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD' },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY' },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD' },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD' },
  { symbol: 'NZDUSD', base: 'NZD', quote: 'USD' },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD' },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF' },
  { symbol: 'EURJPY', base: 'EUR', quote: 'JPY' },
  { symbol: 'GBPJPY', base: 'GBP', quote: 'JPY' },
  { symbol: 'AUDJPY', base: 'AUD', quote: 'JPY' },
] as const;

function inflationFreshnessDays(currencyCode: string) { return currencyCode === 'AUD' ? 180 : 120; }

function isFreshQuarter(period: string | undefined) {
  const match = period?.match(/^(\d{4})Q([1-4])$/);
  if (!match) return false;
  const quarterEnd = Date.UTC(Number(match[1]), Number(match[2]) * 3, 0);
  const age = Date.now() - quarterEnd;
  return age >= -5 * 60_000 && age <= 180 * 86_400_000;
}

function isFreshObservation(date: string | undefined, maxAgeDays: number) {
  if (!date) return false;
  const timestamp = Date.parse(date);
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= -5 * 60_000 && age <= maxAgeDays * 86_400_000;
}

function formatRate(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatBasisPoints(value: number) {
  return `${value > 0 ? '+' : ''}${value} bps`;
}

function formatContracts(value: number) {
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('en-US').format(value)}`;
}

function formatCountdown(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (seconds === 0) return 'Due / passed';
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default function MacroDashboard({ initialSnapshot, initialGoldContext }: MacroDashboardProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [goldContext, setGoldContext] = useState(initialGoldContext);
  const [pair, setPair] = useState<(typeof pairs)[number]['symbol']>('EURUSD');
  const [now, setNow] = useState<number | null>(null);
  const [, setRefreshing] = useState(false);
  const [aiBrief, setAiBrief] = useState<{ bullets: string[]; source: 'gemini' | 'rules' } | null>(null);

  const currencyStrength = getCurrencyStrengthIndex(snapshot);
  const dossier: PairDossier = generatePairDossier(snapshot, pair);

  const sortedCatalysts = [...snapshot.catalysts]
    .filter((catalyst) => now === null || Date.parse(catalyst.scheduledAt) >= now)
    .sort((left, right) => Date.parse(left.scheduledAt) - Date.parse(right.scheduledAt));
  const currencies = snapshot.currencies;
  const divergenceRanked = useMemo(() => {
    return currencies
      .map((c) => {
        const verifiedPolicy = c.policyRateSource === 'provider' && isFreshObservation(c.policyRateObservationDate, 180);
        const verifiedInflation = c.inflationSource === 'provider' && isFreshObservation(c.inflationObservationDate, inflationFreshnessDays(c.code));
        const realRate = verifiedPolicy && verifiedInflation ? c.policyRate - c.inflation : null;
        return {
          code: c.code,
          centralBank: c.centralBank,
          policyRate: verifiedPolicy ? c.policyRate : null,
          inflation: verifiedInflation ? c.inflation : null,
          realRate,
        };
      })
      .filter((item): item is typeof item & { realRate: number } => item.realRate !== null)
      .sort((a, b) => b.realRate - a.realRate);
  }, [currencies]);

  const divergenceSpread = useMemo(() => {
    if (divergenceRanked.length < 2) return null;
    return divergenceRanked[0].realRate - divergenceRanked[divergenceRanked.length - 1].realRate;
  }, [divergenceRanked]);

  useEffect(() => {
    const initialClockTimer = window.setTimeout(() => setNow(Date.now()), 0);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 30_000);
    const controller = new AbortController();

    const refreshGold = async () => {
      try {
        const response = await fetch('/api/macro/gold-context', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isRecord(payload) && typeof payload.generatedAtUtc === 'string'
          && ['AVAILABLE', 'INSUFFICIENT_EVIDENCE', 'UNAVAILABLE'].includes(String(payload.overallState))) setGoldContext(payload as unknown as GoldMacroContext);
      } catch { /* retain the last verified context */ }
    };

    const refresh = async () => {
      setRefreshing(true);
      try {
        const response = await fetch('/api/macro/snapshot', { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const data: unknown = await response.json();
          if (isRecord(data) && Array.isArray(data.currencies) && Array.isArray(data.cot) && Array.isArray(data.catalysts)) {
            setSnapshot(data as MacroSnapshot);
          }
        }
      } catch {
        // Keep last snapshot
      } finally {
        setRefreshing(false);
      }
    };

    void refresh();
    void refreshGold();

    void fetch('/api/v1/ai-brief', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (isRecord(payload) && Array.isArray(payload.bullets)
          && payload.bullets.every((bullet) => typeof bullet === 'string')
          && (payload.source === 'gemini' || payload.source === 'rules')) {
          setAiBrief({ bullets: payload.bullets.slice(0, 3), source: payload.source });
        }
      })
      .catch(() => {});

    const refreshTimer = window.setInterval(() => void refresh(), 300_000);
    const goldRefreshTimer = window.setInterval(() => void refreshGold(), 300_000);

    return () => {
      window.clearInterval(clockTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(goldRefreshTimer);
      window.clearTimeout(initialClockTimer);
      controller.abort();
    };
  }, []);

  return (
    <div className="macro-page pb-36 sm:pb-12 md:pb-8">
      {/* Execution workflow is surfaced before the research detail panels. */}
      <DeskTerminal initialSnapshot={snapshot} initialGoldContext={goldContext} macroStrength={currencyStrength} />

      {/* Unified research workspace navigation */}
      <nav aria-label="Research workspaces" className="sticky top-0 z-30 flex flex-wrap gap-2 border-y border-white/10 bg-[#080d14]/95 px-3 py-3 backdrop-blur">
        <a className="macro-refresh" href="#opportunities">01 / OPPORTUNITIES</a>
        <a className="macro-refresh" href="#matrix">02 / GLOBAL MACRO</a>
        <a className="macro-refresh" href="#bias">03 / PAIR RESEARCH</a>
        <a className="macro-refresh" href="#catalysts">04 / CATALYSTS</a>
        <a className="macro-refresh" href="#regimes">05 / CROSS-ASSET</a>
        <a className="macro-refresh" href="#gold-research">06 / GOLD RESEARCH</a>
        <a className="macro-refresh" href="#positioning">07 / POSITIONING</a>
        <a className="macro-refresh" href="#desk-terminal">08 / DESK &amp; EXECUTION</a>
        <a className="macro-refresh" href="#health">09 / DATA HEALTH</a>
      </nav>

      <PairOpportunityBoard onSelectPair={(symbol) => {
        if (symbol === 'XAUUSD') {
          document.getElementById('gold-research')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
        setPair(symbol as (typeof pairs)[number]['symbol']);
        document.getElementById('bias')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }} />

      {/* Top Macro Divergence Banner */}

      {/* Currency Strength Index & AI Desk Brief */}
      <section className="macro-intelligence-grid" aria-label="Currency strength and AI desk brief">
        <div className="macro-brief-panel">
          <div className="macro-section-heading">
            <div>
              <span className="eyebrow">QUALITATIVE RESEARCH</span>
              <h2>Macro Research Desk Brief</h2>
            </div>
            <span className="macro-section-note mono">{aiBrief?.source === 'gemini' ? 'AI SYNTHESIS' : 'RULE-BASED'}</span>
          </div>
          {aiBrief ? (
            <ul className="macro-brief-list">
              {aiBrief.bullets.map((bullet, index) => <li key={`${index}-${bullet}`}>{bullet}</li>)}
            </ul>
          ) : (
            <p className="macro-brief-loading">Synthesizing macro intelligence brief…</p>
          )}
          <p className="macro-csi-note">Qualitative macroeconomic synthesis. External MT5 EAs query the structured JSON context bridge.</p>
        </div>
      </section>

      {/* Monetary Policy Matrix */}
      <section id="matrix" className="macro-section" aria-labelledby="matrix-title">
        <div className="macro-section-heading">
          <div>
            <span className="eyebrow">03 / MONETARY POLICY</span>
            <h2 id="matrix-title">Global Central Bank Policy Matrix</h2>
          </div>
          <span className="macro-section-note mono">POLICY / INFLATION / 2Y YIELD %</span>
        </div>

        {/* Policy Divergence Spectrum */}
        {divergenceRanked.length > 0 && (
          <div className="macro-divergence-card">
            <div className="macro-divergence-header">
              <div>
                <span className="eyebrow">POLICY DIVERGENCE SPECTRUM</span>
                <h3>Real Rate Advantage &amp; Monetary Stance</h3>
              </div>
              {divergenceSpread !== null && (
                <div className="macro-spread-pill mono">
                  MAX SPREAD: <strong>+{divergenceSpread.toFixed(2)}%</strong>
                </div>
              )}
            </div>
            <p className="macro-divergence-desc">
              Central banks ranked by authentic real policy rates (Policy Rate minus Inflation). Positive real rate differentials provide institutional carry and monetary policy support.
            </p>
            <div className="macro-divergence-grid">
              {divergenceRanked.map((c, idx) => (
                <div key={c.code} className={`macro-divergence-item ${c.realRate >= 0 ? 'macro-item-hawkish' : 'macro-item-dovish'}`}>
                  <div className="macro-div-rank mono">#{idx + 1}</div>
                  <div className="macro-div-info">
                    <span className="macro-div-ccy mono">{c.code}</span>
                    <span className="macro-div-bank">{c.centralBank}</span>
                  </div>
                  <div className="macro-div-metrics">
                    <span className={`macro-div-real mono ${c.realRate >= 0 ? 'macro-positive' : 'macro-negative'}`}>
                      {c.realRate >= 0 ? '+' : ''}{c.realRate.toFixed(2)}%
                    </span>
                    <span className="macro-div-stance">{c.realRate >= 1.5 ? 'Restrictive' : c.realRate >= 0 ? 'Neutral' : 'Accommodative'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="macro-panel macro-matrix-panel">
          <table className="macro-table">
            <thead>
              <tr>
                <th>CCY</th>
                <th>CENTRAL BANK</th>
                <th>POLICY RATE</th>
                <th>INFLATION</th>
                <th>2Y YIELD</th>
                <th>REAL RATE</th>
                <th>POLICY STANCE</th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((currency) => {
                const verifiedPolicy = currency.policyRateSource === 'provider' && isFreshObservation(currency.policyRateObservationDate, 180);
                const verifiedInflation = currency.inflationSource === 'provider' && isFreshObservation(currency.inflationObservationDate, inflationFreshnessDays(currency.code));
                const realRate = verifiedPolicy && verifiedInflation ? currency.policyRate - currency.inflation : null;
                return (
                  <tr key={currency.code}>
                    <td><span className="macro-currency-code mono">{currency.code}</span></td>
                    <td>{currency.centralBank}</td>
                    <td className="mono">
                      {verifiedPolicy ? formatRate(currency.policyRate) : 'UNAVAILABLE'}
                      <small>{verifiedPolicy ? `PROVIDER ${currency.policyRateProvider ?? 'UNSPECIFIED'} · OBS ${currency.policyRateObservationDate}` : currency.policyRateSource === 'provider' ? `STALE / DATE ${currency.policyRateObservationDate ?? 'UNKNOWN'}` : 'REFERENCE / NOT SCORED'}</small>
                    </td>
                    <td>
                      <span className="mono">{verifiedInflation ? formatRate(currency.inflation) : 'UNAVAILABLE'}</span>
                      <small>{verifiedInflation ? `PROVIDER ${currency.inflationProvider ?? 'UNSPECIFIED'} · OBS ${currency.inflationObservationDate}` : currency.inflationSource === 'provider' ? `STALE / DATE ${currency.inflationObservationDate ?? 'UNKNOWN'}` : 'REFERENCE / NOT SCORED'}</small>
                    </td>
                    <td className="mono">
                      {currency.twoYearYield === undefined || currency.twoYearYieldSource !== 'provider' || !isFreshObservation(currency.twoYearYieldObservationDate, 60) ? '—' : (
                        <>
                          {formatRate(currency.twoYearYield)}
                          <small>PROVIDER · OBS {currency.twoYearYieldObservationDate}</small>
                        </>
                      )}
                    </td>
                    <td className={`mono ${realRate === null ? 'text-slate-500' : realRate >= 0 ? 'macro-positive' : 'macro-negative'}`}>
                      {realRate === null ? '—' : `${realRate > 0 ? '+' : ''}${formatRate(realRate)}`}
                    </td>
                    <td><span className="macro-stance">{currency.stance}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="macro-panel-foot">
            <span>Real rate = nominal policy rate − headline inflation. Yield spreads reflect 2-year sovereign debt obligations.</span>
            <span className="mono">OBSERVATION DATES &amp; PROVIDERS SHOWN PER ROW · NOT INTRADAY DATA</span>
          </div>
        </div>
      </section>

      <p className="text-[10px] text-slate-500 font-mono mb-4">
        BIS Statistics: central-bank policy rates (WS_CBPOL) and consumer-price annual changes (WS_LONG_CPI). Observation dates indicate the latest published period; these are not tick-by-tick market prices.
      </p>
      <section className="macro-section" aria-labelledby="us-drivers-title">
        <div className="macro-section-heading">
          <div><span className="eyebrow">03A / UNITED STATES MACRO DRIVERS</span><h2 id="us-drivers-title">Growth, Labour &amp; Wage Impulse</h2></div>
          <span className="macro-section-note mono">BEA / BLS / BIS OBSERVATIONS</span>
        </div>
        {(() => {
          const usd = currencies.find((currency) => currency.code === 'USD');
          const gdpFresh = usd?.gdpSource === 'provider' && isFreshQuarter(usd.gdpObservationDate);
          const unemploymentFresh = usd?.unemploymentSource === 'provider' && isFreshObservation(usd.unemploymentObservationDate, 120);
          const wagesFresh = usd?.wageGrowthSource === 'provider' && isFreshObservation(usd.wageGrowthObservationDate, 120);
          return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="macro-panel p-4"><span className="text-[10px] font-mono text-slate-400">REAL GDP GROWTH / YOY</span><strong className="block text-xl mono mt-2">{gdpFresh && usd?.gdpGrowthYoY !== undefined ? `${usd.gdpGrowthYoY.toFixed(2)}%` : 'UNAVAILABLE'}</strong><small className="text-[10px] text-slate-500 font-mono">{gdpFresh ? `BEA · ${usd?.gdpObservationDate}` : 'No verified BEA observation'}</small></div>
              <div className="macro-panel p-4"><span className="text-[10px] font-mono text-slate-400">UNEMPLOYMENT RATE</span><strong className="block text-xl mono mt-2">{unemploymentFresh && usd?.unemploymentRate !== undefined ? `${usd.unemploymentRate.toFixed(2)}%` : 'UNAVAILABLE'}</strong><small className="text-[10px] text-slate-500 font-mono">{unemploymentFresh ? `BLS · ${usd?.unemploymentObservationDate}` : 'No fresh BLS observation'}</small></div>
              <div className="macro-panel p-4"><span className="text-[10px] font-mono text-slate-400">AVERAGE HOURLY EARNINGS / YOY</span><strong className="block text-xl mono mt-2">{wagesFresh && usd?.wageGrowthYoY !== undefined ? `${usd.wageGrowthYoY.toFixed(2)}%` : 'UNAVAILABLE'}</strong><small className="text-[10px] text-slate-500 font-mono">{wagesFresh ? `BLS · ${usd?.wageGrowthObservationDate}` : 'No fresh BLS observation'}</small></div>
            </div>
          );
        })()}
      </section>

      {/* Two Column: Pair-Level Fundamental Dossier & Economic Catalysts */}
      <div className="macro-two-column">
        {/* Pair-Level Fundamental Dossier */}
        <section id="bias" className="macro-section" aria-labelledby="bias-title">
          <div className="macro-section-heading">
            <div>
              <span className="eyebrow">04 / PAIR DOSSIER</span>
              <h2 id="bias-title">Fundamental Pair Dossier</h2>
            </div>
            <span className="macro-section-note mono">COMPREHENSIVE RESEARCH</span>
          </div>

          <div className="macro-panel macro-bias-panel">
            <div className="flex items-center justify-between">
              <label className="macro-select-label" htmlFor="macro-pair">INSTRUMENT / PAIR</label>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.08] text-slate-300">
                CONFIDENCE: {dossier.confidence}
              </span>
            </div>
            <div className="macro-select-wrap">
              <select id="macro-pair" value={pair} onChange={(event) => setPair(event.target.value as (typeof pairs)[number]['symbol'])}>
                {pairs.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}
              </select>
              <BrandGlyph name="chevron-down" size={16} />
            </div>

            <div className={`macro-score macro-score-${dossier.biasScore > 0 ? 'up' : dossier.biasScore < 0 ? 'down' : 'flat'}`}>
              <span className="mono">{dossier.biasScore > 0 ? '+' : ''}{dossier.biasScore}</span>
              <span>/ 100</span>
            </div>

            <div className="macro-score-label">
              <strong>{dossier.fundamentalBias.replace(/_/g, ' ')}</strong>
              <span className="mono">REGIME: {dossier.macroRegime.replace(/_/g, ' ')}</span>
            </div>

            <div className="macro-bias-meter">
              <span className="macro-meter-mid" />
              <span
                className={`macro-meter-pointer ${dossier.biasScore >= 0 ? 'macro-pointer-up' : 'macro-pointer-down'}`}
                style={{ left: `${50 + dossier.biasScore / 2}%` }}
              />
            </div>
            <div className="macro-meter-scale mono">
              <span>-100 BEAR</span>
              <span>NEUTRAL</span>
              <span>+100 BULL</span>
            </div>

            <div className="macro-bias-drivers">
              <div>
                <span>POLICY DIFF</span>
                <strong className="mono">{dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? '—' : formatBasisPoints(dossier.policyDiffBps)}</strong>
              </div>
              <div>
                <span>REAL YIELD DIFF</span>
                <strong className="mono">{dossier.confidence === 'INSUFFICIENT_EVIDENCE' ? '—' : formatBasisPoints(dossier.realPolicyRateDiffBps)}</strong>
              </div>
              <div>
                <span>2Y YIELD SPREAD</span>
                <strong className="mono">{dossier.twoYearYieldDiffBps === null ? '—' : formatBasisPoints(dossier.twoYearYieldDiffBps)}</strong>
              </div>
            </div>

            {/* Dossier Executive Summary */}
            <div className="mt-4 p-3 rounded-lg bg-black/40 border border-white/[0.08] text-xs space-y-2">
              <span className="font-mono text-[10px] uppercase text-emerald-400 block tracking-wider">
                Macro Driver Summary:
              </span>
              <p className="text-slate-300 leading-relaxed font-sans">{dossier.summary}</p>
            </div>

            {/* Supporting vs Contradicting Evidence */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[11px]">
                <span className="font-mono text-[10px] uppercase text-emerald-400 block mb-1">Supporting Evidence</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {dossier.supportingEvidence.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20 text-[11px]">
                <span className="font-mono text-[10px] uppercase text-rose-400 block mb-1">Contradicting Evidence</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  {dossier.contradictingEvidence.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
            </div>

            {/* Invalidation Triggers */}
            <div className="mt-2 p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-[11px]">
              <span className="font-mono text-[10px] uppercase text-amber-400 block mb-1">Falsification / Invalidation Triggers</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                {dossier.invalidationTriggers.map((s, idx) => <li key={idx}>{s}</li>)}
              </ul>
            </div>

            {/* Scenarios Breakdown */}
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-3 text-xs font-mono">
              <span className="text-emerald-400">Bull —</span>
              <span className="text-slate-300">Base —</span>
              <span className="text-rose-400">Bear —</span>
              <span className="text-[10px] text-slate-500">PROBABILITY NOT CALIBRATED · EVENT LOCKOUT: {dossier.eventRiskLockout ? 'ACTIVE' : 'CLEAR'}</span>
            </div>
          </div>
        </section>

        {/* Economic Catalysts & Event Lockout */}
        <section id="catalysts" className="macro-section" aria-labelledby="catalyst-title">
          <div className="macro-section-heading">
            <div>
              <span className="eyebrow">05 / EVENT RISK</span>
              <h2 id="catalyst-title">Tier-1 Economic Catalysts</h2>
            </div>
            <span className="macro-section-note mono"><BrandGlyph name="calendar-clock" size={13} /> {snapshot.calendarSource === 'provider' && snapshot.calendarProvider ? 'HEALTHY · ' + snapshot.calendarProvider : 'UNAVAILABLE'} · UTC / WAT</span>
          </div>

          <div className="macro-panel macro-catalyst-panel">
            {sortedCatalysts.length === 0 && <p className="macro-empty">{snapshot.calendarSource === 'provider' ? 'No upcoming provider events in the current calendar window.' : 'Economic calendar unavailable: no verified provider feed returned events. Event lockout remains conservative.'}</p>}
            {sortedCatalysts.map((catalyst) => (
              <article className="macro-event" key={catalyst.id}>
                <div className="macro-event-time">
                  <span className="mono">{new Date(catalyst.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}</span>
                  <strong className="mono">{new Date(catalyst.scheduledAt).toISOString().slice(11, 16)}Z</strong>
                  <small className="mono text-slate-500">WAT {new Date(catalyst.scheduledAt).toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</small>
                </div>
                <div className="macro-event-info">
                  <div>
                    <span className="macro-region mono">{catalyst.region}</span>
                    <span className={`macro-impact macro-impact-${catalyst.impact.toLowerCase()}`}>{catalyst.impact}</span>
                  </div>
                  <h3>{catalyst.title}</h3>
                  <p>
                    Consensus <b className="mono">{catalyst.consensus}</b>
                    <span>Actual <b className="mono">{catalyst.actual ?? 'Pending'}</b></span>
                  </p>
                </div>
                <span className="macro-countdown mono">{now ? formatCountdown(catalyst.scheduledAt, now) : 'Syncing'}</span>
              </article>
            ))}
            <div className="macro-calendar-note">
              <BrandGlyph name="clock" size={14} />
              <span>Tier-1 catalyst events enforce a mandatory 30-minute pre- and post-release risk lockout window on connected execution systems.</span>
            </div>
          </div>
        </section>
      </div>

      {/* Cross-Asset Regimes & Commodities Board */}
      <section id="regimes" className="macro-section" aria-labelledby="regime-title">
        <div className="macro-section-heading">
          <div>
            <span className="eyebrow">06 / CROSS-ASSET TELEMETRY</span>
            <h2 id="regime-title">Cross-Asset &amp; Macro Regime Matrix</h2>
          </div>
          <span className="macro-section-note mono">BONDS / COMMODITIES / VOLATILITY</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'US 10Y benchmark', value: snapshot.usTreasury?.nominal10YPct ?? null, unit: '%', source: 'U.S. Treasury', observationDate: snapshot.usTreasury?.observationDate ?? null, stale: snapshot.usTreasury?.freshness === 'STALE' },
            { label: 'US 2s10s curve', value: snapshot.usTreasury?.twoYearTenYearSpreadBps ?? null, unit: 'bps', source: 'U.S. Treasury', observationDate: snapshot.usTreasury?.observationDate ?? null },
            { label: '10Y TIPS real yield', value: snapshot.usTreasury?.real10YPct ?? null, unit: '%', source: 'U.S. Treasury', observationDate: snapshot.usTreasury?.observationDate ?? null },
            { label: 'CBOE VIX', value: snapshot.vix?.freshness === 'LATEST PUBLISHED' ? snapshot.vix.value : null, unit: '', source: 'CBOE daily close', observationDate: snapshot.vix?.observationDate ?? null, stale: snapshot.vix?.freshness === 'STALE' },
            { label: 'WTI crude oil', value: snapshot.energyMarkets?.wti.valueUsdPerBarrel ?? null, unit: 'USD/bbl', source: 'EIA', observationDate: snapshot.energyMarkets?.wti.observationDate ?? null, stale: false },
            { label: 'Brent crude oil', value: snapshot.energyMarkets?.brent.valueUsdPerBarrel ?? null, unit: 'USD/bbl', source: 'EIA', observationDate: snapshot.energyMarkets?.brent.observationDate ?? null, stale: false },
          ].map(({ label, value, unit, source, observationDate, stale }) => (
            <div className="macro-panel p-3" key={label}>
              <span className="text-[10px] font-mono text-slate-400 block">{label.toUpperCase()}</span>
              <strong className="text-sm font-mono text-slate-100 block mt-1">
                {value !== null ? value.toFixed(2) + (unit ? ' ' + unit : '') : 'UNAVAILABLE'}
              </strong>
              <small className="text-[10px] text-amber-400 font-mono">
                {observationDate ? source + ' · OBS ' + observationDate + (stale ? ' · STALE' : '') : source}
              </small>
            </div>
          ))}
        </div>
        {snapshot.energyMarkets && (
          <p className="text-[10px] text-slate-500 font-mono mt-2">
            EIA Brent–WTI spot spread: ${snapshot.energyMarkets.brentWtiSpreadUsd.toFixed(2)}/barrel · Retrieved {snapshot.energyMarkets.wti.retrievedAtUtc} · Daily published spot observations, not intraday futures or live ticks.
          </p>
        )}
        {snapshot.usTreasury && (
          <p className="text-[10px] text-slate-500 font-mono mt-2">
            U.S. Treasury nominal and TIPS curves: observation {snapshot.usTreasury.observationDate} · Retrieved {snapshot.usTreasury.retrievedAtUtc} · Daily published closing-market estimates, not intraday streaming yields.
          </p>
        )}
        {snapshot.vix && (
          <p className="text-[10px] text-slate-500 font-mono mt-2">
            Cboe VIX: daily closing index observation {snapshot.vix.observationDate} · Retrieved {snapshot.vix.retrievedAtUtc} · Not an intraday volatility quote.
          </p>
        )}
      </section>

      {/* Dedicated gold macro engine: not scored through the generic FX dossier */}
      <section id="gold-research" className="macro-section" aria-labelledby="gold-research-title">
        <div className="macro-section-heading">
          <div>
            <span className="eyebrow">07 / XAUUSD DEDICATED RESEARCH</span>
            <h2 id="gold-research-title">Gold Macro &amp; Liquidity Intelligence</h2>
          </div>
          <span className="macro-section-note mono">{goldContext?.overallState ?? 'UNAVAILABLE'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="macro-panel p-3 min-w-0 break-words">
            <span className="text-[10px] font-mono text-slate-400">GOLD BIAS SCORE</span>
            <strong className="block text-sm sm:text-lg font-mono mt-1 min-w-0 break-words">{goldContext?.goldBiasScore ?? '—'}</strong>
            <small className="text-[10px] text-slate-500">{goldContext?.evidenceCoveragePct ?? 0}% evidence coverage · not a probability</small>
          </div>
          <div className="macro-panel p-3 min-w-0 break-words">
            <span className="text-[10px] font-mono text-slate-400">DIRECTIONAL VERDICT</span>
            <strong className="block text-sm sm:text-lg font-mono mt-2 min-w-0 break-words">{goldContext?.directionalVerdict ?? 'UNAVAILABLE'}</strong>
            <small className="text-[10px] text-slate-500">Research context, not an entry signal</small>
          </div>
          <div className="macro-panel p-3 min-w-0 break-words">
            <span className="text-[10px] font-mono text-slate-400">LIQUIDITY REGIME</span>
            <strong className="block text-sm sm:text-lg font-mono mt-2 min-w-0 break-words">{goldContext?.liquidityRegime ?? 'INSUFFICIENT_EVIDENCE'}</strong>
            <small className="text-[10px] text-slate-500">Cross-asset stress / carry context</small>
          </div>
          <div className="macro-panel p-3 min-w-0 break-words">
            <span className="text-[10px] font-mono text-slate-400">SPOT OBSERVATION</span>
            <strong className="block text-sm sm:text-lg font-mono mt-2 min-w-0 break-words">{goldContext?.quote.mid === null || goldContext?.quote.mid === undefined ? '—' : goldContext.quote.mid.toFixed(2)}</strong>
            <small className="text-[10px] text-slate-500">{goldContext?.quote.state ?? 'UNAVAILABLE'} · {goldContext?.quote.quoteTimestampUtc ?? 'NO VERIFIED TIME'}</small>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <div className="macro-panel p-4">
            <h3 className="text-xs font-mono text-slate-300 mb-3">SUPPORTING EVIDENCE</h3>
            {goldContext?.supportingEvidence.length
              ? <ul className="macro-brief-list">{initialGoldContext.supportingEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : <p className="macro-empty">No verified supporting evidence is currently available.</p>}
          </div>
          <div className="macro-panel p-4">
            <h3 className="text-xs font-mono text-slate-300 mb-3">CONTRADICTING EVIDENCE / INVALIDATION</h3>
            {goldContext?.contradictingEvidence.length
              ? <ul className="macro-brief-list">{initialGoldContext.contradictingEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : <p className="macro-empty">No verified contradicting evidence is currently available.</p>}
            {goldContext?.invalidationTriggers.length
              ? <ul className="macro-brief-list mt-3">{initialGoldContext.invalidationTriggers.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : null}
          </div>
        </div>
        <div className="macro-panel p-3 mt-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div><span className="block text-[10px] font-mono text-slate-500">DFII10 · REAL YIELD</span><strong className="block text-sm font-mono mt-1">{goldContext?.drivers.DFII10.value ?? '—'}</strong><small className="text-[10px] text-slate-500">{goldContext?.drivers.DFII10.state ?? 'UNAVAILABLE'} · {goldContext?.drivers.DFII10.observationDate ?? '—'}</small></div>
            <div><span className="block text-[10px] font-mono text-slate-500">T10YIE · BREAKEVEN</span><strong className="block text-sm font-mono mt-1">{goldContext?.drivers.T10YIE.value ?? '—'}</strong><small className="text-[10px] text-slate-500">{goldContext?.drivers.T10YIE.state ?? 'UNAVAILABLE'} · {goldContext?.drivers.T10YIE.observationDate ?? '—'}</small></div>
            <div><span className="block text-[10px] font-mono text-slate-500">DGS2 · 2Y TREASURY</span><strong className="block text-sm font-mono mt-1">{goldContext?.drivers.DGS2.value ?? '—'}</strong><small className="text-[10px] text-slate-500">{goldContext?.drivers.DGS2.state ?? 'UNAVAILABLE'} · {goldContext?.drivers.DGS2.observationDate ?? '—'}</small></div>
            <div><span className="block text-[10px] font-mono text-slate-500">3M CMT · TREASURY PROXY</span><strong className="block text-sm font-mono mt-1">{goldContext?.drivers.DTB3.value ?? '—'}</strong><small className="text-[10px] text-slate-500">{goldContext?.drivers.DTB3.state ?? 'UNAVAILABLE'} · {goldContext?.drivers.DTB3.observationDate ?? '—'}</small></div>
            <div><span className="block text-[10px] font-mono text-slate-500">HY OAS · CREDIT</span><strong className="block text-sm font-mono mt-1">{goldContext?.drivers.BAMLH0A0HYM2.value ?? '—'}</strong><small className="text-[10px] text-slate-500">{goldContext?.drivers.BAMLH0A0HYM2.state ?? 'UNAVAILABLE'} · {goldContext?.drivers.BAMLH0A0HYM2.observationDate ?? '—'}</small></div>
            <div><span className="block text-[10px] font-mono text-slate-500">VIX · VOLATILITY</span><strong className="block text-sm font-mono mt-1">{goldContext?.drivers.VIXCLS.value ?? '—'}</strong><small className="text-[10px] text-slate-500">{goldContext?.drivers.VIXCLS.state ?? 'UNAVAILABLE'} · {goldContext?.drivers.VIXCLS.observationDate ?? '—'}</small></div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-3">CFTC gold positioning report: {goldContext?.cot.reportDate ?? 'UNAVAILABLE'} · Retrieved {goldContext?.generatedAtUtc ?? '—'} · FRED daily-published series and CFTC weekly positioning are not intraday streaming feeds.</p>
        </div>
      </section>

      <section id="positioning" className="macro-section" aria-labelledby="cot-title">
        <div className="macro-section-heading">
          <div>
            <span className="eyebrow">08 / POSITIONING &amp; CROWDING</span>
            <h2 id="cot-title">CFTC Commitments of Traders (COT)</h2>
          </div>
          <a className="macro-inline-link" href="https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" target="_blank" rel="noreferrer">
            Official Socrata Portal <BrandGlyph name="external-link" size={13} />
          </a>
        </div>
        <div className="macro-cot-layout">
          <div className="macro-panel macro-cot-panel">
            <div className="macro-cot-head">
              <span>MARKET</span>
              <span>NET NON-COMMERCIAL</span>
              <span>W/W CHANGE</span>
              <span>EXTREME CROWDING</span>
            </div>
            {snapshot.cot.length === 0 && (
              <p className="macro-empty">CFTC positioning is temporarily unavailable; monetary policy inputs remain active.</p>
            )}
            {snapshot.cot.map((position) => (
              <div className="macro-cot-row" key={position.market}>
                <strong className="mono">{position.market}</strong>
                <span className={`mono ${position.netContracts >= 0 ? 'macro-positive' : 'macro-negative'}`}>
                  {formatContracts(position.netContracts)}
                </span>
                <span className={`mono ${position.weeklyChange >= 0 ? 'macro-positive' : 'macro-negative'}`}>
                  {position.weeklyChange > 0 ? '+' : ''}{formatContracts(position.weeklyChange)}
                </span>
                <div className="macro-extreme">
                  <div className="macro-extreme-track"><span style={{ width: `${position.percentile}%` }} /></div>
                  <span className="mono">{position.percentile}%ile</span>
                  {(position.percentile >= 90 || position.percentile <= 10) && <span className="macro-crowded">CROWDED</span>}
                </div>
              </div>
            ))}
            <div className="macro-panel-foot">
              <span>CFTC observations are published weekly; verify report date and vintage for each record.</span>
              <span className="mono">POSITIONING ≠ EXECUTION TRIGGER</span>
            </div>
          </div>
          <aside className="macro-cot-callout">
            <div className="macro-callout-icon"><BrandGlyph name="trend" size={18} /></div>
            <span className="eyebrow">CROWDING INTELLIGENCE</span>
            <h3>Extreme positioning amplifies reversals.</h3>
            <p>
              When speculative non-commercial positioning breaches the 90th or 10th percentile, markets become vulnerable to violent unwinds upon unexpected macroeconomic prints.
            </p>
            <div className="macro-callout-stat">
              <span>MOST CROWDED CONTRACT</span>
              <strong className="mono">
                {snapshot.cot.length > 0
                  ? `${snapshot.cot.reduce((highest, current) => current.percentile > highest.percentile ? current : highest, snapshot.cot[0]).market} ${Math.max(...snapshot.cot.map((position) => position.percentile))}%ile`
                  : 'Unavailable'}
              </strong>
            </div>
          </aside>
        </div>
      </section>

      <EABridgeDiagnostics />

      {/* Provider Health & Telemetry Diagnostics */}
      <section id="health" className="macro-section" aria-labelledby="health-title">
        <div className="macro-section-heading">
          <div><span className="eyebrow">09 / TELEMETRY</span><h2 id="health-title">Data Ingestion Health &amp; Freshness</h2></div>
          <span className="macro-section-note mono">OBSERVED STATUS ONLY</span>
        </div>
        <div className="macro-panel p-4">
          {snapshot.providerStatus?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {snapshot.providerStatus.map((provider) => (
                <div key={provider.name} className="p-3 rounded border border-white/[0.08] bg-[#0c1016]">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-slate-300">{provider.name}</span>
                    <span className={provider.status === 'HEALTHY' ? 'text-emerald-400' : provider.status === 'UNCONFIGURED' || provider.status === 'OFFLINE' ? 'text-rose-400' : 'text-amber-300'}>{provider.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">{provider.freshness} · {provider.latencyMs === null ? 'Latency unmeasured' : `${provider.latencyMs} ms`}</div>
                  <div className="text-[10px] text-slate-600 font-mono mt-1">{provider.latestObservationDate ? `Latest observation ${provider.latestObservationDate}` : 'Observation date not recorded'}{provider.lastSuccessfulSyncUtc ? ` · Retrieved ${provider.lastSuccessfulSyncUtc}` : ''}</div>
                  {provider.detail && <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{provider.detail}</p>}
                  {provider.nextAction && <p className="text-[10px] text-amber-300 mt-2 leading-relaxed">ACTION: {provider.nextAction}</p>}
                </div>
              ))}
            </div>
          ) : <p className="macro-empty">Provider health telemetry is unavailable. Credential presence is not treated as a successful health check.</p>}
        </div>
      </section>

    </div>
  );
}
