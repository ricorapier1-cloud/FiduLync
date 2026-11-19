import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const macroData = read('../lib/macroData.ts');
const macroEngine = read('../lib/macroEngine.ts');
const currencyStrength = read('../lib/currencyStrength.ts');
const dashboard = read('../app/components/MacroDashboard.tsx');\nconst marketFeeds = read('../lib/marketFeeds.ts');

test('provider outage returns an empty, untimestamped macro fallback', () => {
  const fallback = macroData.match(/export function getFallbackSnapshot\(\): MacroSnapshot \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fallback, 'fallback snapshot function exists');
  assert.match(fallback, /asOf: ''/);
  assert.match(fallback, /currencies: \[\]/);
  assert.match(fallback, /cot: \[\]/);
  assert.match(fallback, /catalysts: \[\]/);
  assert.doesNotMatch(fallback, /policyRate: [1-9]|inflation: [1-9]/);
});

test('only complete provider-sourced policy and inflation observations leave the adapter', () => {
  assert.match(macroData, /snapshot\.currencies = snapshot\.currencies\.filter\(\(currency\) =>\s*currency\.policyRateSource === 'provider' && currency\.inflationSource === 'provider'\)/);
  assert.match(currencyStrength, /item\.policyRateSource === 'provider'/);
  assert.match(currencyStrength, /item\.inflationSource === 'provider'/);
});

test('stale macro snapshots are rejected instead of silently reused', () => {
  assert.match(macroEngine, /ageMs > 24 \* 60 \* 60_000/);
  assert.match(macroEngine, /return getFallbackSnapshot\(\)/);
});

test('dashboard never substitutes hardcoded events, policy ranges, or positioning figures', () => {
  assert.doesNotMatch(dashboard, /US Non-Farm Payrolls|425 bps \(G8\)|Tier-1 Catalyst • 13:30 UTC/);
  assert.match(dashboard, /providerPolicyInputs/);
  assert.match(dashboard, /NO VERIFIED INPUTS/);
  assert.match(dashboard, /formatQuoteAge\(quote\.timestamp, now\)/);
});

test('third-party quote feeds require explicit commercial-use approval', () => {
  assert.match(marketFeeds, /FINNHUB_COMMERCIAL_USE_APPROVED === 'true'/);
  assert.match(marketFeeds, /FRANKFURTER_COMMERCIAL_USE_APPROVED !== 'true'/);
  assert.match(marketFeeds, /EXCHANGERATE_API_COMMERCIAL_USE_APPROVED !== 'true'/);
  assert.match(marketFeeds, /GOLD_API_COMMERCIAL_USE_APPROVED !== 'true'/);
});
