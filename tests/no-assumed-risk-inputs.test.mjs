import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const desk = readFileSync(new URL('../app/components/DeskTerminal.tsx', import.meta.url), 'utf8');
const notebook = readFileSync(new URL('../app/notebook/page.tsx', import.meta.url), 'utf8');

test('risk calculator never pre-populates assumed account equity, risk, stop or target values', () => {
  assert.match(desk, /const \[balance, setBalance\] = useState\(''\)/);
  assert.match(desk, /const \[riskPct, setRiskPct\] = useState\(''\)/);
  assert.match(desk, /const \[sl, setSl\] = useState\(''\)/);
  assert.match(desk, /const \[tp, setTp\] = useState\(''\)/);
  assert.match(desk, /calculatorInputsValid/);
  assert.match(desk, /GROSS TARGET P.L/);
  assert.doesNotMatch(desk, /EXPECTED GROSS PROFIT/);
});

test('trade journal does not assume a starting account equity for drawdown analytics', () => {
  assert.match(notebook, /const \[capital, setCapital\] = useState\(''\)/);
  assert.match(notebook, /Set starting equity/);
  assert.match(notebook, /maxDd:validStartingEquity\?maxDd:null/);
});
