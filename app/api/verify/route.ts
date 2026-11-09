import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (typeof body.link !== 'string' || body.link.length > 2000) {
    return NextResponse.json({ error: 'Please provide a valid FiduLync deal link or reference.' }, { status: 400 });
  }

  let reference = body.link.trim();
  try {
    if (reference.startsWith('http://') || reference.startsWith('https://')) {
      reference = new URL(reference).pathname.split('/').filter(Boolean).at(-1) || '';
    }
  } catch {
    return NextResponse.json({ error: 'Enter a valid deal reference or URL.' }, { status: 400 });
  }

  if (!/^[0-9a-f]{36}$/i.test(reference)) {
    return NextResponse.json({ verified: false, message: 'This is not a valid FiduLync deal reference.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: deal, error } = await supabase
      .from('escrow_deals')
      .select('reference,item_name,title,amount,currency,status,created_at')
      .eq('reference', reference)
      .maybeSingle();

    if (error) throw error;
    if (!deal) {
      return NextResponse.json({ verified: false, message: 'This deal reference is not registered with FiduLync.' });
    }

    return NextResponse.json({
      verified: true,
      message: 'This deal reference is registered with FiduLync.',
      escrow: {
        id: deal.reference,
        title: deal.item_name || deal.title,
        amount: Number(deal.amount),
        currency: deal.currency,
        status: deal.status,
        createdAt: deal.created_at,
      },
    });
  } catch (error) {
    console.error('Deal verification failed:', error);
    return NextResponse.json({ error: 'Unable to verify this deal right now.' }, { status: 503 });
  }
}
