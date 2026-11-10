import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseUrl } from '@/lib/serverConfig';

const adminEmails = new Set(['fidulync@gmail.com', 'ricorapier@yahoo.com']);

export function getSupabaseAdmin(): SupabaseClient {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are missing or invalid.');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email || !adminEmails.has(user.email.toLowerCase())) {
      return { response: NextResponse.json({ error: 'Administrator access required.' }, { status: 403 }) };
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.role !== 'admin') {
      return { response: NextResponse.json({ error: 'Administrator role required.' }, { status: 403 }) };
    }

    return { supabase, user };
  } catch (error) {
    console.error('Admin authorization failed:', error);
    return { response: NextResponse.json({ error: 'Administrator verification is temporarily unavailable.' }, { status: 503 }) };
  }
}
