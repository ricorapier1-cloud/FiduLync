import test from 'node:test';
import assert from 'node:assert/strict';
import { observationEpoch, isObservationFresh } from '../.quant-test/dataFreshness.js';

test('strict freshness accepts valid official calendar dates and timezone-aware timestamps', () => {
  const now = Date.parse('2026-11-28T12:00:00.000Z');
  assert.equal(observationEpoch('2026-11-28'), Date.parse('2026-11-28T00:00:00.000Z'));
  assert.equal(isObservationFresh('2026-11-28', 24 * 60 * 60_000, now, 0), true);
  assert.equal(isObservationFresh('2026-11-27T18:00:00-05:00', 24 * 60 * 60_000, now), true);
});

test('strict freshness rejects timezone-free datetimes, impossible dates, stale and future observations', () => {
  const now = Date.parse('2026-11-28T12:00:00.000Z');
  assert.equal(observationEpoch('2026-11-28T10:00:00'), null);
  assert.equal(observationEpoch('2026-02-30'), null);
  assert.equal(isObservationFresh('2026-11-20', 24 * 60 * 60_000, now), false);
  assert.equal(isObservationFresh('2026-11-29', 24 * 60 * 60_000, now, 0), false);
});
