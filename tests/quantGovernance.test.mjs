import test from 'node:test';
import assert from 'node:assert/strict';
import quant from '../.quant-test/quantGovernance.js';
const { evaluateRiskProposal, calculateBrokerAwareVolume } = quant;

function policy(overrides = {}) {
  return {
    policyVersion: 'personal-v1',
    maxPerTradeRiskPct: 0.5,
    maxPortfolioRiskPct: 2,
    maxDailyDrawdownPct: 4,
    maxWeeklyDrawdownPct: 8,
    maxHighWaterDrawdownPct: 15,
    maxMarginUsagePct: 20,
    maxSpreadPoints: 30,
    maxQuoteAgeMs: 2000,
    maxConsecutiveLosses: 3,
    rewardRiskMinimum: 1.5,
    ...overrides,
  };
}

function proposal(overrides = {}) {
  return {
    requestId: 'req-001',
    installationId: 'mt5-install-001',
    symbol: 'EURUSD',
    side: 'BUY',
    entryPrice: 1.1002,
    stopLoss: 1.0982,
    takeProfit: 1.1042,
    bid: 1.1000,
    ask: 1.1002,
    quoteAgeMs: 250,
    spreadPoints: 20,
    equity: 10000,
    freeMargin: 9000,
    usedMargin: 1000,
    estimatedMargin: 500,
    currentOpenRiskCash: 100,
    dailyStartEquity: 10000,
    weeklyStartEquity: 10000,
    highWaterMarkEquity: 10000,
    consecutiveLosses: 0,
    requestedRiskPct: 0.5,
    regime: 'TRENDING_EXPANSION',
    marketDataHealth: 'LIVE',
    macroDataHealth: 'LIVE',
    modelValidated: true,
    executionQualityVerified: true,
    newsLockout: false,
    explicitExecutionEnablement: true,
    symbolSpec: {
      symbol: 'EURUSD',
      tickSize: 0.00001,
      tickValuePerLot: 1,
      volumeMin: 0.01,
      volumeMax: 100,
      volumeStep: 0.01,
      contractSize: 100000,
      stopLevelPoints: 0,
      point: 0.00001,
      verified: true,
    },
    ...overrides,
  };
}

test('approves only a fully verified proposal and floors volume to broker step', () => {
  const result = evaluateRiskProposal(proposal(), policy(), Date.UTC(2026, 10, 18));
  assert.equal(result.decision, 'APPROVE');
  assert.equal(result.approvedRiskPct, 0.5);
  assert.equal(result.approvedVolume, 0.25);
  assert.equal(result.estimatedRiskCash, 50);
  assert.deepEqual(result.blockers, []);
});

test('server-owned policy caps requested risk even if the proposal asks for more', () => {
  const result = evaluateRiskProposal(proposal({ requestedRiskPct: 5 }), policy());
  assert.equal(result.decision, 'APPROVE');
  assert.equal(result.approvedRiskPct, 0.5);
  assert.equal(result.approvedVolume, 0.25);
});

test('fails closed when explicit execution enablement is absent', () => {
  const result = evaluateRiskProposal(proposal({ explicitExecutionEnablement: false }), policy());
  assert.equal(result.decision, 'REJECT');
  assert.equal(result.approvedVolume, 0);
  assert.ok(result.blockers.includes('EXECUTION_NOT_EXPLICITLY_ENABLED'));
});

test('blocks reference or stale market data', () => {
  const result = evaluateRiskProposal(proposal({ marketDataHealth: 'REFERENCE' }), policy());
  assert.equal(result.decision, 'DEGRADED');
  assert.equal(result.approvedRiskPct, 0);
  assert.ok(result.blockers.includes('MARKET_DATA_NOT_LIVE'));
});

test('blocks daily drawdown breach and does not issue volume', () => {
  const result = evaluateRiskProposal(proposal({ equity: 9500 }), policy());
  assert.equal(result.decision, 'REJECT');
  assert.equal(result.approvedVolume, 0);
  assert.ok(result.blockers.includes('DAILY_DRAWDOWN_LIMIT_REACHED'));
});

test('rejects minimum broker volume when it would exceed the risk budget', () => {
  const result = calculateBrokerAwareVolume({
    equity: 100,
    riskPct: 0.1,
    entryPrice: 1.1,
    stopLoss: 1.098,
    specification: proposal().symbolSpec,
  });
  assert.equal(result.valid, false);
  assert.equal(result.volume, 0);
  assert.equal(result.reason, 'MINIMUM_VOLUME_EXCEEDS_RISK_BUDGET');
});

test('uses existing margin plus proposed margin for the margin ceiling', () => {
  const result = evaluateRiskProposal(proposal({
    usedMargin: 1500,
    estimatedMargin: 1000,
  }), policy({ maxMarginUsagePct: 20 }));
  assert.equal(result.decision, 'REJECT');
  assert.ok(result.blockers.includes('MARGIN_USAGE_LIMIT_EXCEEDED'));
});
