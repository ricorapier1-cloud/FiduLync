import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = searchParams.get('base')?.toUpperCase() || 'NGN';
  const target = searchParams.get('target')?.toUpperCase() || 'USD';

  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(target)) {
    return NextResponse.json({ error: 'Currency codes must be three-letter ISO codes.' }, { status: 400 });
  }
  if (base === target) return NextResponse.json({ rate: 1.0 });

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'FX rate provider is temporarily unavailable.' }, { status: 502 });
    }

    const data: unknown = await res.json();
    const rates = isRecord(data) && isRecord(data.rates) ? data.rates : null;
    const rate = rates && Object.hasOwn(rates, target)
      ? Number(rates[target])
      : Number.NaN;
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: 'A valid exchange rate is unavailable for these currencies.' }, { status: 502 });
    }
    return NextResponse.json({ base, target, rate });
  } catch (error) {
    console.error('FX rate lookup failed:', error);
    return NextResponse.json({ error: 'FX rate lookup is temporarily unavailable.' }, { status: 503 });
  }
}
