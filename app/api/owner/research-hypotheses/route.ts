import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { requireOwner } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max
    || value.some((item) => typeof item !== 'string' || item.length > 32)) return null;
  return [...new Set(value.map((item) => (item as string).trim().toUpperCase()).filter(Boolean))];
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rate = await enforceDistributedRateLimit(request, 'research-hypotheses-read', 30, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Research notebook is temporarily unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Research notebook rate limit exceeded.' }, { status: 429 });
  try {
    const { data, error } = await getSupabaseAdmin().from('research_hypotheses')
      .select('id,hypothesis_key,title,thesis,instruments,timeframes,features,parameters,null_hypothesis,falsification_criteria,status,created_at,updated_at')
      .order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ hypotheses: data ?? [], count: data?.length ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Research hypothesis read failed:', error);
    return NextResponse.json({ error: 'Research notebook could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const rate = await enforceDistributedRateLimit(request, 'research-hypotheses-write', 10, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Research notebook is temporarily unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Research notebook rate limit exceeded.' }, { status: 429 });

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: 'A valid JSON body is required.' }, { status: 400 });
  }
  if (!isRecord(payload) || typeof payload.title !== 'string' || payload.title.trim().length < 3
    || payload.title.trim().length > 180 || typeof payload.thesis !== 'string'
    || payload.thesis.trim().length < 20 || payload.thesis.trim().length > 5000) {
    return NextResponse.json({ error: 'Provide a 3–180 character title and a 20–5,000 character testable thesis.' }, { status: 400 });
  }
  const instruments = stringArray(payload.instruments, 30);
  const timeframes = stringArray(payload.timeframes, 12);
  if (!instruments || !timeframes || instruments.some((item) => !/^[A-Z0-9._-]{3,16}$/.test(item))
    || timeframes.some((item) => !/^(M1|M5|M15|M30|H1|H4|D1|W1|MN1)$/.test(item))) {
    return NextResponse.json({ error: 'Instrument or timeframe list is invalid.' }, { status: 400 });
  }
  const features = isRecord(payload.features) ? payload.features : {};
  const parameters = isRecord(payload.parameters) ? payload.parameters : {};
  const falsification = isRecord(payload.falsification_criteria) ? payload.falsification_criteria : {};
  const nullHypothesis = typeof payload.null_hypothesis === 'string' ? payload.null_hypothesis.trim().slice(0, 2000) : null;
  const title = payload.title.trim();
  const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '-' + randomUUID().slice(0, 8);
  try {
    const { data, error } = await getSupabaseAdmin().from('research_hypotheses').insert({
      hypothesis_key: key, title, thesis: payload.thesis.trim(), instruments, timeframes,
      features, parameters, null_hypothesis: nullHypothesis, falsification_criteria: falsification,
      status: 'DRAFT', updated_at: new Date().toISOString(),
    }).select('id,hypothesis_key,title,thesis,instruments,timeframes,features,parameters,null_hypothesis,falsification_criteria,status,created_at,updated_at').single();
    if (error) throw error;
    return NextResponse.json({ created: true, hypothesis: data }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Research hypothesis creation failed:', error);
    return NextResponse.json({ error: 'Hypothesis could not be saved.' }, { status: 503 });
  }
}
