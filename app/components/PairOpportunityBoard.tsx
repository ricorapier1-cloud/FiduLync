'use client';

import { useEffect, useState } from 'react';

type Opportunity = {
  rank: number;
  symbol: string;
  direction: 'BUY' | 'SELL';
  macroScore: number;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  confidenceBasis?: 'EVIDENCE_COMPLETENESS_NOT_WIN_PROBABILITY';
  evidenceCoveragePct: number;
  regime: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  nextCatalyst: { title: string; scheduledAt: string; impact: 'High' | 'Medium' } | null;
  eventRiskLockout: boolean;
  eventRiskVerified: boolean;
  tradeReadiness: 'AWAIT_TECHNICAL_CONFIRMATION' | 'BLOCKED_CALENDAR_UNAVAILABLE' | 'BLOCKED_EVENT_LOCKOUT';
};

type OpportunityResponse = {
  status: 'CANDIDATES_AVAILABLE' | 'NO_QUALIFIED_CANDIDATES' | 'UNAVAILABLE';
  generatedAtUtc?: string;
  snapshotAsOfUtc?: string;
  dataSourceState?: string;
  candidates?: Opportunity[];
  methodology?: string;
};

function readinessLabel(item: Opportunity): string {
  if (item.tradeReadiness === 'BLOCKED_EVENT_LOCKOUT') return 'BLOCKED · HIGH-IMPACT EVENT WINDOW';
  if (item.tradeReadiness === 'BLOCKED_CALENDAR_UNAVAILABLE') return 'BLOCKED · CALENDAR UNVERIFIED';
  return 'CALENDAR VERIFIED · TECHNICAL CONFIRMATION REQUIRED';
}

export default function PairOpportunityBoard({ onSelectPair }: { onSelectPair: (symbol: string) => void }) {
  const [data, setData] = useState<OpportunityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/v1/top-pairs', { cache: 'no-store', signal: controller.signal });
        const payload: unknown = await response.json();
        if (active && payload && typeof payload === 'object') setData(payload as OpportunityResponse);
      } catch {
        if (active && !controller.signal.aborted) setData({ status: 'UNAVAILABLE', candidates: [] });
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 300_000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, []);

  const candidates = data?.candidates ?? [];
  return (
    <section id="opportunities" className="macro-section scroll-mt-24" aria-labelledby="opportunities-title">
      <div className="macro-section-heading">
        <div><span className="eyebrow">01 / RELATIVE VALUE SCREEN</span><h2 id="opportunities-title">Highest-Conviction Macro Opportunities</h2></div>
        <span className="macro-section-note mono">TOP 5 FX + GOLD · EVIDENCE-GATED</span>
      </div>
      <div className="macro-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-sm text-slate-300">Ranks supported G8 FX crosses and the independent gold model. Scores express relative macro evidence, not probability of profit or an entry signal.</p>
          <span className="text-[10px] font-mono text-slate-400">{loading ? 'RANKING…' : data?.status ?? 'UNAVAILABLE'}</span>
        </div>
        {candidates.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {candidates.map((item) => (
              <article key={item.symbol} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><span className="text-xs font-mono text-slate-500">#{String(item.rank).padStart(2, '0')}</span><strong className="text-xl font-mono text-white">{item.symbol}</strong><span className={item.direction === 'BUY' ? 'text-xs font-mono text-emerald-400' : 'text-xs font-mono text-rose-400'}>{item.direction}</span></div>
                    <p className="text-[10px] font-mono text-slate-400 mt-1">{item.regime.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="text-right"><strong className="block text-lg font-mono text-white">{item.macroScore > 0 ? '+' : ''}{item.macroScore}</strong><span className="text-[10px] font-mono text-slate-400">{item.confidence} · EVIDENCE GRADE</span><span className="block text-[10px] font-mono text-slate-500">{item.evidenceCoveragePct}% INPUT COVERAGE</span></div>
                </div>
                <div className={`mt-3 rounded-md border px-3 py-2 text-[10px] font-mono ${item.tradeReadiness === 'AWAIT_TECHNICAL_CONFIRMATION' ? 'border-emerald-500/20 text-emerald-300 bg-emerald-950/20' : 'border-amber-500/20 text-amber-300 bg-amber-950/20'}`}>{readinessLabel(item)}</div>
                {item.nextCatalyst && <p className="mt-2 text-[10px] text-slate-400">NEXT CATALYST · {item.nextCatalyst.title} · {new Date(item.nextCatalyst.scheduledAt).toISOString().replace('T', ' ').slice(0, 16)} UTC</p>}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div><span className="block text-[10px] font-mono text-emerald-400 mb-1">SUPPORTING EVIDENCE</span>{item.supportingEvidence.length ? <ul className="space-y-1 text-slate-300">{item.supportingEvidence.map((e) => <li key={e}>• {e}</li>)}</ul> : <span className="text-slate-500">No additional verified support.</span>}</div>
                  <div><span className="block text-[10px] font-mono text-amber-400 mb-1">COUNTER-EVIDENCE</span>{item.contradictingEvidence.length ? <ul className="space-y-1 text-slate-300">{item.contradictingEvidence.map((e) => <li key={e}>• {e}</li>)}</ul> : <span className="text-slate-500">No additional verified contradiction.</span>}</div>
                </div>
                <button type="button" onClick={() => onSelectPair(item.symbol)} className="mt-4 rounded-lg border border-white/15 px-3 py-2 text-[11px] font-mono text-slate-200 hover:bg-white/10">OPEN RESEARCH DOSSIER →</button>
              </article>
            ))}
          </div>
        ) : <div className="rounded-lg border border-dashed border-white/15 p-5 text-center"><strong className="block text-sm font-mono text-slate-200">{loading ? 'ASSEMBLING QUALIFIED PAIRS' : data?.status === 'UNAVAILABLE' ? 'RANKING DATA UNAVAILABLE' : 'NO QUALIFIED MACRO OPPORTUNITIES'}</strong><p className="text-xs text-slate-400 mt-2">{loading ? 'Waiting for the evidence screen.' : 'Current observations do not meet freshness, evidence and directional-score thresholds. No synthetic candidate is inserted.'}</p></div>}
        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">{data?.methodology ?? 'Provider-backed relative macro research only.'} No historical win probability is claimed. Technical confirmation, broker spreads, session conditions and account risk remain with the MT5 EA.</p>
        <p className="mt-1 text-[10px] font-mono text-slate-600">SNAPSHOT {data?.snapshotAsOfUtc ?? '—'} · GENERATED {data?.generatedAtUtc ?? '—'} · SOURCE {data?.dataSourceState ?? '—'}</p>
      </div>
    </section>
  );
}
