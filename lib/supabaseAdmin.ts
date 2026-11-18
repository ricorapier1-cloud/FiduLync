import 'server-only';

// Prefer the current Supabase secret API key; retain the legacy service-role key as a fallback.
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_KEY = (
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim();

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

  const responseText = await response.text();
  if (!responseText) return {} as T;
  try { return JSON.parse(responseText) as T; } catch {
    throw new Error(`Supabase ${table} returned an invalid JSON response.`);
  }
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

// Typed helper functions for the 3 core tables:

export type LicenseRecord = {
  license_key: string;
  mt5_account: number;
  email: string;
  tier?: string;
  status?: string;
  expires_at?: string | null;
};

export async function persistLicense(license: LicenseRecord) {
  return supabaseQuery('licenses', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: {
      license_key: license.license_key,
      mt5_account: license.mt5_account,
      email: license.email.toLowerCase(),
      tier: license.tier || 'INSTITUTIONAL_PRO',
      status: license.status || 'active',
      expires_at: license.expires_at ?? null,
      created_at: new Date().toISOString(),
    },
  });
}

export type TransactionRecord = {
  reference: string;
  email: string;
  amount: number;
  status: string;
  mt5_account?: number | null;
  currency?: string;
};

export async function recordTransaction(tx: TransactionRecord) {
  return supabaseQuery('transactions', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: {
      reference: tx.reference,
      email: tx.email.toLowerCase(),
      amount: tx.amount,
      status: tx.status,
      mt5_account: tx.mt5_account || null,
      currency: tx.currency || 'NGN',
      created_at: new Date().toISOString(),
    },
  });
}

export type HeartbeatRecord = {
  mt5_account: number;
  license_key: string;
  balance: number;
  equity: number;
  drawdown_pct?: number;
  open_positions?: number;
  vps_ping_ms?: number;
};

export async function upsertHeartbeat(hb: HeartbeatRecord) {
  return supabaseQuery('ea_heartbeats', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: {
      mt5_account: hb.mt5_account,
      license_key: hb.license_key,
      balance: hb.balance,
      equity: hb.equity,
      drawdown_pct: hb.drawdown_pct ?? 0,
      open_positions: hb.open_positions ?? 0,
      vps_ping_ms: hb.vps_ping_ms ?? 0,
      updated_at: new Date().toISOString(),
    },
  });
}
