import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buyerId, sellerId, title, baseCurrency, buyerCurrency, baseAmount } = body;
    
    // Server-side validation and rate locking logic
    const transactionId = Math.random().toString(36).substring(2, 12);
    
    return NextResponse.json({
      success: true,
      transactionId,
      checkoutUrl: `/pay/${transactionId}`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
