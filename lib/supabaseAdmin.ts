const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

export async function supabaseQuery<T = unknown>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH';
    query?: string;
    body?: Record<string, unknown>;
    prefer?: string;
  } = {}
): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase ${table} error (${res.status}): ${errText}`);
  }

  return (await res.json()) as T;
}
