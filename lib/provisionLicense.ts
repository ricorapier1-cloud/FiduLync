import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';

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
    const persisted = await supabaseQuery<ProvisionedLicense>('rpc/provision_algolync_license', {
      method: 'POST',
      body: {
        p_payment_reference: reference,
        p_license_key: candidate.license_key,
        p_mt5_account: candidate.mt5_account,
        p_email: candidate.email,
        p_tier: candidate.tier,
        p_expires_at: candidate.expires_at,
      },
    });
    if (!persisted || typeof persisted !== 'object' || !persisted.license_key
      || persisted.payment_reference !== reference) {
      throw new Error('Atomic Supabase provisioning RPC returned an invalid license record.');
    }
    return {
      license: persisted,
      created: persisted.license_key === candidate.license_key,
      amount: expectedAmount,
      currency,
      plan,
    };
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
