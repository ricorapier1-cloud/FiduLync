export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverSupabase';

export async function POST(request: Request) {
  const result = await requireAdmin(request);
  if ('response' in result) return result.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const disputeId = typeof body.dispute_id === 'string' ? body.dispute_id : '';
  const action = body.action;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const sellerAmount = Number(body.seller_amount ?? 0);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(disputeId)) {
    return NextResponse.json({ error: 'A valid dispute ID is required.' }, { status: 400 });
  }
  if (!['release_to_seller', 'refund_to_buyer', 'split'].includes(String(action))) {
    return NextResponse.json({ error: 'Invalid arbitration action.' }, { status: 400 });
  }
  if (!notes || notes.length > 2000) {
    return NextResponse.json({ error: 'Reviewer notes are required (up to 2,000 characters).' }, { status: 400 });
  }
  if (action === 'split' && (!Number.isFinite(sellerAmount) || sellerAmount < 0)) {
    return NextResponse.json({ error: 'Enter a valid seller split amount.' }, { status: 400 });
  }

  const { data, error } = await result.supabase.rpc('resolve_fidulync_dispute', {
    p_dispute_id: disputeId,
    p_admin_id: result.user.id,
    p_action: action,
    p_seller_amount: action === 'split' ? sellerAmount : 0,
    p_notes: notes,
  });

  if (error) {
    console.error('Dispute arbitration failed:', error);
    return NextResponse.json({ error: 'Unable to resolve this dispute. Confirm it is still under review.' }, { status: 409 });
  }

  return NextResponse.json({ success: true, resolution: data });
}
