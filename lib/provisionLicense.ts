import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { isSupabaseConfigured, supabaseQuery } from '@/lib/supabaseAdmin';
import { getEaBySlug } from '@/lib/eaCatalog';

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
  created?: boolean;
  ea_slug?: string;
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

function parseReference(reference: string): { plan: Plan; currency: Currency; slug?: string } {
  // Support both:
  // 1) ALGO_[SLUG]_[PLAN]_[CURRENCY]_[HEX]
  // 2) ALGO_[PLAN]_[CURRENCY]_[HEX]
  const parts = reference.split('_');
  if (parts.length >= 4 && parts[0] === 'ALGO') {
    if (parts[1] === 'MONTHLY' || parts[1] === 'LIFETIME') {
      return { plan: parts[1] as Plan, currency: parts[2] as Currency };
    }
    // Pattern: ALGO_[SLUG]_[PLAN]_[CURRENCY]_[HEX]
    if (parts[2] === 'MONTHLY' || parts[2] === 'LIFETIME') {
      return { slug: parts[1].toLowerCase(), plan: parts[2] as Plan, currency: parts[3] as Currency };
    }
  }
  throw new Error('Unrecognized AlgoLync payment reference format.');
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
  const { plan, currency, slug } = parseReference(reference);
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

  if (result.status !== true || !payment || payment.status !== 'success'
    || payment.reference !== reference || payment.currency !== currency) {
    throw new Error('Paystack transaction is not successful or does not match currency/reference.');
  }

  // Validate amount against EA catalog if available
  const meta = (payment.metadata && typeof payment.metadata === 'object' && !Array.isArray(payment.metadata))
    ? payment.metadata as Record<string, unknown> : {};
  const eaSlug = String(meta.ea_slug || slug || 'eridam-nexus-pro');
  const ea = getEaBySlug(eaSlug);
  if (!ea) throw new Error('Payment metadata references an unknown AlgoLync product.');
  if (meta.product !== 'ALGOLYNX_VAULT') throw new Error('Payment metadata does not identify an AlgoLync storefront purchase.');
  if (slug && ea.slug !== slug) throw new Error('Payment product metadata does not match its payment reference.');
  if (meta.currency !== currency || meta.tier !== plan) throw new Error('Payment plan or currency metadata does not match the reference.');

  let expectedAmount = 6500000;
  if (currency === 'NGN') {
    const p = plan === 'MONTHLY' ? (ea?.monthlyPriceNgn ?? 65000) : (ea?.lifetimePriceNgn ?? 250000);
    expectedAmount = p * 100;
  } else {
    const p = plan === 'MONTHLY' ? (ea?.monthlyPriceUsd ?? 49) : (ea?.lifetimePriceUsd ?? 199);
    expectedAmount = p * 100;
  }

  // Never mint an entitlement for a partial, overpaid, underpaid, or tampered checkout.
  const paidAmount = typeof payment.amount === 'number' ? payment.amount : Number(payment.amount);
  if (!Number.isSafeInteger(paidAmount) || paidAmount !== expectedAmount) {
    throw new Error('Verified Paystack amount does not exactly match the server-side product price.');
  }

  const email = safeEmail(
    payment.customer && typeof payment.customer === 'object' && 'email' in payment.customer
      ? (payment.customer as Record<string, unknown>).email : undefined
  );
  const mt5Account = paymentAccount(payment.metadata);
  const digest = createHash('sha256').update(reference).digest('hex').slice(0, 8).toUpperCase();
  const tier = plan === 'LIFETIME' ? 'INSTITUTIONAL_LIFETIME' : 'INSTITUTIONAL_MONTHLY';
  const expiresAt = plan === 'LIFETIME' ? null : new Date(Date.now() + 30 * 86_400_000).toISOString();

  const candidate: ProvisionedLicense = {
    license_key: `ALGOLYNX-${plan === 'LIFETIME' ? 'LT' : 'MO'}-${digest}-${randomBytes(4).toString('hex').toUpperCase()}`,
    payment_reference: reference,
    mt5_account: mt5Account,
    email,
    tier,
    status: 'ACTIVE',
    expires_at: expiresAt,
  };

  try {
    const persisted = await supabaseQuery<ProvisionedLicense>('rpc/provision_algolync_license_v2', {
      method: 'POST',
      body: {
        p_payment_reference: reference,
        p_license_key: candidate.license_key,
        p_mt5_account: candidate.mt5_account,
        p_email: candidate.email,
        p_tier: candidate.tier,
        p_expires_at: candidate.expires_at,
        p_ea_slug: eaSlug,
        p_currency: currency,
      },
    });

    const activeRecord = persisted || candidate;

    return {
      license: activeRecord,
      created: activeRecord.created === true,
      amount: paidAmount,
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
