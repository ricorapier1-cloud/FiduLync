import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const api = readFileSync('app/api/owner/research-hypotheses/route.ts', 'utf8');
const ui = readFileSync('app/components/ResearchNotebook.tsx', 'utf8');

test('hypothesis API requires server-verified owner identity on read and write', () => {
  assert.equal((api.match(/requireOwner\(request\)/g) || []).length, 2);
  assert.ok(api.includes('enforceDistributedRateLimit'));
  assert.ok(api.includes('64 * 1024'));
});

test('hypothesis registration is draft-only and validates thesis and research scope', () => {
  assert.ok(api.includes("status: 'DRAFT'"));
  assert.ok(api.includes('falsification_criteria'));
  assert.ok(api.includes('payload.thesis.trim().length < 20'));
  assert.ok(api.includes('payload.thesis.trim().length > 5000'));
});

test('research notebook is local-only and contains no login flow', () => {
  assert.ok(!ui.includes('@supabase/supabase-js'));
  assert.ok(!ui.includes('/api/owner/verify'));
  assert.ok(!ui.toLowerCase().includes('sign in'));
  assert.ok(ui.includes('localStorage'));
  assert.ok(ui.includes('not synced'));
  assert.equal(existsSync('app/owner/page.tsx'), false);
});
