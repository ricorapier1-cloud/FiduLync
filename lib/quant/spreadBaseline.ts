import 'server-only';

import { Redis } from '@upstash/redis';

export type SpreadBaselineResult = {
  multiple: number | null;
  medianSpread: number | null;
  observations: number;
  status: 'WARMING_UP' | 'AVAILABLE' | 'UNAVAILABLE';
};

/**
 * Build a same-day, same-session spread baseline from observed Swissquote BBOs.
 * No baseline is inferred from OHLCV or from a hard-coded spread assumption.
 */
export async function recordAndEvaluateSpreadBaseline(
  symbol: string,
  spread: number | null,
  session: 'LONDON' | 'NEW_YORK' | 'CLOSED',
  dateWAT: string,
): Promise<SpreadBaselineResult> {
  if (spread === null || !Number.isFinite(spread) || spread <= 0 || session === 'CLOSED') {
    return { multiple: null, medianSpread: null, observations: 0, status: 'UNAVAILABLE' };
  }
  try {
    const redis = Redis.fromEnv();
    const key = 'intraday:spread-baseline:v1:' + symbol + ':' + dateWAT + ':' + session;
    const sampleLock = await redis.set(key + ':sample-lock', '1', { nx: true, ex: 15 });
    if (sampleLock === 'OK') {
      await redis.lpush(key, String(spread));
      await redis.ltrim(key, 0, 119);
    }
    await redis.expire(key, 36 * 60 * 60);
    const raw = await redis.lrange<string>(key, 0, 119);
    const values = raw.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (values.length < 20) {
      return { multiple: null, medianSpread: null, observations: values.length, status: 'WARMING_UP' };
    }
    const middle = Math.floor(values.length / 2);
    const medianSpread = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return {
      multiple: medianSpread > 0 ? spread / medianSpread : null,
      medianSpread,
      observations: values.length,
      status: 'AVAILABLE',
    };
  } catch (error) {
    console.warn('Session spread baseline is unavailable; fail-closed signal gate remains active.', error);
    return { multiple: null, medianSpread: null, observations: 0, status: 'UNAVAILABLE' };
  }
}
