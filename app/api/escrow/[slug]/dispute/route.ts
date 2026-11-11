export const dynamic = 'force-dynamic';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

const evidenceTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']);
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
};

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'A valid dispute submission is required.' }, { status: 400 });
  }

  const reason = form.get('reason');
  const evidence = form.get('evidence');
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 2000) {
    return NextResponse.json({ error: 'Provide a dispute statement between 10 and 2,000 characters.' }, { status: 400 });
  }
  if (!(evidence instanceof File) || evidence.size === 0 || evidence.size > 10 * 1024 * 1024 || !evidenceTypes.has(evidence.type)) {
    return NextResponse.json({ error: 'Attach one evidence file (JPEG, PNG, WebP, PDF or MP4, up to 10 MB).' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: deal, error: dealError } = await supabase
      .from('escrow_deals')
      .select('id,status')
      .eq('reference', slug)
      .maybeSingle();

    if (dealError) throw dealError;
    if (!deal) return NextResponse.json({ error: 'Escrow deal not found.' }, { status: 404 });
    if (deal.status !== 'funded') return NextResponse.json({ error: 'Only funded deals can be disputed.' }, { status: 409 });

    const disputeId = randomUUID();
    const evidencePath = `${slug}/${disputeId}/${randomUUID()}.${extensions[evidence.type]}`;
    const { error: uploadError } = await supabase.storage
      .from('dispute-evidence')
      .upload(evidencePath, await evidence.arrayBuffer(), { contentType: evidence.type, upsert: false });

    if (uploadError) {
      console.error('Dispute evidence upload failed:', uploadError);
      return NextResponse.json({ error: 'Evidence could not be uploaded. No dispute was opened.' }, { status: 503 });
    }

    const { error: disputeError } = await supabase.from('disputes').insert({
      id: disputeId,
      deal_id: deal.id,
      reason: reason.trim(),
      status: 'under_review',
    });

    if (disputeError) {
      await supabase.storage.from('dispute-evidence').remove([evidencePath]);
      if (disputeError.message.includes('Only funded escrow deals')) {
        return NextResponse.json({ error: 'This escrow is no longer funded and cannot be disputed.' }, { status: 409 });
      }
      console.error('Dispute creation failed:', disputeError);
      return NextResponse.json({ error: 'Unable to open the dispute. Please retry.' }, { status: 503 });
    }

    const { error: evidenceError } = await supabase.from('dispute_evidence').insert({
      dispute_id: disputeId,
      deal_id: deal.id,
      proof_url: evidencePath,
      notes: evidence.name.slice(0, 255),
    });

    if (evidenceError) {
      console.error('Dispute evidence record failed:', evidenceError);
      return NextResponse.json({ error: 'Dispute opened and funds frozen, but the evidence record could not be saved. Contact support with the dispute reference.' }, { status: 503 });
    }

    return NextResponse.json({ success: true, dispute_id: disputeId, message: 'Dispute opened. Settlement is frozen while evidence is reviewed.' }, { status: 201 });
  } catch (error) {
    console.error('Dispute submission failed:', error);
    return NextResponse.json({ error: 'Dispute service is unavailable.' }, { status: 503 });
  }
}
