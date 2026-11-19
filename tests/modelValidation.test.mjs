import test from 'node:test';
import assert from 'node:assert/strict';
import validator from '../.quant-test/modelValidation.js';

const { validateModelTrades } = validator;
const datasetFingerprint = 'a'.repeat(64);
const codeFingerprint = 'b'.repeat(64);
function trades(count = 200) {
  return Array.from({ length: count }, (_, index) => ({
    trade_id: 'trade-' + index,
    closed_at: new Date(Date.UTC(2020, 0, 1 + index)).toISOString(),
    gross_r: index % 3 === 0 ? -0.8 : 1.2,
    cost_r: 0.05,
  }));
}

test('computes deterministic holdout, walk-forward, Monte Carlo and cost-stress evidence', () => {
  const first = validateModelTrades(trades(), datasetFingerprint, codeFingerprint, 1);
  const second = validateModelTrades(trades(), datasetFingerprint, codeFingerprint, 1);
  assert.equal(first.validation_metrics.trade_count, 200);
  assert.equal(first.validation_metrics.out_of_sample_trade_count, 40);
  assert.equal(first.evidence.walk_forward.folds.length, 5);
  assert.equal(first.validation_metrics.monte_carlo_p95_drawdown_pct, second.validation_metrics.monte_carlo_p95_drawdown_pct);
  assert.equal(first.evidence.monte_carlo.simulations, 1500);
  assert.ok(first.validation_metrics.stressed_profit_factor <= first.validation_metrics.profit_factor);
});

test('rejects insufficient trade history and invalid fingerprints', () => {
  assert.throws(() => validateModelTrades(trades(99), datasetFingerprint, codeFingerprint, 1));
  assert.throws(() => validateModelTrades(trades(), 'not-a-sha', codeFingerprint, 1));
});

test('rejects duplicate trade IDs and invalid cost observations', () => {
  const duplicate = trades();
  duplicate[1].trade_id = duplicate[0].trade_id;
  assert.throws(() => validateModelTrades(duplicate, datasetFingerprint, codeFingerprint, 1));
  const invalid = trades();
  invalid[0].cost_r = -0.1;
  assert.throws(() => validateModelTrades(invalid, datasetFingerprint, codeFingerprint, 1));
});
