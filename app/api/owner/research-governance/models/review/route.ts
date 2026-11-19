import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const rate = await enforceDistributedRateLimit(request, 'independent-model-review', 10, 60_000);
  if (rate.unavailable) return NextResponse.json({ error: 'Reviewer security service is unavailable.' }, { status: 503 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many review attempts.' }, { status: 429 });
  if (Number(request.headers.get('content-length') ?? 0) > 32_768) return NextResponse.json({ error: 'Review payload exceeds 32 KB.' }, { status: 413 });
  const authorization = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim();
  if (!token) return NextResponse.json({ error: 'Reviewer authentication required.' }, { status: 401 });
  const allowlist = (process.env.QUANT_INDEPENDENT_REVIEWER_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!allowlist.length) return NextResponse.json({ error: 'Independent reviewer access is not configured.' }, { status: 503 });
  try {
    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData.user;
    if (authError || !user || !user.email_confirmed_at || !allowlist.includes(user.id)) {
      return NextResponse.json({ error: 'This verified account is not an authorised independent reviewer.' }, { status: 403 });
    }
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'A valid JSON review payload is required.' }, { status: 400 }); }
    if (!isRecord(body)) return NextResponse.json({ error: 'A review payload is required.' }, { status: 400 });
    const modelId = Number(body.model_id);
    const decision = body.decision;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const checklist = isRecord(body.checklist) ? body.checklist : {};
    if (Object.keys(checklist).length > 40 || Object.values(checklist).some((value) => typeof value !== 'boolean')) {
      return NextResponse.json({ error: 'Review checklist must contain at most 40 boolean fields.' }, { status: 400 });
    }
    if (!Number.isSafeInteger(modelId) || modelId <= 0
      || !['IN_REVIEW', 'APPROVED', 'REJECTED'].includes(String(decision))
      || notes.length < 20 || notes.length > 5000) {
      return NextResponse.json({ error: 'Model ID, review decision or review notes are invalid.' }, { status: 400 });
    }
    const { data: model, error: modelError } = await supabase.from('quant_model_registry')
      .select('id,dataset_fingerprint,code_fingerprint,evidence,validation_metrics,status')
      .eq('id', modelId).maybeSingle();
    if (modelError) throw modelError;
    if (!model) return NextResponse.json({ error: 'Model record not found.' }, { status: 404 });
    const evidenceDigest = createHash('sha256').update(JSON.stringify({
      dataset_fingerprint: model.dataset_fingerprint,
      code_fingerprint: model.code_fingerprint,
      evidence: model.evidence,
      validation_metrics: model.validation_metrics,
    })).digest('hex');
    const { data, error } = await supabase.rpc('review_quant_model', {
      p_model_id: modelId,
      p_reviewer_id: user.id,
      p_decision: decision,
      p_notes: notes,
      p_checklist: checklist,
      p_evidence_digest: evidenceDigest,
    });
    if (error) {
      const message = error.message || 'Review could not be recorded.';
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({
      review: Array.isArray(data) ? data[0] : data,
      evidence_digest: evidenceDigest,
      note: 'Review event recorded in the append-only audit table. Approval never enables broker execution.',
      execution_enabled: false,
    }, { status: 200, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('Independent model review failed:', error);
    return NextResponse.json({ error: 'Independent model review is temporarily unavailable.' }, { status: 503 });
  }
}
