import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { isAuthorizedOwnerEmail } from '@/lib/ownerAuth';
import { enforceDistributedRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rate = await enforceDistributedRateLimit(request, 'owner-verify', 30, 60_000);
  if (rate.unavailable) return NextResponse.json({ authenticated: false, error: 'Owner verification is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (!rate.allowed) return NextResponse.json({ authenticated: false, error: 'Too many verification attempts.' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });

  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token || token.length > 8192) return NextResponse.json({ authenticated: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user || !isAuthorizedOwnerEmail(data.user.email) || !data.user.email_confirmed_at) {
      return NextResponse.json({ authenticated: false }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const response = NextResponse.json({
      authenticated: true,
      email: data.user.email!.trim().toLowerCase(),
      role: 'owner',
      checked_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });

    // The browser can read the Supabase session in its client SDK, but page access
    // is granted only through this server-set, HttpOnly, same-site cookie.
    response.cookies.set('fidulync_owner_session', token, {
      httpOnly: true,
      secure: new URL(request.url).protocol === 'https:',
      sameSite: 'strict',
      path: '/',
      maxAge: 55 * 60,
    });
    return response;
  } catch (error) {
    console.error('Owner session verification failed:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ authenticated: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
