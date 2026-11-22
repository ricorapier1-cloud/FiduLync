import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('MT5 macro context include is read-only and fails closed on missing evidence', async () => {
  const bridge = await read('public/mql5/MacroContextBridge.mqh');
  assert.match(bridge, /\/api\/v1\/macro-context\?symbol=/);
  assert.match(bridge, /Authorization: Bearer/);
  assert.match(bridge, /X-MT5-Timestamp/);
  assert.match(bridge, /INSUFFICIENT_EVIDENCE/);
  assert.match(bridge, /high_impact_lockout = true/);
  assert.doesNotMatch(bridge, /OrderSend|CTrade|PositionClose|PositionModify/i);
});
