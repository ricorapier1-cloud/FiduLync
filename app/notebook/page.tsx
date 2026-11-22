'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BrandGlyph from '@/components/BrandGlyph';
import type { FundamentalBias, MacroRegime, ConfidenceLevel, ResearchHypothesis } from '@/types/macro';

const G8_PAIRS = [
  'EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY', 'NZDJPY',
  'EURGBP', 'EURAUD', 'EURCAD', 'EURCHF', 'XAUUSD',
] as const;

const STORAGE_KEY = 'macrolync_research_notebook_v1';

export default function MacroResearchNotebook() {
  const [hypotheses, setHypotheses] = useState<ResearchHypothesis[]>([]);
  const [selectedPair, setSelectedPair] = useState<string>('EURUSD');
  const [selectedRegime, setSelectedRegime] = useState<MacroRegime>('INSUFFICIENT_EVIDENCE');
  const [selectedBias, setSelectedBias] = useState<FundamentalBias>('NEUTRAL');
  const [selectedConfidence, setSelectedConfidence] = useState<ConfidenceLevel>('INSUFFICIENT_EVIDENCE');
  const [thesisText, setThesisText] = useState('');
  const [supportingEvidence, setSupportingEvidence] = useState('');
  const [invalidationText, setInvalidationText] = useState('');
  const [bullPct, setBullPct] = useState(30);
  const [basePct, setBasePct] = useState(50);
  const [bearPct, setBearPct] = useState(20);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) setHypotheses(parsed as ResearchHypothesis[]);
      }
    } catch {
      // An unreadable local notebook must not be replaced with fabricated sample research.
    }
  }, []);

  const persist = (updated: ResearchHypothesis[]) => {
    setHypotheses(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('LocalStorage write error:', err);
    }
  };

  const saveHypothesis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thesisText.trim()) return;
    const scenarioTotal = bullPct + basePct + bearPct;
    if ([bullPct, basePct, bearPct].some((value) => !Number.isFinite(value) || value < 0 || value > 100) || scenarioTotal !== 100) {
      window.alert('Scenario probabilities must be valid percentages that total exactly 100%.');
      return;
    }

    const now = new Date().toISOString();
    const newHypothesis: ResearchHypothesis = {
      id: `hyp-${crypto.randomUUID()}`,
      pair: selectedPair,
      regime: selectedRegime,
      bias: selectedBias,
      confidence: selectedConfidence,
      thesis: thesisText.trim(),
      supportingEvidence: supportingEvidence.split('\\n').map((s) => s.trim()).filter(Boolean),
      invalidationConditions: invalidationText.split('\\n').map((s) => s.trim()).filter(Boolean),
      scenarios: { bullPct, basePct, bearPct },
      status: 'ACTIVE',
      createdAtUtc: now,
      updatedAtUtc: now,
    };
    persist([newHypothesis, ...hypotheses]);
    setThesisText('');
    setSupportingEvidence('');
    setInvalidationText('');
  };

  const updateStatus = (id: string, status: ResearchHypothesis['status']) => {
    persist(hypotheses.map((h) => h.id === id ? { ...h, status, updatedAtUtc: new Date().toISOString() } : h));
  };

  const deleteHypothesis = (id: string) => persist(hypotheses.filter((h) => h.id !== id));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(hypotheses, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macrolync-research-notebook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHypotheses = filterStatus === 'ALL'
    ? hypotheses
    : hypotheses.filter((h) => h.status === filterStatus);

  return (
    <div className="macro-page pb-36 sm:pb-12 md:pb-8">
      <div className="macro-statusline mono">
        <span><span className="macro-pulse macro-pulse-live" /> MACRO RESEARCH NOTEBOOK / PRIVATE WORKSPACE</span>
        <span className="macro-status-right">
          <Link href="/" className="macro-refresh">← RETURN TO TERMINAL</Link>
          <button type="button" onClick={exportJson} className="macro-refresh">
            <BrandGlyph name="arrow-down" size={13} /> EXPORT RESEARCH JSON
          </button>
        </span>
      </div>

      <section className="macro-intro" aria-labelledby="notebook-title">
        <div>
          <span className="eyebrow">NO-SIGN-IN BROWSER RESEARCH WORKSPACE</span>
          <h1 id="notebook-title">Fundamental Theses.<br /><span>Falsifiable scenarios.</span></h1>
          <p>
            Log qualitative and quantitative macroeconomic hypotheses, link real-rate drivers, specify strict invalidation conditions, and track scenario evolution over multi-week macro cycles.
          </p>
        </div>
        <div className="macro-intro-meta mono">
          <span>STORAGE MODE / BROWSER SANDBOX</span>
          <span className="macro-provenance text-amber-300/90">
            CONFIDENTIALITY DISCLOSURE: Hypotheses and research logs are saved strictly in your client browser local storage. No data is synchronized or transmitted to external servers.
          </span>
        </div>
      </section>

      <div className="macro-two-column">
        <section className="macro-section">
          <div className="macro-section-heading">
            <div><span className="eyebrow">NEW RECORD</span><h2>Log Fundamental Hypothesis</h2></div>
            <span className="macro-section-note mono">STRUCTURED THESIS</span>
          </div>
          <form onSubmit={saveHypothesis} className="macro-panel p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="macro-select-label">INSTRUMENT / PAIR</label>
                <div className="macro-select-wrap">
                  <select value={selectedPair} onChange={(e) => setSelectedPair(e.target.value)}>
                    {G8_PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select><BrandGlyph name="chevron-down" size={14} />
                </div>
              </div>
              <div>
                <label className="macro-select-label">MACRO REGIME</label>
                <div className="macro-select-wrap">
                  <select value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value as MacroRegime)}>
                    <option value="INSUFFICIENT_EVIDENCE">Insufficient Evidence</option>
                    <option value="POLICY_DIVERGENCE_CARRY">Policy Divergence / Carry</option>
                    <option value="INFLATION_SHOCK_HAWKISH">Inflation Shock / Hawkish</option>
                    <option value="GROWTH_SLOWDOWN_RISK_OFF">Growth Slowdown / Risk-Off</option>
                    <option value="COMMODITY_DRIVEN">Commodity-Driven</option>
                    <option value="EVENT_LOCKOUT_HIGH_UNCERTAINTY">Event Lockout / High Uncertainty</option>
                  </select><BrandGlyph name="chevron-down" size={14} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="macro-select-label">FUNDAMENTAL BIAS</label>
                <div className="macro-select-wrap">
                  <select value={selectedBias} onChange={(e) => setSelectedBias(e.target.value as FundamentalBias)}>
                    <option value="NEUTRAL">Neutral</option><option value="STRONG_BULLISH">Strong Bullish</option>
                    <option value="BULLISH">Bullish</option><option value="BEARISH">Bearish</option><option value="STRONG_BEARISH">Strong Bearish</option>
                  </select><BrandGlyph name="chevron-down" size={14} />
                </div>
              </div>
              <div>
                <label className="macro-select-label">DATA CONFIDENCE</label>
                <div className="macro-select-wrap">
                  <select value={selectedConfidence} onChange={(e) => setSelectedConfidence(e.target.value as ConfidenceLevel)}>
                    <option value="INSUFFICIENT_EVIDENCE">Insufficient Evidence</option><option value="LOW">Low</option>
                    <option value="MODERATE">Moderate</option><option value="HIGH">High</option>
                  </select><BrandGlyph name="chevron-down" size={14} />
                </div>
              </div>
            </div>
            <div><label className="macro-select-label">CORE MACRO THESIS & DRIVER</label><textarea value={thesisText} onChange={(e) => setThesisText(e.target.value)} placeholder="State the economic rationale and distinguish verified facts from interpretation..." className="w-full h-24 rounded border border-white/[0.1] bg-[#0c1016] p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400" required /></div>
            <div><label className="macro-select-label">SUPPORTING MACRO EVIDENCE (ONE PER LINE)</label><textarea value={supportingEvidence} onChange={(e) => setSupportingEvidence(e.target.value)} placeholder="Include source, observation date, release date and evidence quality for each claim..." className="w-full h-16 rounded border border-white/[0.1] bg-[#0c1016] p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400" /></div>
            <div><label className="macro-select-label">SPECIFIC INVALIDATION CONDITIONS</label><textarea value={invalidationText} onChange={(e) => setInvalidationText(e.target.value)} placeholder="Define observable conditions that would falsify the thesis..." className="w-full h-16 rounded border border-white/[0.1] bg-[#0c1016] p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="macro-select-label">BULL %</label><input type="number" min="0" max="100" value={bullPct} onChange={(e) => setBullPct(Number(e.target.value))} className="w-full rounded border border-white/[0.1] bg-[#0c1016] p-2 text-xs font-mono text-emerald-400" /></div>
              <div><label className="macro-select-label">BASE %</label><input type="number" min="0" max="100" value={basePct} onChange={(e) => setBasePct(Number(e.target.value))} className="w-full rounded border border-white/[0.1] bg-[#0c1016] p-2 text-xs font-mono text-slate-200" /></div>
              <div><label className="macro-select-label">BEAR %</label><input type="number" min="0" max="100" value={bearPct} onChange={(e) => setBearPct(Number(e.target.value))} className="w-full rounded border border-white/[0.1] bg-[#0c1016] p-2 text-xs font-mono text-rose-400" /></div>
            </div>
            <button type="submit" className="w-full py-2.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30 font-mono text-xs font-semibold tracking-wider transition">RECORD RESEARCH HYPOTHESIS</button>
          </form>
        </section>
        <section className="macro-section">
          <div className="macro-section-heading">
            <div><span className="eyebrow">RESEARCH PORTFOLIO</span><h2>Active & Validated Theses</h2></div>
            <div className="flex items-center gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-[#0c1016] border border-white/[0.1] rounded px-2 py-1 text-[11px] font-mono text-slate-300">
                <option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="VALIDATED">Validated</option><option value="INVALIDATED">Invalidated</option><option value="RETIRED">Retired</option>
              </select>
            </div>
          </div>
          <div className="space-y-4">
            {filteredHypotheses.length === 0 && <div className="macro-panel p-8 text-center text-slate-500 text-xs font-mono">No hypotheses recorded yet. Begin with a falsifiable, evidence-referenced thesis.</div>}
            {filteredHypotheses.map((h) => (
              <article key={h.id} className="macro-panel p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2"><strong className="font-mono text-base text-slate-100">{h.pair}</strong><span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">{h.regime.replace(/_/g, ' ')}</span><span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-500/20 text-slate-300">{h.bias}</span></div>
                  <div className="flex items-center gap-2"><span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/[0.08] text-slate-300">{h.status}</span><button type="button" onClick={() => deleteHypothesis(h.id)} className="text-slate-500 hover:text-rose-400 text-xs px-1" title="Delete record">×</button></div>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{h.thesis}</p>
                {h.supportingEvidence.length > 0 && <div className="text-[11px] text-slate-300 space-y-1"><div className="font-mono text-[10px] uppercase text-emerald-400">Supporting Evidence:</div><ul className="list-disc list-inside space-y-0.5 text-slate-400">{h.supportingEvidence.map((s, idx) => <li key={idx}>{s}</li>)}</ul></div>}
                {h.invalidationConditions.length > 0 && <div className="text-[11px] text-slate-300 space-y-1"><div className="font-mono text-[10px] uppercase text-amber-400">Invalidation Conditions:</div><ul className="list-disc list-inside space-y-0.5 text-slate-400">{h.invalidationConditions.map((s, idx) => <li key={idx}>{s}</li>)}</ul></div>}
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] font-mono"><div className="flex items-center gap-3"><span className="text-emerald-400">Bull {h.scenarios.bullPct}%</span><span className="text-slate-400">Base {h.scenarios.basePct}%</span><span className="text-rose-400">Bear {h.scenarios.bearPct}%</span></div><div className="flex items-center gap-1.5">{h.status === 'ACTIVE' && <><button type="button" onClick={() => updateStatus(h.id, 'VALIDATED')} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px]">Mark Validated</button><button type="button" onClick={() => updateStatus(h.id, 'INVALIDATED')} className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px]">Mark Invalidated</button></>}{h.status !== 'ACTIVE' && <button type="button" onClick={() => updateStatus(h.id, 'ACTIVE')} className="px-2 py-0.5 rounded bg-white/[0.08] text-slate-300 hover:bg-white/[0.15] text-[10px]">Re-open</button>}</div></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
