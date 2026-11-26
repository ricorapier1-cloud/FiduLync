import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const desk = read('../app/components/DeskTerminal.tsx');
const notebook = read('../app/notebook/page.tsx');

test('standalone risk calculator and manual trade journal are retired from the macro terminal', () => {
  assert.doesNotMatch(desk, /calculatorInputsValid|desk-position-sizing|LIVE RISK CALCULATOR|Position Sizing|WAT Daily Circuit Breaker/);
  assert.doesNotMatch(desk, /fidulync-desk-journal-v1|fidulync-quant-trade-journal-v1|RECORD CLOSED TRADE/);
  assert.match(notebook, /redirect\('\/accounts'\)/);
});
