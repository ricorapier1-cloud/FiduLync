'use client';

import React, { useEffect, useState } from 'react';

type CandidatePayload = {
  candidate: null | { pair: string; direction: 'LONG'; spread: number; base: string; quote: string };
  candidate_status: string;
  macro_source: string;
  macro_as_of: string | null;
  rollover_watch_active: boolean;
  execution_eligibility: 'NOT_EVALUATED';
  reason: string;
};

export default function TopPairBanner() {
  const [data, setData] = useState<CandidatePayload | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/top-pairs', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Macro candidate feed unavailable.');
        return response.json() as Promise<CandidatePayload>;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch(() => { if (active) setData(null); });
    return () => { active = false; };
  }, []);

  if (!data) return null;

  return (
    <div className="mb-6 rounded-xl border border-white/[0.08] bg-slate-900/60 p-4 text-sm text-slate-200">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-emerald-300">MACRO RELATIVE-VALUE RESEARCH</div>
          {data.candidate ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <strong className="text-white">{data.candidate.pair}</strong>
              <span className="rounded border border-emerald-300/20 bg-emerald-300/5 px-2 py-1 font-mono text-[10px] text-emerald-200">{data.candidate.direction} candidate</span>
              <span className="font-mono text-xs text-slate-400">CSI differential {data.candidate.spread} pts</span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-200">No verified G8 macro relative-strength candidate is currently available.</p>
          )}
          <p className="mt-2 max-w-3xl text-[10px] leading-5 text-slate-500">{data.reason}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded border border-white/10 px-2 py-1 text-slate-400">Execution: NOT EVALUATED</span>
          <span className={`rounded border px-2 py-1 ${data.rollover_watch_active ? 'border-amber-300/20 text-amber-200' : 'border-white/10 text-slate-400'}`}>{data.rollover_watch_active ? 'UTC rollover watch' : 'Rollover watch clear'}</span>
        </div>
      </div>
    </div>
  );
}
