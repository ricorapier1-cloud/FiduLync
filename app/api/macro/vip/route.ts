import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }

  const email = isRecord(body) && typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address to continue.' }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  const planCode = process.env.PAYSTACK_VIP_PLAN_CODE?.trim();
  if (!secretKey || !planCode) {
    return NextResponse.json({ error: 'Monthly Paystack checkout is not configured yet.' }, { status: 503 });
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const callbackUrl = new URL('/?vip=success#vip', origin).toString();
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, plan: planCode, callback_url: callbackUrl }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const payload: unknown = await response.json() as unknown;
    if (!response.ok || !isRecord(payload) || payload.status !== true || !isRecord(payload.data)
      || typeof payload.data.authorization_url !== 'string') {
      console.error('Paystack VIP plan initialization failed:', isRecord(payload) && typeof payload.message === 'string' ? payload.message : response.status);
      return NextResponse.json({ error: 'Paystack could not initialize the monthly plan. Please try again later.' }, { status: 502 });
    }

    return NextResponse.json({ authorizationUrl: payload.data.authorization_url }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Paystack VIP checkout request failed:', error);
    return NextResponse.json({ error: 'Paystack is temporarily unavailable.' }, { status: 503 });
  }
}
