/** Shared, strict freshness rules for source observation dates and timestamps. */
export function observationEpoch(value: string | undefined): number | null {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return null;

  // Many official statistical APIs provide an observation DATE, not a timestamp.
  // Interpret that explicitly as a UTC calendar date; never accept timezone-free datetimes.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const epoch = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString().slice(0, 10) !== value) return null;
    return epoch;
  }

  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? epoch : null;
}

export function isObservationFresh(
  value: string | undefined,
  maxAgeMs: number,
  nowMs = Date.now(),
  futureToleranceMs = 5 * 60_000,
): boolean {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0 || !Number.isFinite(nowMs)
    || !Number.isFinite(futureToleranceMs) || futureToleranceMs < 0) return false;
  const epoch = observationEpoch(value);
  if (epoch === null) return false;
  const ageMs = nowMs - epoch;
  return ageMs >= -futureToleranceMs && ageMs <= maxAgeMs;
}
