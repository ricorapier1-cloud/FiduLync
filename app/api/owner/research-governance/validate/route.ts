import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { validateModelTrades, type ValidationTrade } from '@/lib/modelValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401 });
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2_000_000) return NextResponse.json({ error: 'Validation payload exceeds 2 MB.' }, { status: 413 });
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || !Array.isArray(body.trades) || body.trades.length > 5000) {
      return NextResponse.json({ error: 'A trade dataset containing up to 5,000 rows is required.' }, { status: 400 });
    }
    const modelKey = typeof body.model_key === 'string' ? body.model_key.trim() : '';
    const modelVersion = typeof body.model_version === 'string' ? body.model_version.trim() : '';
    const marketScope = Array.isArray(body.market_scope) ? body.market_scope : [];
    const timeframeScope = Array.isArray(body.timeframe_scope) ? body.timeframe_scope : [];
    if (!/^[a-zA-Z0-9._:-]{2,100}$/.test(modelKey) || !/^[a-zA-Z0-9._+-]{1,60}$/.test(modelVersion)
      || marketScope.length < 1 || marketScope.length > 30
      || !marketScope.every((value) => typeof value === 'string' && /^[A-Z0-9._-]{3,20}$/.test(value))
      || timeframeScope.length < 1 || timeframeScope.length > 10
      || !timeframeScope.every((value) => typeof value === 'string' && /^(M[1-9]|M1[0-2]|H[1-8]|D1|W1|MN1)$/.test(value))) {
      return NextResponse.json({ error: 'Model identity, market scope or timeframe scope is invalid.' }, { status: 400 });
    }
    const trades: ValidationTrade[] = [];
    for (const raw of body.trades) {
      if (!isRecord(raw) || typeof raw.trade_id !== 'string' || typeof raw.closed_at !== 'string'
        || !Number.isFinite(Date.parse(raw.closed_at))
        || typeof raw.gross_r !== 'number' || !Number.isFinite(raw.gross_r)
        || typeof raw.cost_r !== 'number' || !Number.isFinite(raw.cost_r)) {
        return NextResponse.json({ error: 'Every trade needs trade_id, closed_at, gross_r and cost_r.' }, { status: 400 });
      }
      trades.push({ trade_id: raw.trade_id, closed_at: raw.closed_at, gross_r: raw.gross_r, cost_r: raw.cost_r });
    }
    const datasetFingerprint = typeof body.dataset_fingerprint === 'string' ? body.dataset_fingerprint : '';
    const codeFingerprint = typeof body.code_fingerprint === 'string' ? body.code_fingerprint : '';
    const riskPct = typeof body.risk_pct_per_trade === 'number' ? body.risk_pct_per_trade : 1;
    const validation = validateModelTrades(trades, datasetFingerprint, codeFingerprint, riskPct);
    const evidence = { ...validation.evidence, submitted_by: owner.id, submitted_at: new Date().toISOString() };
    const { data, error } = await getSupabaseAdmin().from('quant_model_registry').insert({
      model_key: modelKey,
      model_version: modelVersion,
      market_scope: marketScope,
      timeframe_scope: timeframeScope,
      status: 'PENDING',
      dataset_fingerprint: datasetFingerprint.toLowerCase(),
      code_fingerprint: codeFingerprint.toLowerCase(),
      evidence,
      validation_metrics: validation.validation_metrics,
    }).select('id,model_key,model_version,status,created_at').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'This model key and version already exists.' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({
      model: data,
      validation_metrics: validation.validation_metrics,
      evidence,
      note: 'Validation report computed and registered as PENDING. Independent review is still mandatory; this does not enable execution.',
      execution_enabled: false,
    }, { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Model validation failed.';
    if (/Validation requires|fingerprints are required|Risk per trade|Trade rows|Chronological split/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Quant model validation failed:', error);
    return NextResponse.json({ error: 'Model validation could not be completed.' }, { status: 503 });
  }
}
