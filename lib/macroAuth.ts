import 'server-only';
import { getSupabaseAdmin } from '@/lib/serverSupabase';

export async function getMacroUser(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : user;
}