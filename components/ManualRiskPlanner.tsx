'use client';

import { useMemo, useState } from 'react';
import { calculateBrokerAwareVolume } from '@/lib/quantGovernance';

const instruments = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF', 'NZDUSD', 'XAUUSD'];

type Draft = {
  equity: string;
  riskPct: string;
  entry: string;
  stop: string;
  target: string;
  tickSize: string;
  tickValue: string;
  volumeMin: string;
  volumeMax: string;
  volumeStep: string;
  contractSize: string;
};

const initialDraft: Draft = {
  equity: '1000',
  riskPct: '0.25',
  entry: '',
  stop: '',
  target: '',
  tickSize: '',
  tickValue: '',
  volumeMin: '0.01',
  volumeMax: '100',
  volumeStep: '0.01',
  contractSize: '',
};

function numeric(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function money(value: number): string {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
}

export default function ManualRiskPlanner() {
  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [specVerified, setSpecVerified] = useState(false);

  const update = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (['tickSize', 'tickValue', 'volumeMin', 'volumeMax', 'volumeStep', 'contractSize'].includes(key)) {
      setSpecVerified(false);
    }
  };

  const analysis = useMemo(() => {
    const equity = numeric(draft.equity);
    const riskPct = numeric(draft.riskPct);
    const entry = numeric(draft.entry);
    const stop = numeric(draft.stop);
    const target = numeric(draft.target);
    const stopDistance = Math.abs(entry - stop);
    const rewardRisk = stopDistance > 0 ? Math.abs(target - entry) / stopDistance : Number.NaN;
    const directionValid = side === 'BUY'
      ? stop < entry && target > entry
      : stop > entry && target < entry;

    if (![equity, riskPct, entry, stop, target].every(Number.isFinite)
      || equity <= 0 || riskPct <= 0 || riskPct > 100 || !directionValid) {
      return { valid: false, reason: 'Enter valid equity, risk, entry, stop and target prices in the correct trade direction.', rewardRisk: null, volume: null };
    }
    if (!specVerified) {
      return { valid: false, reason: 'Verify the tick size, tick value, contract size and volume limits from your broker before calculating.', rewardRisk, volume: null };
    }

    const volume = calculateBrokerAwareVolume({
      equity,
      riskPct,
      entryPrice: entry,
      stopLoss: stop,
      specification: {
        symbol,
        tickSize: numeric(draft.tickSize),
        tickValuePerLot: numeric(draft.tickValue),
        volumeMin: numeric(draft.volumeMin),
        volumeMax: numeric(draft.volumeMax),
        volumeStep: numeric(draft.volumeStep),
        contractSize: numeric(draft.contractSize),
        stopLevelPoints: 0,
        point: numeric(draft.tickSize),
        verified: true,
      },
    });
    return { valid: volume.valid, reason: volume.reason, rewardRisk, volume };
  }, [draft, side, symbol, specVerified]);

  const fields: Array<{ key: keyof Draft; label: string; hint: string; step?: string }> = [
    { key: 'equity', label: 'Account equity', hint: 'Account currency' },
    { key: 'riskPct', label: 'Risk ceiling (%)', hint: 'Personal risk budget', step: '0.01' },
    { key: 'entry', label: 'Entry price', hint: 'Planned entry', step: 'any' },
    { key: 'stop', label: 'Stop loss', hint: 'Protective stop', step: 'any' },
    { key: 'target', label: 'Take profit', hint: 'Planned target', step: 'any' },
    { key: 'tickSize', label: 'Broker tick size', hint: 'From MT5 symbol specification', step: 'any' },
    { key: 'tickValue', label: 'Tick value per 1 lot', hint: 'In your account currency', step: 'any' },
    { key: 'volumeMin', label: 'Minimum volume', hint: 'Broker minimum', step: 'any' },
    { key: 'volumeMax', label: 'Maximum volume', hint: 'Broker maximum', step: 'any' },
    { key: 'volumeStep', label: 'Volume step', hint: 'Broker lot increment', step: 'any' },
    { key: 'contractSize', label: 'Contract size', hint: 'From MT5 symbol specification', step: 'any' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-[0.2em] text-emerald-400">RISKLYNC / MANUAL TRADE PLANNER</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Plan the risk before the trade.</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-400">
          Broker-aware position sizing for discretionary analysis. This planner does not connect to your broker or place orders.
          It will not guess metal or FX tick values.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-2xl border border-white/10 bg-[#0b111b] p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap gap-3">
            <label className="min-w-40 flex-1 space-y-1.5 text-xs text-slate-400">
              Instrument
              <select value={symbol} onChange={(event) => { setSymbol(event.target.value); setSpecVerified(false); }} className="w-full rounded-lg border border-white/10 bg-[#080d15] px-3 py-3 text-sm text-white">
                {instruments.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="min-w-40 flex-1 space-y-1.5 text-xs text-slate-400">
              Direction
              <select value={side} onChange={(event) => setSide(event.target.value as 'BUY' | 'SELL')} className="w-full rounded-lg border border-white/10 bg-[#080d15] px-3 py-3 text-sm text-white">
                <option value="BUY">BUY / LONG</option>
                <option value="SELL">SELL / SHORT</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, hint, step }) => (
              <label key={key} className="space-y-1.5 text-xs text-slate-400">
                {label}
                <input
                  type="number"
                  inputMode="decimal"
                  step={step ?? 'any'}
                  value={draft[key]}
                  onChange={(event) => update(key, event.target.value)}
                  placeholder="Enter value"
                  className="w-full rounded-lg border border-white/10 bg-[#080d15] px-3 py-3 font-mono text-sm text-white outline-none focus:border-emerald-500/60"
                />
                <span className="block text-[10px] text-slate-500">{hint}</span>
              </label>
            ))}
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs leading-5 text-amber-100/80">
            <input type="checkbox" checked={specVerified} onChange={(event) => setSpecVerified(event.target.checked)} className="mt-1 accent-emerald-400" />
            <span><strong className="text-amber-100">I verified these symbol specifications in my broker's MT5 terminal.</strong><br />Tick value must be expressed in the account currency and correspond to one lot. Changing a specification field clears this confirmation.</span>
          </label>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-[#0b111b] p-5 sm:p-6">
            <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">CALCULATION OUTPUT</p>
            <p className="mt-4 text-xs text-slate-400">Suggested volume</p>
            <p className="mt-1 font-mono text-4xl font-semibold text-white">{analysis.valid && analysis.volume ? analysis.volume.volume.toFixed(2) : '—'} <span className="text-base text-slate-500">lots</span></p>
            <div className="my-5 border-t border-white/10" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-400">Estimated cash risk</span><strong className="font-mono text-white">{analysis.valid && analysis.volume ? money(analysis.volume.riskCash) : '—'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Risk budget</span><strong className="font-mono text-white">{money(numeric(draft.equity) * numeric(draft.riskPct) / 100)}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400">Reward / risk</span><strong className="font-mono text-white">{analysis.rewardRisk && Number.isFinite(analysis.rewardRisk) ? analysis.rewardRisk.toFixed(2) + 'R' : '—'}</strong></div>
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-400">
              {analysis.valid ? 'Volume is rounded down to the broker step. Estimated risk excludes commission, swap, slippage and gaps.' : analysis.reason}
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-[#0b111b] p-5">
            <p className="font-mono text-[10px] tracking-[0.18em] text-slate-500">RISK DISCIPLINE</p>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
              <li>• Minimum lot is rejected if it exceeds the risk budget.</li>
              <li>• Broker tick values and contract sizes must be verified per symbol.</li>
              <li>• This is a planning estimate, not an execution approval.</li>
              <li>• Always attach a broker-side stop before dispatch.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
