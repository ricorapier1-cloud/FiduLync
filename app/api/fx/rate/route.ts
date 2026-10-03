import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CACHE_TTL_HOURS = 4;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = searchParams.get('base')?.toUpperCase();
  const target = searchParams.get('target')?.toUpperCase();

  if (!base || !target) {
    return NextResponse.json({ error: 'Missing base or target currency' }, { status: 400 });
  }

  if (base === target) {
    return NextResponse.json({ base, target, rate: 1.0 });
  }

  try {
    const now = new Date().toISOString();

    // 1. Check valid cache entry in Supabase
    const { data: cached } = await supabase
      .from('exchange_rate_cache')
      .select('rate, expires_at')
      .eq('base_currency', base)
      .eq('target_currency', target)
      .gt('expires_at', now)
      .single();

    if (cached) {
      return NextResponse.json({ base, target, rate: cached.rate, source: 'cache' });
    }

    // 2. Fetch fresh rate from external FX provider
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error('Failed to retrieve live exchange rate');
    }

    const fxData = await response.json();
    const liveRate = fxData.rates[target];

    if (!liveRate) {
      return NextResponse.json({ error: `Unsupported target currency: ${target}` }, { status: 400 });
    }

    // 3. Upsert rate to cache with expiration timestamp
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await supabase.from('exchange_rate_cache').upsert(
      {
        base_currency: base,
        target_currency: target,
        rate: liveRate,
        fetched_at: now,
        expires_at: expiresAt,
      },
      { onConflict: 'base_currency,target_currency' }
    );

    return NextResponse.json({ base, target, rate: liveRate, source: 'live' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
