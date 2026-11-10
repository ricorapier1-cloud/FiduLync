import 'server-only';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export function supabaseAdmin() {
  return getSupabaseAdmin();
}
