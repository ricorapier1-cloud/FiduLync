'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
}) : null;

type Hypothesis = {
  id: string; hypothesis_key: string; title: string; thesis: string;
  instruments: string[]; timeframes: string[]; features: Record<string, unknown>;
  parameters: Record<string, unknown>; null_hypothesis: string | null;
  falsification_criteria: Record<string, unknown>; status: string;
  created_at: string; updated_at: string;
};

function parseObject(value: string, label: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(label + ' must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

export default function ResearchNotebook() {
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Hypothesis[]>([]);
  const [title, setTitle] = useState('');
  const [thesis, setThesis] = useState('');
  const [instruments, setInstruments] = useState('EURUSD, GBPUSD, USDJPY');
  const [timeframes, setTimeframes] = useState('H4, H1');
  const [nullHypothesis, setNullHypothesis] = useState('');
  const [features, setFeatures] = useState('{"macro": [], "technical": []}');
  const [parameters, setParameters] = useState('{}');
  const [falsification, setFalsification] = useState('{"criteria": []}');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Checking private owner session…');

  const load = useCallback(async (current: Session) => {
    const verify = await fetch('/api/owner/verify', {
      headers: { Authorization: 'Bearer ' + current.access_token }, cache: 'no-store',
    });
    if (!verify.ok) throw new Error('Owner authentication is required. Sign in through the private EA Fleet page.');
    const response = await fetch('/api/owner/research-hypotheses', {
      headers: { Authorization: 'Bearer ' + current.access_token }, cache: 'no-store',
    });
    const payload = await response.json() as { hypotheses?: Hypothesis[]; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Could not load research hypotheses.');
    setItems(payload.hypotheses ?? []);
    setMessage('');
  }, []);

  useEffect(() => {
    let active = true;
    if (!supabase) { setMessage('Supabase owner authentication is not configured.'); return; }
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) { setMessage('Sign in through the private EA Fleet page to use the research notebook.'); return; }
      setSession(data.session);
      void load(data.session).catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : 'Owner session verification failed.');
      });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      if (next) void load(next).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Research notebook unavailable.'));
      else { setItems([]); setMessage('Sign in through the private EA Fleet page to use the research notebook.'); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!session) { setMessage('Owner authentication is required.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/owner/research-hypotheses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, thesis, instruments: instruments.split(',').map((v) => v.trim()).filter(Boolean),
          timeframes: timeframes.split(',').map((v) => v.trim()).filter(Boolean),
          null_hypothesis: nullHypothesis,
          features: parseObject(features, 'Features'),
          parameters: parseObject(parameters, 'Parameters'),
          falsification_criteria: parseObject(falsification, 'Falsification criteria'),
        }),
      });
      const payload = await response.json() as { hypothesis?: Hypothesis; error?: string };
      if (!response.ok || !payload.hypothesis) throw new Error(payload.error || 'Hypothesis could not be saved.');
      setItems((current) => [payload.hypothesis!, ...current]);
      setTitle(''); setThesis(''); setNullHypothesis('');
      setMessage('Hypothesis saved as DRAFT. No test or approval has been implied.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Hypothesis could not be saved.');
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-32 text-slate-100 sm:px-6">
      <header className="border-b border-white/10 pb-5">
        <Link href="/research" className="font-mono text-[10px] text-emerald-300 hover:underline">← QUANT RESEARCH LAB</Link>
        <p className="mt-5 font-mono text-[10px] tracking-[0.2em] text-cyan-200">STAGE 05 / HYPOTHESIS RESEARCH</p>
        <h1 className="mt-2 text-3xl font-semibold">Private research notebook</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Record a falsifiable market thesis, the instruments and timeframes it concerns, the feature set, parameters and the evidence that would disprove it. New records are saved as DRAFT only.</p>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <form onSubmit={save} className="space-y-4 rounded-xl border border-white/10 bg-[#0b121a] p-5">
          <h2 className="text-lg font-semibold">Register a hypothesis</h2>
          <label className="block text-xs text-slate-400">Research title
            <input required minLength={3} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
          </label>
          <label className="block text-xs text-slate-400">Testable thesis (what should happen, why, and under what conditions?)
            <textarea required minLength={20} maxLength={5000} rows={5} value={thesis} onChange={(e) => setThesis(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-400">Instruments (comma-separated)
              <input value={instruments} onChange={(e) => setInstruments(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
            </label>
            <label className="block text-xs text-slate-400">Timeframes
              <input value={timeframes} onChange={(e) => setTimeframes(e.target.value)} className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white" />
            </label>
          </div>
          <label className="block text-xs text-slate-400">Null hypothesis
            <textarea rows={2} value={nullHypothesis} onChange={(e) => setNullHypothesis(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white" placeholder="What if this effect is absent?" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-400">Features JSON
              <textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white" />
            </label>
            <label className="block text-xs text-slate-400">Parameters JSON
              <textarea rows={4} value={parameters} onChange={(e) => setParameters(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white" />
            </label>
          </div>
          <label className="block text-xs text-slate-400">Falsification criteria JSON
            <textarea rows={3} value={falsification} onChange={(e) => setFalsification(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white" />
          </label>
          <button type="submit" disabled={!session || busy} className="h-11 w-full rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#06110d] disabled:opacity-50">{busy ? 'Saving…' : 'Save hypothesis as DRAFT'}</button>
          {message && <p role="status" aria-live="polite" className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-300">{message}</p>}
        </form>

        <section className="rounded-xl border border-white/10 bg-[#0b121a] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Saved hypotheses</h2>
            <span className="font-mono text-[10px] text-slate-500">{items.length} RECORDS</span>
          </div>
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-slate-100">{item.title}</h3>
                  <span className="rounded border border-amber-300/20 px-2 py-1 font-mono text-[9px] text-amber-200">{item.status}</span>
                </div>
                <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{item.thesis}</p>
                <p className="mt-2 font-mono text-[9px] text-slate-500">{item.instruments.join(' · ')} / {item.timeframes.join(' · ')}</p>
                <p className="mt-2 text-[9px] text-slate-600">Created {new Date(item.created_at).toISOString().slice(0, 10)} UTC</p>
              </article>
            ))}
            {items.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-5 text-xs text-slate-500">No hypotheses saved yet. A record will appear here after the first successful save.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
