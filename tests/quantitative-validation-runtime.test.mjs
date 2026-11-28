import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runWalkForwardAnalysis,
  runMonteCarloStressSimulation,
  parseMt5ReportCsv,
} from '../lib/quant/monteCarloEngine.ts';

const makeTrades = (count) => Array.from({ length: count }, (_, index) => {
  const win = index % 3 !== 0;
  return {
    ticket: 'position-' + index,
    symbol: index % 2 ? 'EURUSD' : 'GBPUSD',
    direction: index % 2 ? 'BUY' : 'SELL',
    volume: 0.1,
    profit: win ? 200 : -100,
    commission: -1,
    rMultiple: win ? 2 : -1,
    closeTime: new Date(Date.UTC(2025, 0, 1) + index * 60_000).toISOString(),
  };
});

test('walk-forward analysis uses three chronological folds and the 300-trade OOS minimum', () => {
  const result = runWalkForwardAnalysis(makeTrades(700), 10_000);
  assert.equal(result.foldCount, 3);
  assert.equal(result.outOfSampleTrades, 315);
  assert.equal(result.status, 'ROBUST_CANDIDATE');
  assert.equal(result.targetRewardRiskMet, true);
  assert.ok(result.outOfSample.winRateWilson95LowerPct >= 60);
  assert.ok(result.outOfSample.realizedRewardRisk >= 2);
  assert.ok(result.outOfSample.expectancyR > 0);
});

test('walk-forward reports available folds but never passes an undersized sample', () => {
  const result = runWalkForwardAnalysis(makeTrades(100), 10_000);
  assert.equal(result.foldCount, 3);
  assert.equal(result.outOfSampleTrades, 45);
  assert.equal(result.status, 'INSUFFICIENT_SAMPLE');
  const missingTime = makeTrades(700).map((trade) => { const clone = { ...trade }; delete clone.closeTime; return clone; });
  assert.equal(runWalkForwardAnalysis(missingTime, 10_000).chronologicalDataVerified, false);
  assert.equal(runWalkForwardAnalysis(missingTime, 10_000).status, 'INSUFFICIENT_SAMPLE');
});

test('circular block bootstrap is reproducible for an identical broker trade sample', () => {
  const trades = makeTrades(120);
  const first = runMonteCarloStressSimulation(trades, 10_000, 100);
  const second = runMonteCarloStressSimulation(trades, 10_000, 100);
  assert.deepEqual(first, second);
  assert.equal(first.totalRuns, 100);
  assert.equal(first.stressParameters.bootstrapMethod, 'CIRCULAR_BLOCK');
  assert.ok(first.stressParameters.blockLength >= 2);
  assert.match(first.stressParameters.deterministicSeed, /^0x[0-9a-f]{8}$/);
  assert.throws(() => runMonteCarloStressSimulation(trades.slice(0, 29), 10_000, 100), /30 closed trades/);
});

test('CSV parser calculates net R only from explicit R or initial cash risk, not raw price distance', () => {
  const csv = [
    'Ticket,Symbol,Type,Volume,Open Time,Close Time,Profit,Commission,Swap,Fee,Initial Risk Amount',
    '1,EURUSD,buy,0.10,2025.01.01 00:00:00,2025.01.01 01:00:00,200,-2,0,0,100',
    '2,GBPUSD,sell,0.10,2025.01.01 02:00:00,2025.01.01 03:00:00,-100,-2,0,0,100',
  ].join('\n');
  const parsed = parseMt5ReportCsv(csv);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].rMultiple, 1.98);
  assert.equal(parsed[1].rMultiple, -1.02);

  const priceOnly = [
    'Ticket,Symbol,Type,Volume,Open Time,Close Time,Profit,Open Price,Close Price,Initial SL',
    '3,EURUSD,buy,0.10,2025.01.01 00:00:00,2025.01.01 01:00:00,200,1.1000,1.1020,1.0990',
  ].join('\n');
  assert.equal(parseMt5ReportCsv(priceOnly)[0].rMultiple, undefined);
});
