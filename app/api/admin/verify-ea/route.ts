export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverSupabase';

const providerColumns: Record<string, string> = {
  myfxbook: 'myfxbook_status',
  fxblue: 'fxblue_status',
  mt5_direct: 'mt5_sync_status',
};

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ('response' in result) return result.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const id = typeof body.submission_id === 'string' ? body.submission_id : '';
  const status = body.decision;
  const notes = typeof body.reviewer_notes === 'string' ? body.reviewer_notes.trim() : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'A valid submission ID is required.' }, { status: 400 });
  }
  if (status !== 'approved' && status !== 'rejected') {
    return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });
  }
  if (!notes || notes.length > 2000) {
    return NextResponse.json({ error: 'Reviewer notes are required (up to 2,000 characters).' }, { status: 400 });
  }

  const { data: submission, error: submissionError } = await result.supabase
    .from('ea_verification_submissions')
    .update({
      status,
      reviewer_notes: notes,
      reviewed_by: result.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('listing_id,provider')
    .maybeSingle();

  if (submissionError) {
    console.error('EA verification review failed:', submissionError);
    return NextResponse.json({ error: 'Unable to save the verification decision.' }, { status: 503 });
  }
  if (!submission) return NextResponse.json({ error: 'This verification request was already reviewed.' }, { status: 409 });

  const providerColumn = providerColumns[submission.provider];
  if (!providerColumn) return NextResponse.json({ error: 'Unsupported verification provider.' }, { status: 400 });

  const { error: listingError } = await result.supabase
    .from('ea_listings')
    .update({
      [providerColumn]: status,
      verification_notes: notes,
      ...(status === 'approved' ? { verification_status: 'verified' } : {}),
    })
    .eq('id', submission.listing_id);

  if (listingError) {
    console.error('EA listing verification status update failed:', listingError);
    return NextResponse.json({ error: 'Decision saved, but listing status could not be updated. Retry from the audit queue.' }, { status: 503 });
  }

  return NextResponse.json({ success: true });
}
