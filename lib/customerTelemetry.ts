import 'server-only';

const baseUrl = () => (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceKey = () => (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function requiredConfig() {
  const url = baseUrl(), key = serviceKey();
  if (!url || !key) throw new Error('Supabase telemetry storage is not configured.');
  return { url, key };
}

async function supabaseRows<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = requiredConfig();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase read failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid Supabase response.');
  return rows as T[];
}

async function supabaseWrite(table: string, query: string, body: Record<string, unknown>, prefer: string) {
  const { url, key } = requiredConfig();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'POST',
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', Prefer: prefer,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Supabase write failed (${response.status}).`);
  return response;
}

export async function validateCustomerLicense(mt5Account: number, licenseKey: string): Promise<boolean> {
  if (!Number.isSafeInteger(mt5Account) || mt5Account <= 0 || !licenseKey.trim()) return false;
  const query = new URLSearchParams({
    select: 'license_key,mt5_account,status,expires_at',
    mt5_account: `eq.${mt5Account}`,
    license_key: `eq.${licenseKey.trim()}`,
    status: 'eq.active',
    limit: '1',
  });
  const rows = await supabaseRows<{ license_key: string; mt5_account: number | string; status: string; expires_at: string | null }>('licenses', query.toString());
  if (rows.length !== 1) return false;
  const row = rows[0];
  return Number(row.mt5_account) === mt5Account && row.license_key === licenseKey.trim()
    && row.status === 'active'
    && (!row.expires_at || Date.parse(row.expires_at) > Date.now());
}

export type CustomerHeartbeat = {
  mt5_account: number;
  license_key: string;
  ea_name: string;
  balance: number;
  equity: number;
  floating_pnl: number;
  drawdown_pct: number;
  open_positions: number;
  status: string;
  updated_at?: string;
};

export async function saveCustomerHeartbeat(input: CustomerHeartbeat) {
  await supabaseWrite('ea_heartbeats',
    'on_conflict=mt5_account',
    { ...input, updated_at: new Date().toISOString() },
    'resolution=merge-duplicates,return=minimal'
  );
}

export async function getCustomerHeartbeat(mt5Account: number, licenseKey: string) {
  const query = new URLSearchParams({
    select: 'mt5_account,ea_name,balance,equity,floating_pnl,drawdown_pct,open_positions,status,updated_at',
    mt5_account: `eq.${mt5Account}`,
    license_key: `eq.${licenseKey}`,
    limit: '1',
  });
  const rows = await supabaseRows<Omit<CustomerHeartbeat, 'license_key'> & { updated_at: string }>('ea_heartbeats', query.toString());
  if (!rows.length) return null;
  const row = rows[0];
  const heartbeatAge = Date.now() - Date.parse(row.updated_at);
  const online = (row.status === 'RUNNING' || row.status === 'ONLINE')
    && Number.isFinite(heartbeatAge) && heartbeatAge >= 0 && heartbeatAge <= 15 * 60_000;
  return { ...row, connection_status: online ? 'ONLINE' as const : 'OFFLINE' as const };
}

export type CustomerTrade = {
  mt5_account: number;
  license_key: string;
  ticket: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  profit_usd: number;
  r_multiple: number;
  confluence_score: number;
  regime: string;
  closed_at_utc: string;
};

export async function saveCustomerTrade(trade: CustomerTrade) {
  await supabaseWrite('trade_ledger', 'on_conflict=mt5_account,ticket,symbol',
    trade as unknown as Record<string, unknown>, 'resolution=ignore-duplicates,return=minimal');
}

export async function getCustomerTrades(mt5Account: number, licenseKey: string) {
  const query = new URLSearchParams({
    select: 'ticket,symbol,direction,entry_price,exit_price,profit_usd,r_multiple,confluence_score,regime,closed_at_utc',
    mt5_account: `eq.${mt5Account}`,
    license_key: `eq.${licenseKey}`,
    order: 'closed_at_utc.desc',
    limit: '20',
  });
  return supabaseRows<Omit<CustomerTrade, 'mt5_account' | 'license_key'>>( 'trade_ledger', query.toString());
}
