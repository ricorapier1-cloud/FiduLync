import 'server-only';

const baseUrl = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceKey = () => (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

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
  const key = licenseKey.trim().toUpperCase();
  const licenses = await supabaseRows<{
    license_key: string; mt5_account: number | string | null; status: string | null;
    expires_at: string | null; grace_until: string | null; tier: string | null; ea_slug: string | null;
  }>('licenses', new URLSearchParams({
    select: 'license_key,mt5_account,status,expires_at,grace_until,tier,ea_slug',
    license_key: `eq.${key}`, limit: '1',
  }).toString());
  const license = licenses[0];
  if (!license || license.license_key !== key) return false;
  const status = String(license.status || '').toUpperCase();
  const active = status === 'ACTIVE' && (!license.expires_at || Date.parse(license.expires_at) > Date.now());
  const grace = status === 'PAST_DUE' && Boolean(license.grace_until && Date.parse(license.grace_until) > Date.now());
  if (!active && !grace) return false;

  if (String(license.tier || '').toUpperCase() === 'DEMO_TRIAL' || key.startsWith('ALGOLYNX-DEMO-')) {
    const trials = await supabaseRows<{ mt5_login: number | string; expires_at: string }>('ea_demo_trials', new URLSearchParams({
      select: 'mt5_login,expires_at', license_key: `eq.${key}`, mt5_login: `eq.${mt5Account}`, limit: '1',
    }).toString());
    return trials.length === 1 && Date.parse(trials[0].expires_at) > Date.now();
  }

  if (Number(license.mt5_account) === mt5Account) return true;
  if (!license.ea_slug) return false;
  const seats = await supabaseRows<{ mt5_login: number | string }>('ea_license_seats', new URLSearchParams({
    select: 'mt5_login', license_key: `eq.${key}`, ea_slug: `eq.${license.ea_slug}`,
    mt5_login: `eq.${mt5Account}`, limit: '1',
  }).toString());
  return seats.length === 1 && Number(seats[0].mt5_login) === mt5Account;
}
