import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export async function requireUser(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { response: NextResponse.json({ error: 'Sign in is required.' }, { status: 401 }) };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { response: NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 }) };
    }
    return { supabase, user };
  } catch (error) {
    console.error('User session validation failed:', error);
    return { response: NextResponse.json({ error: 'Authentication service is unavailable.' }, { status: 503 }) };
  }
}
