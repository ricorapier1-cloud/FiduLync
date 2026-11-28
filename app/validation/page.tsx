'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  runWalkForwardAnalysis,
  runMonteCarloStressSimulation,
  parseMt5ReportCsv,
  type TradeInput,
  // type WalkForwardAnalysis,
  // type MonteCarloSimulationResult,
} from '@/lib/quant/monteCarloEngine';

export default function ValidationPage() {
  const [trades, setTrades] = useState<TradeInput[]>([]);
  const [dataSourceName, setDataSourceName] = useState<string | null>(null);
  const [rawCsvText, setRawCsvText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load from verified browser manual ledger if available
  const handleLoadManualLedger = () => {
    try {
      const stored = localStorage.getItem('fidulync-manual-trades-history-v1');
      if (!stored) {
        setStatusMessage('No trades found in Verified Manual Ledger. Record trades in Portfolio & Accounts first.');
        return;
      }
      const parsed = JSON.parse(stored) as Array<{
        ticket: string | number;
        symbol: string;
        direction: 'BUY' | 'SELL';
        volume: number;
        profit: number;
        rMultiple?: number;
      }>;

      if (!Array.isArray(parsed) || parsed.length === 0) {
        setStatusMessage('Manual ledger is empty. Add verified trades to run simulation.');
        return;
      }

      const formatted: TradeInput[] = parsed.map((t, idx) => ({
        ticket: t.ticket || idx + 1,
        symbol: t.symbol,
        direction: t.direction,
        volume: t.volume || 0.1,
        profit: t.profit,
        rMultiple: t.rMultiple,
      }));

      setTrades(formatted);
      setDataSourceName(`Verified Manual Ledger (${formatted.length} trades)`);
      setStatusMessage(null);
    } catch {
      setStatusMessage('Failed to parse manual ledger data from local storage.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const parsedTrades = parseMt5ReportCsv(text);
      if (parsedTrades.length === 0) {
        setStatusMessage('No valid trades found in file. Ensure MT5 tester CSV contains Symbol and Profit columns.');
        return;
      }
      setTrades(parsedTrades);
      setDataSourceName(`MT5 File: ${file.name} (${parsedTrades.length} trades)`);
      setStatusMessage(null);
    };
    reader.readAsText(file);
  };

  const handleParsePastedCsv = () => {
    if (!rawCsvText.trim()) return;
    const parsedTrades = parseMt5ReportCsv(rawCsvText);
    if (parsedTrades.length === 0) {
      setStatusMessage('No valid trades recognized in pasted text.');
      return;
    }
    setTrades(parsedTrades);
    setDataSourceName(`Pasted CSV / Text (${parsedTrades.length} trades)`);
    setStatusMessage(null);
  };

  const walkForward = useMemo(() => {
    if (trades.length === 0) return null;
    return runWalkForwardAnalysis(trades, 0.7);
  }, [trades]);

  const monteCarlo = useMemo(() => {
    if (trades.length === 0) return null;
    return runMonteCarloStressSimulation(trades, 1000);
  }, [trades]);

  return (
    <main className="min-h-screen bg-[#07090e] text-slate-100 p-4 md:p-8 font-mono">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-teal-400 font-semibold transition"
              >
                ← Terminal
              </Link>
              <Link
                href="/workbench"
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-semibold transition"
              >
                Workbench
              </Link>
              <Link
                href="/accounts"
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 font-semibold transition"
              >
                Accounts &amp; Ledger
              </Link>
            </div>
            <h1 className="text-xl md:text-2xl font-bold mt-2 text-white">
              Quantitative Out-of-Sample &amp; Monte Carlo Stress Engine
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Strict Zero-Mock Data Integrity: 1,000-iteration bootstrap resampling + 50% spread shock + randomized slippage shock.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
              FAIL-CLOSED GOVERNANCE
            </span>
          </div>
        </div>

        {/* Data Source Selection Bar */}
        <div className="bg-[#0b0e14] border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Active Dataset Source</div>
              <div className="text-sm font-bold text-white mt-1">
                {dataSourceName ? (
                  <span className="text-emerald-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    {dataSourceName}
                  </span>
                ) : (
                  <span className="text-amber-400">AWAITING VERIFIED DATA IMPORT</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleLoadManualLedger}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-semibold text-teal-300 transition"
              >
                Load From Verified Manual Ledger
              </button>
              <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-semibold text-slate-200 cursor-pointer transition">
                Import MT5 Backtest CSV
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {trades.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTrades([]);
                    setDataSourceName(null);
                    setStatusMessage(null);
                  }}
                  className="px-3 py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-800 rounded text-xs font-semibold text-red-300 transition"
                >
                  Clear Data
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Paste Area */}
          {!trades.length && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="text-xs text-slate-400">Or paste raw MT5 trade report lines:</div>
              <div className="flex gap-2">
                <textarea
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  placeholder="Paste MT5 backtest CSV rows (Ticket, Symbol, Type, Volume, Profit...)"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 h-16 font-mono resize-none focus:outline-none focus:border-slate-600"
                />
                <button
                  type="button"
                  onClick={handleParsePastedCsv}
                  disabled={!rawCsvText.trim()}
                  className="px-4 bg-teal-900 hover:bg-teal-800 disabled:opacity-50 border border-teal-700 rounded text-xs font-semibold text-teal-100 transition"
                >
                  Parse &amp; Run
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 p-2 rounded">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Zero-Mock State Notice */}
        {trades.length === 0 ? (
          <div className="bg-[#0b0e14] border border-dashed border-slate-800 rounded-lg p-8 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-300">
              No Simulated, Demo or Hardcoded Validation Numbers Published
            </div>
            <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
              In accordance with the strict zero-mock data integrity rule, historical walk-forward metrics and Monte Carlo stress distributions are only computed against authenticated MT5 backtest CSV records or verified manual ledger journal trades.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadManualLedger}
                className="px-4 py-2 bg-teal-950 hover:bg-teal-900 border border-teal-700 text-teal-300 rounded text-xs font-semibold transition"
              >
                Load From Verified Manual Ledger
              </button>
              <Link
                href="/accounts"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs font-semibold transition"
              >
                Open Portfolio &amp; Record Trades →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Walk-Forward 70/30 Grid */}
            <div className="bg-[#0b0e14] border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Walk-Forward Efficiency (70% In-Sample / 30% Out-of-Sample)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluates out-of-sample edge decay and overfitting without forward curve-fitting.
                  </p>
                </div>
                {walkForward && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">EDGE STATUS:</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-bold ${
                        walkForward.status === 'ROBUST_EDGE'
                          ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                          : walkForward.status === 'MODERATE_DEGRADATION'
                          ? 'bg-amber-950 border border-amber-700 text-amber-300'
                          : walkForward.status === 'OVERFITTED_FAILURE'
                          ? 'bg-rose-950 border border-rose-700 text-rose-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {walkForward.status}
                    </span>
                  </div>
                )}
              </div>

              {walkForward && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* In-Sample 70% Card */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                      <span className="text-slate-400 font-bold">70% IN-SAMPLE (OPTIMIZED)</span>
                      <span className="text-slate-300">{walkForward.inSampleTrades} trades</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500">Win Rate:</div>
                        <div className="text-white font-bold">{walkForward.inSample.winRatePct}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Profit Factor:</div>
                        <div className="text-white font-bold">{walkForward.inSample.profitFactor}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Net Profit:</div>
                        <div className="text-emerald-400 font-bold">${walkForward.inSample.netProfit.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Max Drawdown:</div>
                        <div className="text-rose-400 font-bold">{walkForward.inSample.maxDrawdownPct}%</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-slate-500">Expectancy:</div>
                        <div className="text-teal-400 font-bold">+{walkForward.inSample.expectancyR}R / trade</div>
                      </div>
                    </div>
                  </div>

                  {/* Out-of-Sample 30% Card */}
                  <div className="bg-slate-950 border border-teal-900/40 rounded p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
                      <span className="text-teal-400 font-bold">30% OUT-OF-SAMPLE (BLIND TEST)</span>
                      <span className="text-slate-300">{walkForward.outOfSampleTrades} trades</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500">Win Rate:</div>
                        <div className="text-white font-bold">{walkForward.outOfSample.winRatePct}%</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Profit Factor:</div>
                        <div className="text-white font-bold">{walkForward.outOfSample.profitFactor}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Net Profit:</div>
                        <div className="text-emerald-400 font-bold">${walkForward.outOfSample.netProfit.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Max Drawdown:</div>
                        <div className="text-rose-400 font-bold">{walkForward.outOfSample.maxDrawdownPct}%</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-slate-500">Expectancy:</div>
                        <div className="text-teal-400 font-bold">+{walkForward.outOfSample.expectancyR}R / trade</div>
                      </div>
                    </div>
                  </div>

                  {/* Walk-Forward Efficiency Comparison */}
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-4 flex flex-col justify-between">
                    <div>
                      <div className="text-xs text-slate-400 font-bold border-b border-slate-800 pb-2">
                        WALK-FORWARD EFFICIENCY (WFE)
                      </div>
                      <div className="mt-3">
                        <div className="text-3xl font-extrabold text-white">
                          {walkForward.walkForwardEfficiencyPct}%
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Ratio of blind out-of-sample expectancy to in-sample expectancy. 60%+ indicates an institutional robust edge.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                      Total validated sample: {walkForward.totalTrades} reconciled trades
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 1,000-Run Monte Carlo Stress Simulator */}
            <div className="bg-[#0b0e14] border border-slate-800 rounded-lg p-5 space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white">
                  1,000-Run Monte Carlo Tail-Risk Stress Simulation
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Simulates randomized order sequence shuffling, +50% spread widening shocks, and 0.5–2.0 pip slippage friction.
                </p>
              </div>

              {monteCarlo ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-950 border border-slate-800 rounded p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">95th-Percentile Worst DD</div>
                    <div className="text-2xl font-extrabold text-amber-400 mt-1">
                      {monteCarlo.ninetyFifthPercentileDrawdownPct}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Under 1,000 stressed permutations, 95% of runs experienced DD below this value.
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Probability of Ruin (≥20% DD)</div>
                    <div className={`text-2xl font-extrabold mt-1 ${monteCarlo.probabilityOfRuinPct <= 1.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {monteCarlo.probabilityOfRuinPct}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Simulated runs breaching catastrophic 20% drawdown limit.
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Sovereign Shield Survival</div>
                    <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                      {monteCarlo.sovereignShieldSurvivalRatePct}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Percentage of paths that respected the Sovereign Shield drawdown floor.
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Median Stressed DD</div>
                    <div className="text-2xl font-extrabold text-slate-200 mt-1">
                      {monteCarlo.medianDrawdownPct}%
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Worst single run: {monteCarlo.worstCaseDrawdownPct}%
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="bg-slate-950/60 border border-slate-800/80 rounded p-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-slate-300 font-semibold">Stress Conditions Applied:</span> Randomized Sequence Shuffling • +50% Spread Widening • 0.5–2.0 Pips Adverse Slippage Shock
                </div>
                <div>
                  1,000 Independent Iterations
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
