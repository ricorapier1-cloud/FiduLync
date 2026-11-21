import test from 'node:test';
import assert from 'node:assert/strict';
import portfolio from '../.quant-test/portfolioRisk.js';

const { aggregatePortfolioRisk } = portfolio;

function position(overrides = {}) {
  return {
    installationId: 'terminal-a', accountLogin: 123456, accountCurrency: 'USD',
    snapshotAt: '2026-11-21T14:00:00.000Z', snapshotComplete: true,
    symbol: 'EURUSD', side: 'BUY', volume: 0.1, entryPrice: 1.1,
    stopLoss: 1.095, tickSize: 0.00001, tickValueLoss: 1,
    contractSize: 100000, baseCurrency: 'EUR', quoteCurrency: 'USD',
    ...overrides,
  };
}

function account(positions = [position()], overrides = {}) {
  return {
    installationId: 'terminal-a', accountLogin: 123456, accountCurrency: 'USD',
    equity: 10000, reportedOpenRiskCash: 50, reportedOpenRiskVerified: true,
    accountSnapshotAt: '2026-11-21T14:00:00.000Z',
    positionSnapshotAt: '2026-11-21T14:00:00.000Z',
    expectedPositions: positions.length, positions, manifestComplete: true,
    ...overrides,
  };
}

test('aggregates verified risk by account without mixing account currencies', () => {
  const result = aggregatePortfolioRisk([
    account([position()], { reportedOpenRiskCash: 50 }),
    account([position({
      installationId: 'terminal-b', accountLogin: 987654, accountCurrency: 'EUR',
      snapshotAt: '2026-11-21T14:00:00.000Z',
    })], {
      installationId: 'terminal-b', accountLogin: 987654, accountCurrency: 'EUR',
      reportedOpenRiskCash: 50,
    }),
  ], Date.parse('2026-11-21T14:00:10.000Z'));

  assert.equal(result.status, 'READY');
  assert.equal(result.accountCount, 2);
  assert.equal(result.accounts[0].openRiskPct, 0.5);
  assert.equal(result.accounts[1].currency, 'EUR');
  assert.equal(result.accounts[1].openRiskCash, 50);
});

test('fails closed when any position has no protective stop', () => {
  const result = aggregatePortfolioRisk([
    account([position(), position({ stopLoss: 0 })], {
      expectedPositions: 2, reportedOpenRiskCash: 50,
    }),
  ], Date.parse('2026-11-21T14:00:10.000Z'));

  assert.equal(result.status, 'DEGRADED');
  assert.equal(result.accounts[0].openRiskCash, null);
  assert.equal(result.accounts[0].unprotectedPositionCount, 1);
  assert.ok(result.blockers.includes('UNPROTECTED_OR_UNMEASURABLE_POSITION'));
});

test('rejects stale, incomplete and count-mismatched position snapshots', () => {
  const stale = account([position()], {
    manifestComplete: false,
    expectedPositions: 2,
    accountSnapshotAt: '2026-11-21T13:00:00.000Z',
  });
  const result = aggregatePortfolioRisk([stale], Date.parse('2026-11-21T14:00:10.000Z'));
  assert.equal(result.status, 'DEGRADED');
  assert.equal(result.accounts[0].riskVerified, false);
  assert.ok(result.blockers.includes('POSITION_MANIFEST_INCOMPLETE'));
  assert.ok(result.blockers.includes('POSITION_COUNT_MISMATCH'));
  assert.ok(result.blockers.includes('ACCOUNT_OR_POSITION_SNAPSHOT_STALE'));
});

test('calculates native currency exposures with long/short signs', () => {
  const result = aggregatePortfolioRisk([
    account([
      position(),
      position({ side: 'SELL', volume: 0.05, symbol: 'EURUSD' }),
    ], { expectedPositions: 2, reportedOpenRiskCash: 75 }),
  ], Date.parse('2026-11-21T14:00:10.000Z'));

  const eur = result.currencyExposures.find((item) => item.currency === 'EUR');
  const usd = result.currencyExposures.find((item) => item.currency === 'USD');
  assert.equal(eur?.netUnits, 5000);
  assert.equal(usd?.netUnits, -5500);
});

test('does not report a usable risk percentage when broker and calculated risk disagree', () => {
  const result = aggregatePortfolioRisk([
    account([position()], { reportedOpenRiskCash: 500 }),
  ], Date.parse('2026-11-21T14:00:10.000Z'));

  assert.equal(result.accounts[0].openRiskPct, null);
  assert.ok(result.blockers.includes('BROKER_AND_POSITION_RISK_MISMATCH'));
});

test('returns unavailable rather than inventing an empty portfolio', () => {
  const result = aggregatePortfolioRisk([], Date.parse('2026-11-21T14:00:10.000Z'));
  assert.equal(result.status, 'UNAVAILABLE');
  assert.equal(result.accountCount, 0);
  assert.ok(result.blockers.includes('NO_VERIFIED_MT5_ACCOUNT_SNAPSHOTS'));
});
