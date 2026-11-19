import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/ownerAuth';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: 'Owner authentication required.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: 'A JSON model submission is required.' }, { status: 400 });
    const modelKey = typeof body.model_key === 'string' ? body.model_key.trim() : '';
    const modelVersion = typeof body.model_version === 'string' ? body.model_version.trim() : '';
    const marketScope = Array.isArray(body.market_scope) ? body.market_scope : [];
    const timeframeScope = Array.isArray(body.timeframe_scope) ? body.timeframe_scope : [];
    const evidence = body.evidence;
    const metrics = body.validation_metrics;
    if (!/^[a-zA-Z0-9._:-]{2,100}$/.test(modelKey) || !/^[a-zA-Z0-9._+-]{1,60}$/.test(modelVersion)
      || marketScope.length < 1 || marketScope.length > 30
      || !marketScope.every((value) => typeof value === 'string' && /^[A-Z0-9._-]{3,20}$/.test(value))
      || timeframeScope.length < 1 || timeframeScope.length > 10
      || !timeframeScope.every((value) => typeof value === 'string' && /^(M[1-9]|M1[0-2]|H[1-8]|D1|W1|MN1)$/.test(value))
      || !isRecord(evidence) || !isRecord(metrics)) {
      return NextResponse.json({ error: 'Model identity, scopes, evidence and metrics are invalid.' }, { status: 400 });
    }
    const requiredEvidence = ['dataset_fingerprint', 'code_fingerprint', 'dataset_start', 'dataset_end',
      'train_test_protocol', 'walk_forward', 'out_of_sample', 'monte_carlo', 'cost_stress', 'reproducibility'];
    const missing = requiredEvidence.filter((key) => !(key in evidence));
    const datasetFingerprint = body.dataset_fingerprint ?? evidence.dataset_fingerprint;
    const codeFingerprint = body.code_fingerprint ?? evidence.code_fingerprint;
    if (missing.length || !isSha256(datasetFingerprint) || !isSha256(codeFingerprint)
      || typeof evidence.dataset_start !== 'string' || !Number.isFinite(Date.parse(evidence.dataset_start))
      || typeof evidence.dataset_end !== 'string' || !Number.isFinite(Date.parse(evidence.dataset_end))
      || Date.parse(evidence.dataset_end) <= Date.parse(evidence.dataset_start)
      || !isRecord(evidence.walk_forward) || !isRecord(evidence.out_of_sample)
      || !isRecord(evidence.monte_carlo) || !isRecord(evidence.cost_stress)
      || !isRecord(evidence.reproducibility)) {
      return NextResponse.json({ error: 'Validation evidence is incomplete or lacks valid SHA-256 fingerprints and date boundaries.', missing }, { status: 400 });
    }
    const numericMetrics = ['trade_count', 'profit_factor', 'expectancy_r', 'sharpe_ratio',
      'max_drawdown_pct', 'monte_carlo_p95_drawdown_pct', 'walk_forward_pass_rate_pct',
      'out_of_sample_trade_count', 'stressed_profit_factor'];
    const invalidMetrics = numericMetrics.filter((key) => !finite(metrics[key]));
    if (invalidMetrics.length || (metrics.trade_count as number) < 1
      || (metrics.max_drawdown_pct as number) < 0 || (metrics.max_drawdown_pct as number) > 100
      || (metrics.monte_carlo_p95_drawdown_pct as number) < 0 || (metrics.monte_carlo_p95_drawdown_pct as number) > 100
      || (metrics.walk_forward_pass_rate_pct as number) < 0 || (metrics.walk_forward_pass_rate_pct as number) > 100
      || (metrics.out_of_sample_trade_count as number) < 1) {
      return NextResponse.json({ error: 'Required validation metrics are missing or outside valid bounds.', invalid_metrics: invalidMetrics }, { status: 400 });
    }
    const { data, error } = await getSupabaseAdmin().from('quant_model_registry').insert({
      model_key: modelKey,
      model_version: modelVersion,
      market_scope: marketScope,
      timeframe_scope: timeframeScope,
      status: 'PENDING',
      dataset_fingerprint: datasetFingerprint,
      code_fingerprint: codeFingerprint,
      evidence: { ...evidence, submitted_by: owner.id, submitted_at: new Date().toISOString() },
      validation_metrics: metrics,
    }).select('id,model_key,model_version,status,created_at').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'This model key and version have already been submitted.' }, { status: 409 });
      throw error;
    }
    return NextResponse.json({
      model: data,
      note: 'Submission is PENDING independent review. Evidence capture does not approve a model or enable broker execution.',
      execution_enabled: false,
    }, { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Quant model validation submission failed:', error);
    return NextResponse.json({ error: 'Model validation submission could not be saved.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
