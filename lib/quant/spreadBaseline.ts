import 'server-only';

import { Redis } from '@upstash/redis';

export type SpreadBaselineResult = {
  multiple: number | null;
  medianSpread: number | null;
  observations: number;
  status: 'CONFIGURED_REFERENCE' | 'AVAILABLE' | 'UNAVAILABLE';
  source: 'CONFIGURED_REFERENCE' | 'OBSERVED_SESSION_MEDIAN' | 'UNAVAILABLE';
};

// User-supplied provisional guardrails, not observed market history.
// Actual same-session medians supersede them after 20 distinct live samples.
const REFERENCE_SPREADS: Record<string, number> = {
  EURUSD: 0.00018,
  GBPUSD: 0.00022,
  USDJPY: 0.020,
  XAUUSD: 0.85,
  GBPJPY: 0.030,
};

export async function recordAndEvaluateSpreadBaseline(
  symbol: string,
  spread: number | null,
  session: 'LONDON' | 'NEW_YORK' | 'CLOSED',
  dateWAT: string,
): Promise<SpreadBaselineResult> {
  const normalizedSymbol = symbol.toUpperCase();
  const reference = REFERENCE_SPREADS[normalizedSymbol];
  if (spread === null || !Number.isFinite(spread) || spread <= 0 || session === 'CLOSED') {
    return { multiple: null, medianSpread: reference ?? null, observations: 0, status: 'UNAVAILABLE', source: 'UNAVAILABLE' };
  }
  try {
    const redis = Redis.fromEnv();
    const key = 'intraday:spread-baseline:v2:' + normalizedSymbol + ':' + dateWAT + ':' + session;
    const sampleLock = await redis.set(key + ':sample-lock', '1', { nx: true, ex: 15 });
    if (sampleLock === 'OK') {
      await redis.lpush(key, String(spread));
      await redis.ltrim(key, 0, 119);
    }
    await redis.expire(key, 36 * 60 * 60);
    const raw = await redis.lrange<string>(key, 0, 119);
    const values = raw.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (values.length >= 20) {
      const middle = Math.floor(values.length / 2);
      const medianSpread = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
      return {
        multiple: medianSpread > 0 ? spread / medianSpread : null,
        medianSpread,
        observations: values.length,
        status: 'AVAILABLE',
        source: 'OBSERVED_SESSION_MEDIAN',
      };
    }
    if (reference !== undefined) {
      return { multiple: spread / reference, medianSpread: reference, observations: values.length, status: 'CONFIGURED_REFERENCE', source: 'CONFIGURED_REFERENCE' };
    }
    return { multiple: null, medianSpread: null, observations: values.length, status: 'UNAVAILABLE', source: 'UNAVAILABLE' };
  } catch (error) {
    console.warn('Shared spread history unavailable; using the disclosed configured reference as a provisional guardrail.', error);
    return reference !== undefined
      ? { multiple: spread / reference, medianSpread: reference, observations: 0, status: 'CONFIGURED_REFERENCE', source: 'CONFIGURED_REFERENCE' }
      : { multiple: null, medianSpread: null, observations: 0, status: 'UNAVAILABLE', source: 'UNAVAILABLE' };
  }
}
