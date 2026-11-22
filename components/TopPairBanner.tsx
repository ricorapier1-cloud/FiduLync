'use client';

import React, { useEffect, useState } from 'react';
import BrandGlyph from '@/components/BrandGlyph';

export default function TopPairBanner() {
  const [data, setData] = useState<{
    divergence_pair: string;
    strong_currency: string;
    weak_currency: string;
    macro_spread: number;
    rollover_window_active: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/v1/top-pairs')
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-[#0a0f16] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-semibold text-slate-300">Greatest Macro Divergence:</span>
        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
          {data.divergence_pair} ({data.strong_currency} Strong / {data.weak_currency} Weak)
        </span>
        <span className="text-slate-400 font-mono hidden sm:inline">
          Divergence Delta: +{data.macro_spread} pts
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] font-mono">
        {data.rollover_window_active ? (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <BrandGlyph name="clock" size={12} /> NY Rollover Window Active (20:45–22:15 UTC)
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.08]">
            Standard Interbank Liquidity Window
          </span>
        )}
      </div>
    </div>
  );
}
