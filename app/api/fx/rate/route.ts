import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = searchParams.get('base')?.toUpperCase() || 'NGN';
  const target = searchParams.get('target')?.toUpperCase() || 'USD';

  if (base === target) return NextResponse.json({ rate: 1.0 });

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { next: { revalidate: 3600 } });
    const data = await res.json();
    const rate = data.rates?.[target] || 1.0;
    return NextResponse.json({ base, target, rate });
  } catch (err) {
    return NextResponse.json({ error: 'FX rate lookup failed' }, { status: 500 });
  }
}
