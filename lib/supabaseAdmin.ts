import 'server-only';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim();

/** Server-only read adapter. All privileged writes use the typed admin client. */
export async function supabaseRead<T = unknown>(table: string, query: string): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${table} read failed (${response.status}): ${text}`);
  }

  return await response.json() as T;
}
