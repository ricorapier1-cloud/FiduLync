import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: 'Sign in before starting a VIP subscription.' }, { status: 401 });
  }

  let userEmail: string;
  let userId: string;
  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(accessToken);
    if (error || !user?.email) {
      return NextResponse.json({ error: 'Your session is invalid. Sign in again to continue.' }, { status: 401 });
    }
    userEmail = user.email.trim().toLowerCase();
    userId = user.id;
  } catch (error) {
    console.error('VIP checkout could not verify the Supabase session:', error);
    return NextResponse.json({ error: 'Account verification is temporarily unavailable.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json() as unknown;
  } catch {
    body = {};
  }

  const requestedEmail = isRecord(body) && typeof body.email === 'string' ? body.email.trim().toLowerCase() : userEmail;
  if (requestedEmail && requestedEmail !== userEmail) {
    return NextResponse.json({ error: 'Checkout email must match your signed-in account.' }, { status: 400 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  const planCode = process.env.PAYSTACK_VIP_PLAN_CODE?.trim();
  if (!secretKey || !planCode) {
    return NextResponse.json({ error: 'Monthly Paystack checkout is not configured yet.' }, { status: 503 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const pendingSince = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: active, error: activeError } = await supabase.from('macro_subscriptions')
      .select('reference')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    const { data: pending, error: pendingError } = await supabase.from('macro_subscriptions')
      .select('reference')
      .eq('user_id', userId)
      .eq('status', 'initializing')
      .gte('created_at', pendingSince)
      .limit(1)
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (active || pending) return NextResponse.json({ error: 'A VIP subscription is already active or checkout is already pending.' }, { status: 409 });
  } catch (error) {
    console.error('Existing VIP subscription could not be checked:', error);
    return NextResponse.json({ error: 'Subscription status is temporarily unavailable.' }, { status: 503 });
  }

  const reference = `macro_${randomUUID().replaceAll('-', '')}`;
  const expectedAmount = 500_000;
  try {
    const supabase = getSupabaseAdmin();
    const { error: subscriptionError } = await supabase.from('macro_subscriptions').insert({
      reference,
      user_id: userId,
      email: userEmail,
      expected_amount: expectedAmount,
      currency: 'NGN',
    });
    if (subscriptionError) throw subscriptionError;

    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() || process.env.PAYSTACK_PUBLIC_KEY?.trim();
    if (publicKey) {
      return NextResponse.json({
        mode: 'inline',
        publicKey,
        reference,
        planCode,
        amount: expectedAmount,
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const callbackUrl = new URL('/?vip=success#vip', origin).toString();
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: userEmail,
        plan: planCode,
        amount: expectedAmount,
        reference,
        callback_url: callbackUrl,
        metadata: { user_id: userId, product: 'macro_vip_monthly' },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    const payload: unknown = await response.json() as unknown;
    if (!response.ok || !isRecord(payload) || payload.status !== true || !isRecord(payload.data)
      || typeof payload.data.authorization_url !== 'string' || payload.data.reference !== reference) {
      console.error('Paystack VIP plan initialization failed:', isRecord(payload) && typeof payload.message === 'string' ? payload.message : response.status);
      await supabase.from('macro_subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('reference', reference);
      return NextResponse.json({ error: 'Paystack could not initialize the monthly plan. Please try again later.' }, { status: 502 });
    }

    return NextResponse.json({ authorizationUrl: payload.data.authorization_url }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Paystack VIP checkout request failed:', error);
    try {
      await getSupabaseAdmin().from('macro_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('reference', reference)
        .eq('status', 'initializing');
    } catch (cleanupError) {
      console.error('Failed VIP checkout reference could not be cancelled:', cleanupError);
    }
    return NextResponse.json({ error: 'Paystack is temporarily unavailable.' }, { status: 503 });
  }
}
