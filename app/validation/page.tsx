'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [startingBalanceInput, setStartingBalanceInput] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem('macrolinc-manual-account-balance-v1');
        const modeEnabled = window.localStorage.getItem('fidulync-manual-desk-mode-v1') === 'true';
        if (!modeEnabled || !raw) return;
        const saved = JSON.parse(raw) as { balance?: number };
        if (typeof saved.balance === 'number' && Number.isFinite(saved.balance) && saved.balance > 0) {
          setStartingBalance(saved.balance);
          setStartingBalanceInput(String(saved.balance));
        }
      } catch {
        setStartingBalance(null);
        setStartingBalanceInput('');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const saveStartingBalance = () => {
    const value = Number(startingBalanceInput);
    if (window.localStorage.getItem('fidulync-manual-desk-mode-v1') !== 'true') {
      setStatusMessage('Enable Verified Manual Desk Mode before saving a user-attested starting balance.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setStartingBalance(null);
      setStatusMessage('Enter a valid positive real starting balance.');
      return;
    }
    try {
      window.localStorage.setItem('macrolinc-manual-account-balance-v1', JSON.stringify({
        balance: value, currency: 'USD', savedAtUtc: new Date().toISOString(), source: 'USER_ATTESTED_MANUAL',
      }));
      setStartingBalance(value);
      setStatusMessage(null);
    } catch {
      setStartingBalance(null);
      setStatusMessage('Browser storage unavailable. Starting balance remains unverified.');
    }
  };

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
        volume?: number;
        profit: number;
        rUnits?: number;
        rMultiple?: number;
      }>;

      if (!Array.isArray(parsed) || parsed.length === 0) {
        setStatusMessage('Manual ledger is empty. Add verified trades to run simulation.');
        return;
      }

      const formatted: TradeInput[] = parsed
        .filter((trade) => trade.ticket !== undefined && trade.ticket !== null
          && typeof trade.volume === 'number' && Number.isFinite(trade.volume) && trade.volume > 0
          && Number.isFinite(trade.profit))
        .map((trade) => ({
          ticket: trade.ticket,
          symbol: trade.symbol,
          direction: trade.direction,
          volume: trade.volume as number,
          profit: trade.profit,
          rMultiple: typeof trade.rUnits === 'number' && Number.isFinite(trade.rUnits)
            ? trade.rUnits : trade.rMultiple,
        }));
      if (formatted.length === 0) {
        setStatusMessage('Manual ledger has no trades with actual ticket, volume and net P&L evidence.');
        return;
      }

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
    if (trades.length < 20 || startingBalance === null) return null;
    return runWalkForwardAnalysis(trades, startingBalance, 0.7);
  }, [trades, startingBalance]);

  const monteCarlo = useMemo(() => {
    if (trades.length === 0) return null;
    if (startingBalance === null) return null;
    return runMonteCarloStressSimulation(trades, startingBalance, 1000);
  }, [trades, startingBalance]);

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
              Bootstrap resampling of imported trade outcomes only. No synthetic spread, slippage or account-balance assumptions.
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

        <div className="bg-[#0b0e14] border border-slate-800 rounded-lg p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="validation-starting-balance" className="block text-xs text-slate-400 mb-1">Verified Manual Starting Balance (USD)</label>
            <input id="validation-starting-balance" type="number" min="0.01" step="0.01" value={startingBalanceInput}
              onChange={(event) => setStartingBalanceInput(event.target.value)} placeholder="Enter real $" 
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white" />
          </div>
          <button type="button" onClick={saveStartingBalance} disabled={!startingBalanceInput.trim()}
            className="px-4 py-2 bg-amber-950 border border-amber-700 rounded text-xs font-semibold text-amber-200 disabled:opacity-40">SAVE REAL STARTING BALANCE</button>
          <span className="text-xs text-slate-400">{startingBalance === null ? 'BALANCE NOT VERIFIED' : 'USER-ATTESTED · BROWSER LOCAL'}</span>
        </div>
        {trades.length > 0 && startingBalance === null && <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4 text-xs text-amber-200">NO VERIFIED STARTING BALANCE — SAVE YOUR REAL STARTING BALANCE IN VERIFIED MANUAL DESK MODE BEFORE CALCULATING DRAWDOWN OR MONTE CARLO.</div>}
        {trades.length > 0 && startingBalance !== null && trades.length < 20 && <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">INSUFFICIENT VERIFIED TRADE HISTORY — 20 OR MORE RECONCILED TRADES ARE REQUIRED FOR WALK-FORWARD CLASSIFICATION. No performance grade is published.</div>}
        {/* Zero-Mock State Notice */}
        {trades.length === 0 ? (
          <div className="bg-[#0b0e14] border border-dashed border-slate-800 rounded-lg p-8 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-300">
              NO VERIFIED TRADE HISTORY — IMPORT MT5 REPORT OR LOG REAL TRADES TO RUN MONTE CARLO
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
                  1,000-Run Historical Trade-Sequence Bootstrap
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Resamples only imported, reconciled trade P&L in randomized order. This is a historical sequence sensitivity analysis, not a market forecast.
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
                      95th percentile drawdown across bootstrap sequences of the imported trade outcomes.
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
                  <span className="text-slate-300 font-semibold">Stress Conditions Applied:</span> Randomized resampling of recorded net trade outcomes only
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
