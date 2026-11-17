import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseQuery, supabaseRead } from '@/lib/supabaseAdmin';

const PRICES: Record<string, number> = {
  MONTHLY_NGN: 6_500_000,
  MONTHLY_USD: 4_900,
  LIFETIME_NGN: 25_000_000,
  LIFETIME_USD: 19_900,
};

type Plan = 'MONTHLY' | 'LIFETIME';
type Currency = 'NGN' | 'USD';

export type ProvisionedLicense = {
  license_key: string;
  payment_reference: string;
  mt5_account: number | null;
  email: string;
  tier: string;
  status: string;
  expires_at: string | null;
};

export type ProvisionResult = {
  license: ProvisionedLicense;
  created: boolean;
  amount: number;
  currency: Currency;
  plan: Plan;
};

function safeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Paystack transaction did not contain a valid customer email.');
  }
  return email;
}

function parseReference(reference: string): { plan: Plan; currency: Currency } {
  const match = /^ALGO_(MONTHLY|LIFETIME)_(NGN|USD)_([A-F0-9]{32})$/.exec(reference);
  if (!match) throw new Error('Unrecognized AlgoLync payment reference.');
  return { plan: match[1] as Plan, currency: match[2] as Currency };
}

function paymentAccount(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).mt5_account;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(String(raw));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Paystack transaction contains an invalid optional MT5 account.');
  }
  return value;
}

/**
 * The only license-minting entry point. Both the browser callback and webhook
 * call this function; payment is independently verified with Paystack first.
 */
export async function provisionLicenseForReference(referenceInput: string): Promise<ProvisionResult> {
  const reference = referenceInput.trim();
  const { plan, currency } = parseReference(reference);
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim() ?? '';
  if (!secret.startsWith('sk_')) throw new Error('Paystack server secret is not configured.');
  if (secret.startsWith('sk_live_') && process.env.PAYSTACK_LIVE_ENABLED !== 'true') {
    throw new Error('Live Paystack processing is disabled pending merchant approval.');
  }
  if (!isSupabaseConfigured()) throw new Error('Supabase server credentials are not configured.');

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Paystack verification returned HTTP ${response.status}.`);

  const envelope: unknown = await response.json();
  if (!envelope || typeof envelope !== 'object' || !('status' in envelope) || !('data' in envelope)) {
    throw new Error('Paystack returned an invalid verification envelope.');
  }
  const result = envelope as { status?: unknown; data?: Record<string, unknown> };
  const payment = result.data;
  const expectedAmount = PRICES[`${plan}_${currency}`];
  if (result.status !== true || !payment || payment.status !== 'success'
    || payment.reference !== reference || payment.currency !== currency
    || payment.amount !== expectedAmount) {
    throw new Error('Paystack transaction is not successful or does not match the expected plan, amount and currency.');
  }

  const metadata = payment.metadata;
  const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata as Record<string, unknown> : {};
  if (meta.tier !== plan || (meta.currency !== undefined && meta.currency !== currency)) {
    throw new Error('Paystack transaction metadata does not match the requested product.');
  }
  const email = safeEmail(
    payment.customer && typeof payment.customer === 'object' && 'email' in payment.customer
      ? (payment.customer as Record<string, unknown>).email : undefined
  );
  const mt5Account = paymentAccount(metadata);
  const digest = createHash('sha256').update(reference).digest('hex').slice(0, 12).toUpperCase();
  const tier = plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY';
  const expiresAt = plan === 'LIFETIME' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString();
  const candidate: ProvisionedLicense = {
    license_key: `ALGOLYNX-${plan === 'LIFETIME' ? 'LT' : 'MO'}-${digest}-${randomBytes(6).toString('hex').toUpperCase()}`,
    payment_reference: reference,
    mt5_account: mt5Account,
    email,
    tier,
    status: 'active',
    expires_at: expiresAt,
  };

  try {
    const inserted = await supabaseQuery<ProvisionedLicense[]>('licenses', {
      method: 'POST',
      query: 'on_conflict=payment_reference',
      prefer: 'resolution=ignore-duplicates,return=representation',
      body: candidate,
    });
    if (inserted === null) throw new Error('Supabase returned no response for the license insert.');
    if (inserted.length > 0) {
      return { license: inserted[0], created: true, amount: expectedAmount, currency, plan };
    }

    const existing = await supabaseRead<ProvisionedLicense[]>(
      'licenses',
      `payment_reference=eq.${encodeURIComponent(reference)}&select=license_key,payment_reference,mt5_account,email,tier,status,expires_at&limit=1`
    );
    if (!existing?.[0]) throw new Error('Idempotent insert returned no row and no existing payment license could be read.');
    return { license: existing[0], created: false, amount: expectedAmount, currency, plan };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'algolync_license_provisioning_write_failed',
      table: 'licenses',
      payment_reference: reference,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}
