'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import {
  runWalkForwardAnalysis,
  runMonteCarloStressSimulation,
  parseMt5ReportCsv,
  type TradeInput,
} from '@/lib/quant/monteCarloEngine';
import { RESEARCH_OBJECTIVES } from '@/lib/quant/researchObjectives';

type BrokerDeal = {
  account_key: string;
  position_id: string | null;
  symbol: string;
  side: string;
  entry_type: string;
  volume: number;
  profit: number;
  commission: number;
  swap: number;
  fee: number;
  deal_time_server: string;
};

type BrokerAccount = {
  account_key: string;
  account_login: string;
  broker: string | null;
  server: string;
  account_mode: string;
  currency: string;
  positions: Array<{ positionId: string | null }>;
};

type AccountResponse = {
  accounts?: BrokerAccount[];
  deals?: BrokerDeal[];
  error?: string;
};

const moneyNumber = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

const netDeal = (deal: BrokerDeal) =>
  Number(deal.profit) + Number(deal.commission) + Number(deal.swap) + Number(deal.fee);

const closesPosition = (deal: BrokerDeal) => ['OUT', 'OUT_BY', 'INOUT'].includes(deal.entry_type);

const statusLabel = (status: string) => {
  if (status === 'ROBUST_CANDIDATE') return 'ROBUST CANDIDATE · NOT APPROVED';
  if (status === 'MODERATE_DEGRADATION') return 'EDGE DEGRADATION / REVIEW';
  if (status === 'OVERFITTED_FAILURE') return 'OUT-OF-SAMPLE FAILURE';
  return 'INSUFFICIENT VALIDATION SAMPLE';
};

export default function StrategyValidationPage() {
  const [trades, setTrades] = useState<TradeInput[]>([]);
  const [dataSourceName, setDataSourceName] = useState('NO DATASET LOADED');
  const [startingBalanceInput, setStartingBalanceInput] = useState('');
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [sourceType, setSourceType] = useState<'NONE' | 'MT5_LINKED_HISTORY' | 'MT5_BACKTEST_CSV'>('NONE');
  const [currency, setCurrency] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem('fidulync-validation-starting-balance-v1');
      if (saved && Number.isFinite(Number(saved)) && Number(saved) > 0) {
        setStartingBalanceInput(saved);
        setStartingBalance(Number(saved));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const loadLinkedAccountHistory = useCallback(async () => {
    const token = window.sessionStorage.getItem('macrolinc-account-read-token') ?? '';
    const selectedKey = window.sessionStorage.getItem('macrolinc-selected-account-key') ?? '';
    if (!token || !selectedKey) {
      setError('Connect and select your MT5 account in the Accounts workspace first.');
      return;
    }
    setLoadingAccount(true);
    setError('');
    setStatusMessage('');
    try {
      const response = await fetch('/api/v1/accounts', {
        cache: 'no-store',
        headers: { Authorization: 'Bearer ' + token },
      });
      const payload = await response.json() as AccountResponse;
      if (!response.ok) throw new Error(payload.error ?? 'Private MT5 account history is unavailable.');
      const account = payload.accounts?.find((item) => item.account_key === selectedKey);
      if (!account) throw new Error('The selected MT5 account is not available. Re-select it in the Accounts workspace.');
      if (account.account_mode !== 'REAL') {
        throw new Error('Only linked REAL account history can be loaded here. DEMO and contest history are excluded from live research validation.');
      }

      const openIds = new Set(account.positions.map((position) => position.positionId).filter((value): value is string => Boolean(value)));
      const grouped = new Map<string, BrokerDeal[]>();
      (payload.deals ?? []).filter((deal) => deal.account_key === selectedKey).forEach((deal) => {
        if (!deal.position_id) return;
        const rows = grouped.get(deal.position_id) ?? [];
        rows.push(deal);
        grouped.set(deal.position_id, rows);
      });

      const loaded: TradeInput[] = [];
      for (const [positionId, rows] of grouped.entries()) {
        if (openIds.has(positionId)) continue;
        const entry = rows.find((deal) => deal.entry_type === 'IN' && ['BUY', 'SELL'].includes(deal.side));
        const exits = rows.filter(closesPosition).sort((a, b) => a.deal_time_server.localeCompare(b.deal_time_server));
        if (!entry || exits.length === 0) continue;
        const exit = exits[exits.length - 1];
        loaded.push({
          ticket: positionId,
          symbol: entry.symbol,
          direction: entry.side === 'BUY' ? 'BUY' : 'SELL',
          volume: rows.filter((deal) => deal.entry_type === 'IN').reduce((sum, deal) => sum + Number(deal.volume), 0),
          profit: rows.reduce((sum, deal) => sum + netDeal(deal), 0),
          closeTime: exit.deal_time_server,
        });
      }

      loaded.sort((a, b) => (a.closeTime ?? '').localeCompare(b.closeTime ?? ''));
      if (!loaded.length) throw new Error('No reconciled closed positions were found in the linked account deal sample.');
      setTrades(loaded);
      setCurrency(account.currency);
      setSourceType('MT5_LINKED_HISTORY');
      setDataSourceName(`MT5 linked account · ${account.broker ?? 'Broker'} · ${account.account_login} · ${loaded.length} reconciled closed positions`);
      setStatusMessage('Loaded a recent broker-sourced deal sample. The API retains up to 500 recent deal records; this is descriptive account history, not a full historical backtest. Initial stop-loss risk is not included in deal history, so realised R-multiple and 1:2 risk/reward validation remain unavailable until a tester report supplies initial risk data.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load linked MT5 account history.');
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setStatusMessage('');
    try {
      const text = await file.text();
      const parsed = parseMt5ReportCsv(text);
      if (!parsed.length) {
        throw new Error('No valid MT5 closed-trade rows found. Required columns: ticket/position, symbol, type, volume, profit. Include close time for walk-forward analysis and R-multiple or initial stop-loss for 1:2 risk validation.');
      }
      setTrades(parsed);
      setDataSourceName(file.name);
      setSourceType('MT5_BACKTEST_CSV');
      setCurrency(null);
      setStatusMessage(`Imported ${parsed.length} rows from the supplied MT5 report. Verify that the file contains closed trades only, complete timestamps and initial stop-loss/R-multiple data before interpreting the validation output.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not parse the MT5 report.');
    }
    event.target.value = '';
  };

  const saveStartingBalance = () => {
    const value = Number(startingBalanceInput);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the actual starting balance at the beginning of this trade sample.');
      return;
    }
    window.localStorage.setItem('fidulync-validation-starting-balance-v1', String(value));
    setStartingBalance(value);
    setError('');
    setStatusMessage('Starting balance saved as a user-supplied analysis input. It is not broker-verified and does not approve live trading.');
  };

  const clearDataset = () => {
    setTrades([]);
    setDataSourceName('NO DATASET LOADED');
    setSourceType('NONE');
    setCurrency(null);
    setStatusMessage('');
    setError('');
  };

  const walkForward = useMemo(
    () => runWalkForwardAnalysis(trades, startingBalance ?? 0),
    [trades, startingBalance],
  );

  const monteCarlo = useMemo(() => {
    if (startingBalance === null || trades.length < 30) return null;
    return runMonteCarloStressSimulation(trades, startingBalance, 1000);
  }, [trades, startingBalance]);

  const rCoverage = trades.length
    ? trades.filter((trade) => typeof trade.rMultiple === 'number' && Number.isFinite(trade.rMultiple)).length / trades.length * 100
    : 0;

  const sourceNote = sourceType === 'MT5_LINKED_HISTORY'
    ? 'RECENT LIVE ACCOUNT DEAL SAMPLE · MAX 500 DEALS · NOT A POINT-IN-TIME BACKTEST'
    : sourceType === 'MT5_BACKTEST_CSV'
      ? 'USER-IMPORTED MT5 TESTER / STATEMENT FILE · VERIFY REPORT PERIOD AND TESTER SETTINGS'
      : 'NO VERIFIED TRADE DATASET';

  return (
    <main className="min-h-screen bg-[#070b12] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">MacroLync · Quant Research</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Strategy Validation & Risk Lab</h1>
            <p className="mt-1 text-sm text-slate-400">Out-of-sample performance, execution-cost sensitivity and reproducible path-risk analysis.</p>
          </div>
          <Link href="/accounts" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Open linked MT5 account
          </Link>
        </div>

        <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.035] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-300">Research objectives · targets, not results</p>
              <h2 className="mt-1 text-lg font-semibold">Balanced growth with controlled drawdown</h2>
            </div>
            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-mono text-amber-200">NOT VALIDATED</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] font-mono text-slate-500">TARGET WIN RATE</p><p className="mt-1 text-xl font-semibold">{(RESEARCH_OBJECTIVES.targetWinRateMin * 100).toFixed(0)}–{(RESEARCH_OBJECTIVES.targetWinRateMax * 100).toFixed(0)}%</p></div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] font-mono text-slate-500">PLANNED REWARD / RISK</p><p className="mt-1 text-xl font-semibold">1:{RESEARCH_OBJECTIVES.plannedRewardRisk}</p></div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] font-mono text-slate-500">SETUP POLICY</p><p className="mt-1 text-sm font-semibold">{RESEARCH_OBJECTIVES.setupPolicy.replaceAll('_', ' ')}</p></div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"><p className="text-[10px] font-mono text-slate-500">DAILY TRADE QUOTA</p><p className="mt-1 text-sm font-semibold">{RESEARCH_OBJECTIVES.dailyTradeQuota === null ? 'None' : RESEARCH_OBJECTIVES.dailyTradeQuota}</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            These objectives are not achieved performance claims. Formal approval requires at least {RESEARCH_OBJECTIVES.minimumOutOfSampleTrades} chronological out-of-sample trades across {RESEARCH_OBJECTIVES.minimumWalkForwardFolds} expanding walk-forward folds, point-in-time macro integrity, real-broker execution evidence and independent report approval.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Real trade data only</h2>
              <p className="mt-1 text-xs text-slate-400">Load reconciled closed deals from the linked real MT5 account or import an MT5 tester/report CSV. No manual trade journal or synthetic dataset is used.</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-mono text-slate-300">{trades.length} TRADES LOADED</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => void loadLinkedAccountHistory()} disabled={loadingAccount}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {loadingAccount ? 'Loading MT5 history…' : 'Load linked REAL MT5 history'}
            </button>
            <label className="cursor-pointer rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
              Import MT5 report CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </label>
            <button onClick={clearDataset} disabled={!trades.length} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40">
              Clear dataset
            </button>
          </div>
          <p className="mt-3 break-words font-mono text-[11px] text-slate-500">{dataSourceName}</p>
          <p className="mt-1 text-[10px] text-slate-500">Trade currency: {currency ?? 'Not supplied by imported CSV'} · initial balance input must use the same currency.</p>
          <p className="mt-1 text-[10px] font-mono text-slate-600">{sourceNote}</p>
          {statusMessage && <p className="mt-3 text-xs leading-5 text-cyan-200">{statusMessage}</p>}
          {error && <p className="mt-3 text-xs leading-5 text-rose-300">{error}</p>}
        </section>

        <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Initial capital for drawdown calculations</h2>
              <p className="mt-1 text-xs text-slate-400">Enter the balance at the beginning of the imported trade sample, in the same currency as the trade P/L.</p>
            </div>
            <span className="rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-mono text-amber-200">USER-SUPPLIED · NOT VERIFIED</span>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input type="number" min="0" step="0.01" value={startingBalanceInput}
              onChange={(event) => setStartingBalanceInput(event.target.value)}
              placeholder="Enter actual initial balance"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400" />
            <button onClick={saveStartingBalance} className="rounded-lg border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-400/10">
              Save analysis input
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Linked MT5 history does not contain the starting balance at the beginning of the sample. Use the original broker statement value; the current balance is not substituted.</p>
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="font-mono text-[10px] tracking-widest text-cyan-300">01 / OUT-OF-SAMPLE</p><h2 className="mt-1 text-lg font-semibold">Three-fold expanding walk-forward</h2></div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-mono text-slate-300">{statusLabel(walkForward.status)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">OOS TRADES</p><p className="mt-1 text-xl font-semibold">{walkForward.outOfSampleTrades} / {walkForward.minimumOutOfSampleTrades}</p></div>
              <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">FOLDS</p><p className="mt-1 text-xl font-semibold">{walkForward.foldCount} / {walkForward.minimumWalkForwardFolds}</p></div>
              <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">OOS WIN RATE</p><p className="mt-1 text-xl font-semibold">{walkForward.outOfSample.tradesCount ? moneyNumber(walkForward.outOfSample.winRatePct) + '%' : '—'}</p></div>
              <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">95% WIN-RATE LOWER BOUND</p><p className="mt-1 text-xl font-semibold">{walkForward.outOfSample.winRateWilson95LowerPct === null ? '—' : moneyNumber(walkForward.outOfSample.winRateWilson95LowerPct) + '%'}</p></div>
              <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">REALIZED R MULTIPLE R:R</p><p className="mt-1 text-xl font-semibold">{walkForward.outOfSample.realizedRewardRisk === null ? 'UNAVAILABLE' : '1:' + moneyNumber(walkForward.outOfSample.realizedRewardRisk)}</p></div>
              <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">OOS PROFIT FACTOR</p><p className="mt-1 text-xl font-semibold">{walkForward.outOfSample.profitFactor === null ? '—' : moneyNumber(walkForward.outOfSample.profitFactor)}</p></div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-slate-400">
              <p>Walk-forward efficiency: <b className="text-slate-200">{walkForward.walkForwardEfficiencyPct === null ? 'Unavailable' : moneyNumber(walkForward.walkForwardEfficiencyPct) + '%'}</b></p>
              <p>Win-rate objective: <b className="text-slate-200">{walkForward.targetWinRateBand.replaceAll('_', ' ')}</b> · 1:2 R objective: <b className="text-slate-200">{walkForward.targetRewardRiskMet ? 'MET IN THIS SAMPLE' : 'NOT VERIFIED'}</b></p>
              <p>Chronological close timestamps: <b className="text-slate-200">{walkForward.chronologicalDataVerified ? 'PRESENT' : 'MISSING / UNVERIFIED'}</b></p>
              <p>R-multiple coverage: <b className="text-slate-200">{moneyNumber(rCoverage)}%</b> · cash average win/loss is not substituted for risk/reward.</p>
              <p>OOS max drawdown: <b className="text-slate-200">{moneyNumber(walkForward.outOfSample.maxDrawdownPct)}%</b> · average payoff ratio: <b className="text-slate-200">{walkForward.outOfSample.averagePayoffRatio === null ? 'Unavailable' : moneyNumber(walkForward.outOfSample.averagePayoffRatio)}</b></p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="py-2">Fold</th><th>Training</th><th>OOS</th><th>OOS Win%</th><th>OOS PF</th><th>WFE</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {walkForward.folds.map((fold) => (
                    <tr key={fold.fold}><td className="py-2">{fold.fold}</td><td>{fold.trainingTrades}</td><td>{fold.outOfSampleTrades}</td><td>{moneyNumber(fold.outOfSample.winRatePct)}%</td><td>{fold.outOfSample.profitFactor === null ? '—' : moneyNumber(fold.outOfSample.profitFactor)}</td><td>{fold.efficiencyPct === null ? '—' : moneyNumber(fold.efficiencyPct) + '%'}</td></tr>
                  ))}
                  {!walkForward.folds.length && <tr><td colSpan={6} className="py-5 text-center text-slate-500">No qualifying chronological sample. Required: 3 folds and at least 300 out-of-sample trades.</td></tr>}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div><p className="font-mono text-[10px] tracking-widest text-cyan-300">02 / PATH RISK</p><h2 className="mt-1 text-lg font-semibold">Deterministic circular block bootstrap</h2></div>
            {monteCarlo ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">95TH PERCENTILE MAX DD</p><p className="mt-1 text-xl font-semibold">{moneyNumber(monteCarlo.ninetyFifthPercentileDrawdownPct)}%</p></div>
                  <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">MEDIAN MAX DD</p><p className="mt-1 text-xl font-semibold">{moneyNumber(monteCarlo.medianDrawdownPct)}%</p></div>
                  <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">WORST RESAMPLED PATH</p><p className="mt-1 text-xl font-semibold">{moneyNumber(monteCarlo.worstCaseDrawdownPct)}%</p></div>
                  <div className="rounded-lg bg-slate-950/70 p-3"><p className="text-[10px] font-mono text-slate-500">BOOTSTRAP RUNS</p><p className="mt-1 text-xl font-semibold">{monteCarlo.totalRuns.toLocaleString()}</p></div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <p>Method: <b className="text-slate-200">{monteCarlo.stressParameters.bootstrapMethod}</b> · block length: <b className="text-slate-200">{monteCarlo.stressParameters.blockLength}</b> trades.</p>
                  <p>Deterministic seed: <code className="text-slate-300">{monteCarlo.stressParameters.deterministicSeed}</code></p>
                  <p>Resampling preserves short-range trade ordering within circular blocks. It is a historical path stress test, not a forecast or probability guarantee.</p>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
                {trades.length < 30 ? 'At least 30 real closed trades are required for block-bootstrap analysis.' : 'Enter the initial balance at the beginning of this sample to calculate drawdown paths.'}
              </div>
            )}
          </article>
        </section>

        <section className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.035] p-5">
          <p className="font-mono text-[10px] tracking-widest text-amber-200">GOVERNANCE / LIVE APPROVAL</p>
          <h2 className="mt-1 text-lg font-semibold">This lab does not approve a strategy for live execution</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            A candidate result is only a research screen. MacroLync remains fail-closed until the server-side validation gate receives a version-bound, independently reviewed report; at least {RESEARCH_OBJECTIVES.minimumOutOfSampleTrades} OOS trades across {RESEARCH_OBJECTIVES.minimumWalkForwardFolds} folds; a 95% Wilson win-rate lower bound meeting the target; genuine per-trade R multiples confirming the 1:2 objective; point-in-time release/vintage integrity; verified real-broker market data; realistic spread, commission, swap and slippage stress; and drawdown approval. No performance target is assumed achievable.
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Linked account deal history is limited to a recent sample and lacks initial stop-loss risk. Use a complete MT5 Strategy Tester report with chronological timestamps and initial SL or explicit R-multiples for formal testing.
          </p>
        </section>
      </div>
    </main>
  );
}
