import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync('app/api/owner/research-hypotheses/route.ts', 'utf8');
const ui = readFileSync('app/components/ResearchNotebook.tsx', 'utf8');
const owner = readFileSync('app/owner/page.tsx', 'utf8');

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

test('notebook UI does not embed the private owner email or service-role credential', () => {
  assert.ok(!ui.includes('@gmail.com'));
  assert.ok(!ui.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.ok(!owner.includes('@gmail.com'));
  assert.ok(!owner.includes('OWNER_EMAIL ='));
});
