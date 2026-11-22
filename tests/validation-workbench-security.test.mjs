import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('legacy trade validation workbench is removed from the active macro product', () => {
  const page = readFileSync(new URL('../app/research/validation/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /redirect\('\/analytics'\)/);
  assert.equal(existsSync(new URL('../app/components/ValidationWorkbench.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../components/ManualRiskPlanner.tsx', import.meta.url)), false);
});

test('the macro workbench does not expose technical trade metrics or broker execution inputs', () => {
  const crossAsset = readFileSync(new URL('../app/analytics/page.tsx', import.meta.url), 'utf8');
  assert.match(crossAsset, /Cross-asset observations/);
  assert.match(crossAsset, /snapshot\.cot/);
  assert.doesNotMatch(crossAsset, /calculateTradeMetrics|PositionClose|OrderSend|stop.loss|lot size/i);
});
