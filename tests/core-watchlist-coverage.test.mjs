import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const desk = readFileSync(new URL('../app/components/DeskTerminal.tsx', import.meta.url), 'utf8');
const signals = readFileSync(new URL('../app/api/v1/intraday-signals/route.ts', import.meta.url), 'utf8');
const quotes = readFileSync(new URL('../app/api/v1/live-quotes/route.ts', import.meta.url), 'utf8');

test('primary user watchlist has EURUSD, GBPUSD, XAUUSD and USDJPY across quotes and intraday signals', () => {
  for (const symbol of ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY']) {
    assert.match(desk, new RegExp(symbol));
    assert.match(signals, new RegExp(symbol));
    assert.match(quotes, new RegExp(symbol));
  }
  assert.match(desk, /const symbols: SymbolCode\[\] = \['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY'\]/);
  assert.match(signals, /const symbols = \['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY'/);
  assert.match(desk, /<option value="GBPUSD">GBP\/USD<\/option>/);
});
