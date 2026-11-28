import 'server-only';

import { supabaseRead } from '@/lib/supabaseAdmin';

type MacroObservationProvenance = {
  provider: string;
  released_at: string | null;
  vintage_at: string | null;
  retrieved_at: string | null;
};

export type PointInTimeIntegrity = {
  status: 'VERIFIED' | 'NOT_VERIFIED' | 'UNAVAILABLE';
  observations: number;
  withReleaseTimestamp: number;
  withVintageTimestamp: number;
  releaseTimestampCoveragePct: number | null;
  vintageTimestampCoveragePct: number | null;
  sourceCount: number;
  latestRetrievedAtUtc: string | null;
  historicalValidationEligible: false;
  blockers: string[];
};

/**
 * Macro observation period dates are not release timestamps. Historical
 * point-in-time validation stays blocked until release and vintage metadata
 * are actually persisted for the observed source records.
 */
export async function getPointInTimeIntegrity(): Promise<PointInTimeIntegrity> {
  try {
    const query = new URLSearchParams({
      select: 'provider,released_at,vintage_at,retrieved_at',
      order: 'retrieved_at.desc',
      limit: '5000',
    });
    const rows = await supabaseRead<MacroObservationProvenance[]>('macro_observations', query.toString());
    if (!rows?.length) {
      return {
        status: 'UNAVAILABLE',
        observations: 0,
        withReleaseTimestamp: 0,
        withVintageTimestamp: 0,
        releaseTimestampCoveragePct: null,
        vintageTimestampCoveragePct: null,
        sourceCount: 0,
        latestRetrievedAtUtc: null,
        historicalValidationEligible: false,
        blockers: ['NO_PERSISTED_MACRO_OBSERVATIONS'],
      };
    }
    const withReleaseTimestamp = rows.filter((row) => typeof row.released_at === 'string'
      && Number.isFinite(Date.parse(row.released_at))).length;
    const withVintageTimestamp = rows.filter((row) => typeof row.vintage_at === 'string'
      && Number.isFinite(Date.parse(row.vintage_at))).length;
    const latestRetrievedAtUtc = rows
      .map((row) => row.retrieved_at)
      .filter((value): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
    const sourceCount = new Set(rows.map((row) => row.provider).filter(Boolean)).size;
    const releaseTimestampCoveragePct = (withReleaseTimestamp / rows.length) * 100;
    const vintageTimestampCoveragePct = (withVintageTimestamp / rows.length) * 100;
    const verified = withReleaseTimestamp === rows.length && withVintageTimestamp === rows.length;
    return {
      status: verified ? 'VERIFIED' : 'NOT_VERIFIED',
      observations: rows.length,
      withReleaseTimestamp,
      withVintageTimestamp,
      releaseTimestampCoveragePct,
      vintageTimestampCoveragePct,
      sourceCount,
      latestRetrievedAtUtc,
      historicalValidationEligible: false,
      blockers: verified ? ['HISTORICAL_MARKET_REPLAY_AND_TRADE_VALIDATION_STILL_REQUIRED']
        : ['RELEASE_TIMESTAMPS_MISSING', 'POINT_IN_TIME_VINTAGES_MISSING'],
    };
  } catch (error) {
    console.error('Point-in-time macro provenance could not be verified:', error);
    return {
      status: 'UNAVAILABLE',
      observations: 0,
      withReleaseTimestamp: 0,
      withVintageTimestamp: 0,
      releaseTimestampCoveragePct: null,
      vintageTimestampCoveragePct: null,
      sourceCount: 0,
      latestRetrievedAtUtc: null,
      historicalValidationEligible: false,
      blockers: ['MACRO_PROVENANCE_STORE_UNAVAILABLE'],
    };
  }
}
