const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

type SupabaseQueryOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: string;
  body?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  prefer?: string;
};

export async function supabaseQuery<T = unknown>(
  table: string,
  options: SupabaseQueryOptions = {}
): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`;

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer ?? 'return=representation',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${table} error (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function supabaseInsert<T = unknown>(
  table: string,
  payload: Record<string, unknown>
): Promise<T | null> {
  return supabaseQuery<T>(table, {
    method: 'POST',
    prefer: 'return=representation',
    body: payload,
  });
}

export async function supabaseRead<T = unknown>(
  table: string,
  query: string
): Promise<T | null> {
  return supabaseQuery<T>(table, {
    method: 'GET',
    query,
  });
}
