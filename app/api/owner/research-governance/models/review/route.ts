import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
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
    const body: unknown = await request.json();
    if (!isRecord(body)) return NextResponse.json({ error: 'A review payload is required.' }, { status: 400 });
    const modelId = Number(body.model_id);
    const decision = body.decision;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const checklist = isRecord(body.checklist) ? body.checklist : {};
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
