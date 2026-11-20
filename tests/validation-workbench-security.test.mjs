import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workbench = readFileSync('app/components/ValidationWorkbench.tsx', 'utf8');

test('validation workbench is available without login and runs locally', () => {
  assert.ok(!workbench.includes('@supabase/supabase-js'));
  assert.ok(!workbench.includes('/api/owner/verify'));
  assert.ok(!workbench.toLowerCase().includes('sign in'));
  assert.ok(workbench.includes('runValidation'));
  assert.ok(workbench.includes('Analysis completed locally'));
});

test('validation imports are bounded and calculations remain local', () => {
  assert.ok(workbench.includes('file.size > 2 * 1024 * 1024'));
  assert.ok(workbench.includes('await file.text()'));
  assert.ok(workbench.includes('calculateTradeMetrics'));
  assert.ok(workbench.includes('monteCarloBootstrap'));
  assert.ok(!workbench.includes("method: 'POST'"));
  assert.ok(!workbench.includes('SUPABASE_SERVICE_ROLE_KEY'));
});
