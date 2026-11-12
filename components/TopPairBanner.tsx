'use client';

import React, { useEffect, useState } from 'react';

export default function TopPairBanner() {
  const [data, setData] = useState<{
    top_executable_pair: string;
    recommended_direction: string;
    csi_spread: number;
    rollover_blackout: boolean;
    safe_to_trade: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/v1/top-pairs')
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {});
  }, []);

  if (!data) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-semibold text-emerald-300">Top Executable G8 Pair:</span>
        <span className="px-2 py-0.5 rounded bg-emerald-900/60 font-mono text-white font-bold">
          {data.top_executable_pair} ({data.recommended_direction})
        </span>
        <span className="text-zinc-400 text-xs hidden sm:inline">
          Spread: +{data.csi_spread} CSI pts
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {data.rollover_blackout ? (
          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40">
            Rollover Guard Active (20:45–22:15 UTC)
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-600/30">
            NY Rollover Window Clear
          </span>
        )}
      </div>
    </div>
  );
}
