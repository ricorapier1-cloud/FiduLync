import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseQuery } from '@/lib/supabaseAdmin';
import { validatePointInTimeObservation } from '@/lib/quantPipeline';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROVIDERS = new Set(['FRED', 'BLS', 'BEA', 'CFTC', 'FINNHUB', 'FX', 'CUSTOM']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function authorized(request: Request): boolean {
  const expected = (process.env.CRON_SECRET ?? '').trim();
  const match = /^Bearer\\s+(.+)$/i.exec(request.headers.get('authorization') ?? '');
  const supplied = match?.[1]?.trim() ?? '';
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected, 'utf8'), b = Buffer.from(supplied, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!checkRateLimit(getClientIp(request), 10, 60_000)) {
    return NextResponse.json({ error: 'Macro ingestion rate limit exceeded.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized macro ingestion request.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON payload is required.' }, { status: 400 });
  }
  if (!isRecord(payload) || typeof payload.as_of !== 'string'
    || !Array.isArray(payload.observations) || payload.observations.length < 1
    || payload.observations.length > 500) {
    return NextResponse.json({ error: 'Payload requires an as_of timestamp and 1–500 observations.' }, { status: 400 });
  }

  const asOf = new Date(payload.as_of);
  if (!Number.isFinite(asOf.getTime()) || !/(Z|[+-]\d{2}:?\d{2})$/i.test(payload.as_of)
    || asOf.getTime() > Date.now() + 30_000 || asOf.getTime() < Date.now() - 24 * 60 * 60_000) {
    return NextResponse.json({ error: 'as_of must be a recent timezone-aware UTC timestamp.' }, { status: 400 });
  }

  const rows: Record<string, unknown>[] = [];
  for (const raw of payload.observations) {
    if (!isRecord(raw) || typeof raw.provider !== 'string' || !PROVIDERS.has(raw.provider.toUpperCase())
      || typeof raw.series_id !== 'string' || raw.series_id.length < 1 || raw.series_id.length > 160
      || typeof raw.region_code !== 'string' || !/^[A-Z0-9_-]{2,12}$/i.test(raw.region_code)
      || typeof raw.observation_period !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.observation_period)
      || typeof raw.value !== 'number' || !Number.isFinite(raw.value)
      || typeof raw.observation_at !== 'string' || typeof raw.released_at !== 'string'
      || typeof raw.retrieved_at !== 'string'
      || (raw.vintage_at !== undefined && raw.vintage_at !== null && typeof raw.vintage_at !== 'string')
      || (raw.revision_at !== undefined && raw.revision_at !== null && typeof raw.revision_at !== 'string')
      || (raw.unit !== undefined && raw.unit !== null && (typeof raw.unit !== 'string' || raw.unit.length > 80))
      || (raw.source_url !== undefined && raw.source_url !== null && (typeof raw.source_url !== 'string' || !raw.source_url.startsWith('https://')))) {
      return NextResponse.json({ error: 'One or more macro observations failed schema validation.' }, { status: 400 });
    }

    const observation = {
      source: raw.provider.toUpperCase(),
      seriesId: raw.series_id,
      observationAt: raw.observation_at,
      releasedAt: raw.released_at,
      retrievedAt: raw.retrieved_at,
      value: raw.value,
      revisionAt: typeof raw.revision_at === 'string' ? raw.revision_at : null,
    };
    const pointInTime = validatePointInTimeObservation(observation, payload.as_of);
    if (!pointInTime.valid) {
      return NextResponse.json({ error: 'Point-in-time validation failed.', reason: pointInTime.reason, series_id: raw.series_id }, { status: 422 });
    }

    const canonical = JSON.stringify({
      provider: observation.source, series_id: raw.series_id, region_code: raw.region_code.toUpperCase(),
      observation_period: raw.observation_period, value: raw.value, unit: raw.unit ?? null,
      observation_at: new Date(raw.observation_at).toISOString(),
      released_at: new Date(raw.released_at).toISOString(),
      vintage_at: raw.vintage_at ? new Date(String(raw.vintage_at)).toISOString() : null,
      revision_at: raw.revision_at ? new Date(String(raw.revision_at)).toISOString() : null,
    });
    rows.push({
      provider: observation.source,
      series_id: raw.series_id,
      region_code: raw.region_code.toUpperCase(),
      observation_period: raw.observation_period,
      value: raw.value,
      unit: raw.unit ?? null,
      observation_at: new Date(raw.observation_at).toISOString(),
      released_at: new Date(raw.released_at).toISOString(),
      retrieved_at: new Date(raw.retrieved_at).toISOString(),
      vintage_at: raw.vintage_at ? new Date(String(raw.vintage_at)).toISOString() : null,
      revision_at: raw.revision_at ? new Date(String(raw.revision_at)).toISOString() : null,
      source_url: raw.source_url ?? null,
      source_hash: createHash('sha256').update(canonical).digest('hex'),
    });
  }

  try {
    const result = await supabaseQuery('macro_observations', {
      method: 'POST',
      query: 'on_conflict=source_hash',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: rows,
    });
    if (!result) throw new Error('Macro observation storage unavailable.');
    return NextResponse.json({
      accepted: true,
      submitted: rows.length,
      idempotent_by_source_hash: true,
      as_of_utc: asOf.toISOString(),
      received_at_utc: new Date().toISOString(),
      point_in_time_checked: true,
    }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Macro observation ingestion failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Macro observation storage is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
