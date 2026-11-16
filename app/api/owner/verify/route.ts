import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export const dynamic = 'force-dynamic';

const OWNER_EMAIL = 'ricorapier1@gmail.com';

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user || data.user.email?.toLowerCase() !== OWNER_EMAIL) {
      return NextResponse.json({ authenticated: false }, { status: 403 });
    }
    return NextResponse.json({
      authenticated: true,
      email: OWNER_EMAIL,
      role: 'owner',
      checked_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Owner session verification failed:', error);
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}
