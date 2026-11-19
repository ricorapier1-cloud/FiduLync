import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workbench = readFileSync('app/components/ValidationWorkbench.tsx', 'utf8');

test('validation workbench requires server-verified owner authentication', () => {
  assert.ok(workbench.includes("fetch('/api/owner/verify'"));
  assert.ok(workbench.includes('if (!authorized || !session)'));
});

test('validation imports are bounded and calculations remain local', () => {
  assert.ok(workbench.includes('file.size > 2 * 1024 * 1024'));
  assert.ok(workbench.includes('await file.text()'));
  assert.ok(workbench.includes('calculateTradeMetrics'));
  assert.ok(workbench.includes('monteCarloBootstrap'));
  assert.ok(!workbench.includes("method: 'POST'"));
  assert.ok(!workbench.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
