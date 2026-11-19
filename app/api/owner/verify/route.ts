import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';
import { isAuthorizedOwnerEmail } from '@/lib/ownerAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    const userEmail = data?.user?.email?.toLowerCase() || '';
    if (error || !data.user || !isAuthorizedOwnerEmail(userEmail)) {
      return NextResponse.json({ authenticated: false }, { status: 403 });
    }
    return NextResponse.json({
      authenticated: true,
      email: userEmail,
      role: 'owner',
      checked_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner session verification failed:', error);
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}
